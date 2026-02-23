import { DetectedRoute } from "../routeDetection";
import {
  PayloadPredictor,
  PredictedField,
  PayloadPrediction,
} from "../ai/payloadPredictor";
import { getMongoConnector } from "./mongoConnector";
import {
  inferCollectionName,
  getCollectionSuggestions,
} from "./collectionInferencer";
import {
  SampleDataFetcher,
  getRealDataForRoute,
  SampleDocument,
} from "./sampleDataFetcher";
import { ObjectIdResolver, resolveMultipleObjectIds } from "./objectIdResolver";
import { getCollectionSchema } from "./schemaViewer";
import * as vscode from "vscode";

export interface HybridFieldPrediction extends PredictedField {
  realValues?: any[];
  hasRealData: boolean;
  confidence: number;
  source: "ai" | "mongodb" | "hybrid";
  mongoFieldInfo?: {
    type: string;
    frequency: number;
    isRequired: boolean;
    possibleValues?: any[];
  };
}

export interface HybridPayloadPrediction {
  fields: HybridFieldPrediction[];
  collectionName?: string;
  collectionConfidence: number;
  sampleDocuments: SampleDocument[];
  hasMongoData: boolean;
  aiPrediction?: PayloadPrediction;
  mongoSchema?: any;
  recommendedApproach: "ai-only" | "mongo-only" | "hybrid";
}

export interface PayloadGenerationOptions {
  preferRealData: boolean;
  includeAllFields: boolean;
  useAIFallback: boolean;
  limitFields?: number;
  excludeFields?: string[];
  forceFields?: string[];
}

export class HybridPayloadGenerator {
  private payloadPredictor: PayloadPredictor;

  constructor(context: vscode.ExtensionContext) {
    this.payloadPredictor = new PayloadPredictor(context);
  }

  /**
   * Generate a hybrid payload prediction combining AI and MongoDB data
   * @param route The detected route
   * @param options Generation options
   * @returns Hybrid prediction with AI + MongoDB data
   */
  async generateHybridPrediction(
    route: DetectedRoute,
    options: PayloadGenerationOptions = this.getDefaultOptions(),
  ): Promise<HybridPayloadPrediction> {
    try {
      // Check if MongoDB is available
      const mongoConnector = getMongoConnector();
      const hasMongoConnection = mongoConnector.isAvailable();

      // Start both AI and MongoDB analysis in parallel
      const [aiPredictionPromise, mongoDataPromise] = [
        this.getAIPrediction(route, options),
        hasMongoConnection
          ? this.getMongoData(route, options)
          : Promise.resolve(null),
      ];

      const [aiPrediction, mongoData] = await Promise.all([
        aiPredictionPromise,
        mongoDataPromise,
      ]);

      // Determine the best approach based on available data
      const recommendedApproach = this.determineRecommendedApproach(
        aiPrediction,
        mongoData,
        options,
      );

      // Merge AI and MongoDB predictions
      const hybridFields = await this.mergeFieldPredictions(
        aiPrediction?.fields || [],
        mongoData,
        route,
        options,
      );

      return {
        fields: hybridFields,
        collectionName: mongoData?.primary?.collectionName,
        collectionConfidence: mongoData?.primary?.confidence || 0,
        sampleDocuments: mongoData?.primary?.samples || [],
        hasMongoData: hasMongoConnection && mongoData?.primary !== null,
        aiPrediction: aiPrediction || undefined,
        mongoSchema: mongoData?.schema,
        recommendedApproach,
      };
    } catch (error) {
      console.error(
        "[HybridPayloadGenerator] Error generating hybrid prediction:",
        error,
      );

      // Fallback to AI-only if available
      try {
        const aiPrediction = await this.getAIPrediction(route, options);
        return {
          fields:
            aiPrediction?.fields.map((field) => ({
              ...field,
              realValues: undefined,
              hasRealData: false,
              confidence: 0.5,
              source: "ai" as const,
            })) || [],
          collectionName: undefined,
          collectionConfidence: 0,
          sampleDocuments: [],
          hasMongoData: false,
          aiPrediction: aiPrediction || undefined,
          recommendedApproach: "ai-only",
        };
      } catch (aiError) {
        // Return empty prediction if both fail
        return this.getEmptyPrediction();
      }
    }
  }

  /**
   * Get AI prediction for the route
   * @param route Detected route
   * @param options Generation options
   * @returns AI payload prediction or null
   */
  private async getAIPrediction(
    route: DetectedRoute,
    options: PayloadGenerationOptions,
  ): Promise<PayloadPrediction | null> {
    if (!options.useAIFallback && !options.preferRealData) {
      return null;
    }

    try {
      return await this.payloadPredictor.predict(route);
    } catch (error) {
      console.warn("[HybridPayloadGenerator] AI prediction failed:", error);
      return null;
    }
  }

  /**
   * Get MongoDB data for the route
   * @param route Detected route
   * @param options Generation options
   * @returns MongoDB data or null
   */
  private async getMongoData(
    route: DetectedRoute,
    options: PayloadGenerationOptions,
  ): Promise<{ primary: any; schema: any } | null> {
    try {
      const realData = await getRealDataForRoute(route);

      if (!realData.primary) {
        return null;
      }

      // Get schema information for the primary collection
      const schema = await getCollectionSchema(
        realData.primary.collectionName,
        {
          sampleSize: 50,
          analyzeRelationships: true,
        },
      );

      return {
        primary: realData.primary,
        schema,
      };
    } catch (error) {
      console.warn(
        "[HybridPayloadGenerator] MongoDB data retrieval failed:",
        error,
      );
      return null;
    }
  }

  /**
   * Merge AI field predictions with MongoDB data
   * @param aiFields AI predicted fields
   * @param mongoData MongoDB collection data
   * @param route Original route
   * @param options Generation options
   * @returns Array of hybrid field predictions
   */
  private async mergeFieldPredictions(
    aiFields: PredictedField[],
    mongoData: any,
    route: DetectedRoute,
    options: PayloadGenerationOptions,
  ): Promise<HybridFieldPrediction[]> {
    const hybridFields: HybridFieldPrediction[] = [];
    const processedFields = new Set<string>();

    // Process MongoDB schema fields first if available
    if (mongoData?.schema?.detailedFields) {
      for (const mongoField of mongoData.schema.detailedFields) {
        // Skip internal MongoDB fields and certain system fields
        if (this.shouldSkipField(mongoField.name, route.method, options)) {
          continue;
        }

        const aiField = aiFields.find((af) => af.name === mongoField.name);
        const realValues = await this.getRealValuesForField(
          mongoField.name,
          mongoData.primary.samples,
          mongoData.primary.collectionName,
        );

        hybridFields.push({
          name: mongoField.name,
          type: aiField?.type || mongoField.type,
          required: mongoField.isRequired,
          example:
            realValues.length > 0 ? realValues[0] : mongoField.examples[0],
          description:
            aiField?.description ||
            `Field from ${mongoData.primary.collectionName} collection`,
          realValues,
          hasRealData: realValues.length > 0,
          confidence: this.calculateFieldConfidence(
            aiField,
            mongoField,
            realValues,
          ),
          source: aiField ? "hybrid" : "mongodb",
          mongoFieldInfo: {
            type: mongoField.type,
            frequency: mongoField.frequency,
            isRequired: mongoField.isRequired,
            possibleValues: mongoField.possibleValues,
          },
        });

        processedFields.add(mongoField.name);
      }
    }

    // Add AI-only fields that weren't found in MongoDB
    for (const aiField of aiFields) {
      if (
        !processedFields.has(aiField.name) &&
        !this.shouldSkipField(aiField.name, route.method, options)
      ) {
        // Try to get real values even for AI-predicted fields
        const realValues = mongoData?.primary
          ? await this.getRealValuesForField(
              aiField.name,
              mongoData.primary.samples,
            )
          : [];

        hybridFields.push({
          ...aiField,
          realValues,
          hasRealData: realValues.length > 0,
          confidence: realValues.length > 0 ? 0.8 : 0.6,
          source: realValues.length > 0 ? "hybrid" : "ai",
        });

        processedFields.add(aiField.name);
      }
    }

    // Resolve ObjectIds for fields that look like references
    await this.resolveObjectIdFields(
      hybridFields,
      mongoData?.primary?.collectionName,
    );

    // Sort fields by confidence and importance
    hybridFields.sort((a, b) => {
      // Required fields first
      if (a.required && !b.required) {
        return -1;
      }
      if (!a.required && b.required) {
        return 1;
      }
      return b.confidence - a.confidence;
    });

    // Apply field limits
    if (options.limitFields && options.limitFields > 0) {
      return hybridFields.slice(0, options.limitFields);
    }

    return hybridFields;
  }

  /**
   * Get real values for a specific field from sample documents
   * @param fieldName Name of the field
   * @param sampleDocuments Sample documents from MongoDB
   * @param collectionName Collection name for context
   * @returns Array of real values
   */
  private async getRealValuesForField(
    fieldName: string,
    sampleDocuments: SampleDocument[] = [],
    collectionName?: string,
  ): Promise<any[]> {
    const values: any[] = [];
    const seen = new Set<string>();

    for (const sample of sampleDocuments) {
      const value = this.getNestedFieldValue(sample.data, fieldName);
      if (value !== null && value !== undefined) {
        const stringValue = JSON.stringify(value);
        if (!seen.has(stringValue)) {
          values.push(this.sanitizeValue(value));
          seen.add(stringValue);
        }
      }
    }

    // If we didn't find values in samples, try to fetch more from collection
    if (values.length === 0 && collectionName) {
      try {
        const fieldSamples = await SampleDataFetcher.fetchFieldSamples(
          collectionName,
          fieldName,
          5,
        );
        return fieldSamples.map((value) => this.sanitizeValue(value));
      } catch (error) {
        console.warn(
          `[HybridPayloadGenerator] Could not fetch field samples for ${fieldName}:`,
          error,
        );
      }
    }

    return values;
  }

  /**
   * Get nested field value from an object using dot notation
   * @param obj Object to search in
   * @param fieldPath Field path (e.g., 'user.name')
   * @returns Field value or null
   */
  private getNestedFieldValue(obj: any, fieldPath: string): any {
    if (!obj || typeof obj !== "object") {
      return null;
    }

    const parts = fieldPath.split(".");
    let current = obj;

    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }

    return current;
  }

  /**
   * Sanitize a value for use in JSON payloads
   * @param value Raw value from MongoDB
   * @returns Sanitized value
   */
  private sanitizeValue(value: any): any {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (
      value &&
      typeof value === "object" &&
      value.toString &&
      value.toString().length === 24
    ) {
      // Likely an ObjectId
      return value.toString();
    }

    return value;
  }

  /**
   * Resolve ObjectId fields with real references
   * @param fields Hybrid fields array
   * @param collectionName Context collection name
   */
  private async resolveObjectIdFields(
    fields: HybridFieldPrediction[],
    collectionName?: string,
  ): Promise<void> {
    const objectIdFields = fields.filter(
      (field) =>
        field.type.includes("ObjectId") ||
        field.name.toLowerCase().includes("id") ||
        (field.realValues &&
          field.realValues.some(
            (val) =>
              typeof val === "string" &&
              val.length === 24 &&
              /^[0-9a-fA-F]{24}$/.test(val),
          )),
    );

    if (objectIdFields.length === 0) {
      return;
    }

    try {
      const fieldNames = objectIdFields.map((f) => f.name);
      const resolutions = await resolveMultipleObjectIds(
        fieldNames,
        collectionName,
      );

      for (const field of objectIdFields) {
        const resolution = resolutions.get(field.name);
        if (resolution?.success && resolution.suggestedIds.length > 0) {
          // Replace real values with resolved ObjectIds
          field.realValues = resolution.suggestedIds
            .slice(0, 3)
            .map((resolved) => resolved.objectId.toString());

          field.confidence = Math.max(field.confidence, 0.8);
          field.hasRealData = true;

          if (field.source === "ai") {
            field.source = "hybrid";
          }
        }
      }
    } catch (error) {
      console.warn(
        "[HybridPayloadGenerator] ObjectId resolution failed:",
        error,
      );
    }
  }

  /**
   * Calculate confidence score for a field based on AI and MongoDB data
   * @param aiField AI predicted field
   * @param mongoField MongoDB schema field
   * @param realValues Real values from MongoDB
   * @returns Confidence score (0-1)
   */
  private calculateFieldConfidence(
    aiField?: PredictedField,
    mongoField?: any,
    realValues?: any[],
  ): number {
    let confidence = 0.5;

    // Boost confidence for MongoDB data
    if (mongoField) {
      confidence += 0.3;

      if (mongoField.frequency > 80) {
        confidence += 0.1;
      }

      if (mongoField.isRequired) {
        confidence += 0.1;
      }
    }

    // Boost confidence for AI predictions
    if (aiField) {
      confidence += 0.2;

      if (aiField.required) {
        confidence += 0.1;
      }
    }

    // Boost confidence for real values
    if (realValues && realValues.length > 0) {
      confidence += 0.2;
    }

    // Penalty for conflicts between AI and MongoDB
    if (aiField && mongoField && aiField.type !== mongoField.type) {
      confidence -= 0.1;
    }

    return Math.min(Math.max(confidence, 0.1), 1.0);
  }

  /**
   * Determine the recommended approach based on available data
   * @param aiPrediction AI prediction result
   * @param mongoData MongoDB data result
   * @param options Generation options
   * @returns Recommended approach
   */
  private determineRecommendedApproach(
    aiPrediction: PayloadPrediction | null,
    mongoData: any,
    options: PayloadGenerationOptions,
  ): "ai-only" | "mongo-only" | "hybrid" {
    const hasAI = aiPrediction && aiPrediction.fields.length > 0;
    const hasMongo = mongoData?.primary && mongoData.primary.samples.length > 0;

    if (!hasAI && !hasMongo) {
      return "ai-only"; // Fallback
    }

    if (!hasAI && hasMongo) {
      return "mongo-only";
    }

    if (hasAI && !hasMongo) {
      return "ai-only";
    }

    if (hasAI && hasMongo) {
      // Both available - consider user preferences and data quality
      if (options.preferRealData) {
        return mongoData.primary.confidence > 0.6 ? "hybrid" : "ai-only";
      } else {
        return "hybrid";
      }
    }

    return "hybrid";
  }

  /**
   * Check if a field should be skipped based on context
   * @param fieldName Name of the field
   * @param method HTTP method
   * @param options Generation options
   * @returns True if field should be skipped
   */
  private shouldSkipField(
    fieldName: string,
    method: string,
    options: PayloadGenerationOptions,
  ): boolean {
    // Skip excluded fields
    if (options.excludeFields?.includes(fieldName)) {
      return true;
    }

    // Always include forced fields
    if (options.forceFields?.includes(fieldName)) {
      return false;
    }

    // Skip internal MongoDB fields
    if (
      fieldName.startsWith("__") ||
      (fieldName === "_id" && method === "POST")
    ) {
      return true;
    }

    // Skip version fields for most operations
    if (fieldName === "__v" || fieldName === "version") {
      return true;
    }

    // Skip system timestamps for POST operations
    if (
      method === "POST" &&
      (fieldName === "createdAt" || fieldName === "updatedAt")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get default generation options
   * @returns Default options
   */
  private getDefaultOptions(): PayloadGenerationOptions {
    return {
      preferRealData: true,
      includeAllFields: false,
      useAIFallback: true,
      limitFields: 15,
      excludeFields: ["__v", "_id"],
      forceFields: [],
    };
  }

  /**
   * Get empty prediction structure
   * @returns Empty hybrid prediction
   */
  private getEmptyPrediction(): HybridPayloadPrediction {
    return {
      fields: [],
      collectionName: undefined,
      collectionConfidence: 0,
      sampleDocuments: [],
      hasMongoData: false,
      recommendedApproach: "ai-only",
    };
  }

  /**
   * Generate final payload from hybrid prediction
   * @param prediction Hybrid prediction
   * @param options Generation options
   * @returns Final payload object
   */
  generatePayload(
    prediction: HybridPayloadPrediction,
    options: PayloadGenerationOptions = this.getDefaultOptions(),
  ): any {
    const payload: any = {};

    for (const field of prediction.fields) {
      let value: any;

      // Prefer real values if available and requested
      if (
        options.preferRealData &&
        field.hasRealData &&
        field.realValues &&
        field.realValues.length > 0
      ) {
        value = field.realValues[0]; // Use first real value
      } else {
        value = field.example; // Use AI example or schema example
      }

      // Type-specific value handling
      if (field.type.includes("Date") && typeof value === "string") {
        // Ensure dates are in ISO format
        value = new Date(value).toISOString();
      } else if (
        field.type.includes("ObjectId") &&
        typeof value === "string" &&
        value.length !== 24
      ) {
        // Use a placeholder ObjectId if value doesn't look right
        value = "507f1f77bcf86cd799439011";
      }

      payload[field.name] = value;
    }

    return payload;
  }
}

/**
 * Helper function to generate hybrid payload prediction for a route
 * @param route Detected route
 * @param context VS Code extension context
 * @param options Generation options
 * @returns Hybrid payload prediction
 */
export async function generateHybridPayload(
  route: DetectedRoute,
  context: vscode.ExtensionContext,
  options?: PayloadGenerationOptions,
): Promise<HybridPayloadPrediction> {
  const generator = new HybridPayloadGenerator(context);
  return await generator.generateHybridPrediction(route, options);
}

/**
 * Helper function to generate final payload from hybrid prediction
 * @param prediction Hybrid prediction
 * @param options Generation options
 * @returns Final payload object
 */
export function createPayloadFromHybrid(
  prediction: HybridPayloadPrediction,
  options?: PayloadGenerationOptions,
): any {
  const generator = new HybridPayloadGenerator({} as vscode.ExtensionContext);
  return generator.generatePayload(prediction, options);
}
