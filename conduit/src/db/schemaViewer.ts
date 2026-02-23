import { Document, ObjectId } from "mongodb";
import {
  getMongoConnector,
  SchemaField,
  InferredSchema,
} from "./mongoConnector";

export interface DetailedSchemaField extends SchemaField {
  isRequired: boolean;
  possibleValues?: any[];
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  isUnique?: boolean;
  relationInfo?: RelationInfo;
}

export interface RelationInfo {
  isReference: boolean;
  targetCollection?: string;
  confidence: number;
  referenceType:
    | "one-to-one"
    | "one-to-many"
    | "many-to-one"
    | "many-to-many"
    | "unknown";
}

export interface CollectionSchema extends InferredSchema {
  detailedFields: DetailedSchemaField[];
  relationships: CollectionRelationship[];
  indexes?: IndexInfo[];
  statistics: CollectionStatistics;
}

export interface CollectionRelationship {
  fromCollection: string;
  toCollection: string;
  fromField: string;
  toField: string;
  relationshipType:
    | "one-to-one"
    | "one-to-many"
    | "many-to-one"
    | "many-to-many";
  confidence: number;
}

export interface IndexInfo {
  name: string;
  keys: Record<string, 1 | -1>;
  unique?: boolean;
  sparse?: boolean;
  background?: boolean;
}

export interface CollectionStatistics {
  totalDocuments: number;
  averageDocumentSize: number;
  totalSize: number;
  storageSize: number;
  indexCount: number;
  indexSize: number;
}

export interface SchemaAnalysisOptions {
  sampleSize?: number;
  analyzeRelationships?: boolean;
  analyzeIndexes?: boolean;
  detectArrayTypes?: boolean;
  maxFieldDepth?: number;
}

export class SchemaViewer {
  /**
   * Analyze and get detailed schema for a collection
   * @param collectionName Name of the collection to analyze
   * @param options Analysis options
   * @returns Detailed collection schema or null if not available
   */
  static async getCollectionSchema(
    collectionName: string,
    options: SchemaAnalysisOptions = {},
  ): Promise<CollectionSchema | null> {
    const mongoConnector = getMongoConnector();

    if (!mongoConnector.isAvailable()) {
      return null;
    }

    const defaultOptions: SchemaAnalysisOptions = {
      sampleSize: 100,
      analyzeRelationships: true,
      analyzeIndexes: true,
      detectArrayTypes: true,
      maxFieldDepth: 3,
      ...options,
    };

    try {
      // Get basic schema from mongo connector
      const basicSchema = await mongoConnector.inferSchema(
        collectionName,
        defaultOptions.sampleSize!,
      );
      if (!basicSchema) {
        return null;
      }

      // Get collection statistics
      const statistics = await this.getCollectionStatistics(collectionName);

      // Enhance fields with detailed analysis
      const detailedFields = await this.analyzeFieldsInDetail(
        collectionName,
        basicSchema.sampleDocuments,
        defaultOptions,
      );

      // Analyze relationships if requested
      let relationships: CollectionRelationship[] = [];
      if (defaultOptions.analyzeRelationships) {
        relationships = await this.analyzeRelationships(
          collectionName,
          detailedFields,
        );
      }

      // Get index information if requested
      let indexes: IndexInfo[] | undefined;
      if (defaultOptions.analyzeIndexes) {
        indexes = await this.getIndexes(collectionName);
      }

      return {
        ...basicSchema,
        detailedFields,
        relationships,
        indexes,
        statistics,
      };
    } catch (error) {
      console.error(
        `[SchemaViewer] Error analyzing schema for ${collectionName}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get basic statistics for a collection
   * @param collectionName Name of collection
   * @returns Collection statistics
   */
  private static async getCollectionStatistics(
    collectionName: string,
  ): Promise<CollectionStatistics> {
    const mongoConnector = getMongoConnector();
    const collection = mongoConnector.getCollection(collectionName);

    const defaultStats: CollectionStatistics = {
      totalDocuments: 0,
      averageDocumentSize: 0,
      totalSize: 0,
      storageSize: 0,
      indexCount: 0,
      indexSize: 0,
    };

    if (!collection) {
      return defaultStats;
    }

    try {
      const db = mongoConnector.getDatabase();
      if (!db) {
        return defaultStats;
      }

      // Try to get collection stats
      const stats = await db.command({ collStats: collectionName });

      return {
        totalDocuments: stats.count || 0,
        averageDocumentSize: stats.avgObjSize || 0,
        totalSize: stats.size || 0,
        storageSize: stats.storageSize || 0,
        indexCount: stats.nindexes || 0,
        indexSize: stats.totalIndexSize || 0,
      };
    } catch (error) {
      // If collStats fails, get basic info
      console.warn(
        `[SchemaViewer] Could not get detailed stats for ${collectionName}, using basic count`,
      );

      try {
        const count = await collection.countDocuments();
        return { ...defaultStats, totalDocuments: count };
      } catch (countError) {
        return defaultStats;
      }
    }
  }

  /**
   * Analyze fields in detail with statistics and type information
   * @param collectionName Name of collection
   * @param sampleDocuments Sample documents to analyze
   * @param options Analysis options
   * @returns Array of detailed field information
   */
  private static async analyzeFieldsInDetail(
    collectionName: string,
    sampleDocuments: Document[],
    options: SchemaAnalysisOptions,
  ): Promise<DetailedSchemaField[]> {
    const mongoConnector = getMongoConnector();
    const collection = mongoConnector.getCollection(collectionName);

    if (!collection || sampleDocuments.length === 0) {
      return [];
    }

    // Analyze field patterns from sample documents
    const fieldAnalysis = new Map<
      string,
      {
        types: Set<string>;
        values: any[];
        nullCount: number;
        uniqueValues: Set<string>;
        lengths: number[];
        numericValues: number[];
        isObjectId: boolean;
      }
    >();

    // Process each sample document
    sampleDocuments.forEach((doc) => {
      this.processDocumentForFieldAnalysis(
        doc,
        fieldAnalysis,
        "",
        0,
        options.maxFieldDepth!,
      );
    });

    // Convert analysis to detailed fields
    const detailedFields: DetailedSchemaField[] = [];

    for (const [fieldName, analysis] of fieldAnalysis.entries()) {
      const totalSamples = sampleDocuments.length;
      const nonNullCount = totalSamples - analysis.nullCount;
      const frequency = Math.round((nonNullCount / totalSamples) * 100);

      const field: DetailedSchemaField = {
        name: fieldName,
        type: Array.from(analysis.types).join(" | "),
        frequency,
        examples: Array.from(analysis.values).slice(0, 3),
        isRequired: frequency > 90, // Consider required if present in >90% of docs

        // String analysis
        minLength:
          analysis.lengths.length > 0
            ? Math.min(...analysis.lengths)
            : undefined,
        maxLength:
          analysis.lengths.length > 0
            ? Math.max(...analysis.lengths)
            : undefined,

        // Numeric analysis
        minValue:
          analysis.numericValues.length > 0
            ? Math.min(...analysis.numericValues)
            : undefined,
        maxValue:
          analysis.numericValues.length > 0
            ? Math.max(...analysis.numericValues)
            : undefined,

        // Uniqueness (rough estimate)
        isUnique:
          analysis.uniqueValues.size === nonNullCount && nonNullCount > 1,

        // Possible values for enums (if small set)
        possibleValues:
          analysis.uniqueValues.size <= 10 && analysis.uniqueValues.size > 1
            ? Array.from(analysis.uniqueValues)
            : undefined,
      };

      // Analyze if this field is a reference
      if (analysis.isObjectId) {
        field.relationInfo = await this.analyzeFieldRelation(
          fieldName,
          collectionName,
        );
      }

      detailedFields.push(field);
    }

    // Sort by frequency (most common first)
    detailedFields.sort((a, b) => b.frequency - a.frequency);

    return detailedFields;
  }

  /**
   * Recursively process a document for field analysis
   * @param obj Document or nested object
   * @param fieldAnalysis Map to store field analysis
   * @param prefix Field path prefix
   * @param depth Current nesting depth
   * @param maxDepth Maximum depth to analyze
   */
  private static processDocumentForFieldAnalysis(
    obj: any,
    fieldAnalysis: Map<string, any>,
    prefix: string,
    depth: number,
    maxDepth: number,
  ): void {
    if (depth >= maxDepth || obj === null || obj === undefined) {
      return;
    }

    if (Array.isArray(obj)) {
      const fieldName = prefix || "array";
      this.updateFieldAnalysis(fieldAnalysis, fieldName, obj, true);

      // Analyze array element types
      if (obj.length > 0 && typeof obj[0] === "object" && obj[0] !== null) {
        this.processDocumentForFieldAnalysis(
          obj[0],
          fieldAnalysis,
          `${prefix}[]`,
          depth + 1,
          maxDepth,
        );
      }
    } else if (typeof obj === "object" && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        const fieldName = prefix ? `${prefix}.${key}` : key;
        this.updateFieldAnalysis(fieldAnalysis, fieldName, value, false);

        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value) &&
          !(value instanceof ObjectId) &&
          !(value instanceof Date)
        ) {
          this.processDocumentForFieldAnalysis(
            value,
            fieldAnalysis,
            fieldName,
            depth + 1,
            maxDepth,
          );
        }
      });
    }
  }

  /**
   * Update field analysis with a new value
   * @param fieldAnalysis Analysis map
   * @param fieldName Name of the field
   * @param value Value to analyze
   * @param isArray Whether the value is from an array
   */
  private static updateFieldAnalysis(
    fieldAnalysis: Map<string, any>,
    fieldName: string,
    value: any,
    isArray: boolean,
  ): void {
    if (!fieldAnalysis.has(fieldName)) {
      fieldAnalysis.set(fieldName, {
        types: new Set<string>(),
        values: [],
        nullCount: 0,
        uniqueValues: new Set<string>(),
        lengths: [],
        numericValues: [],
        isObjectId: false,
      });
    }

    const analysis = fieldAnalysis.get(fieldName);

    if (value === null || value === undefined) {
      analysis.nullCount++;
      analysis.types.add("null");
      return;
    }

    // Determine type
    if (value instanceof ObjectId) {
      analysis.types.add("ObjectId");
      analysis.isObjectId = true;
      analysis.uniqueValues.add(value.toString());
    } else if (value instanceof Date) {
      analysis.types.add("Date");
      analysis.uniqueValues.add(value.toISOString());
    } else if (Array.isArray(value)) {
      analysis.types.add("array");
    } else {
      const type = typeof value;
      analysis.types.add(type);

      if (type === "string") {
        analysis.lengths.push(value.length);
        analysis.uniqueValues.add(value);
      } else if (type === "number") {
        analysis.numericValues.push(value);
        analysis.uniqueValues.add(value.toString());
      } else {
        analysis.uniqueValues.add(JSON.stringify(value));
      }
    }

    // Store example values (limit to prevent memory issues)
    if (analysis.values.length < 10) {
      analysis.values.push(value);
    }
  }

  /**
   * Analyze if a field represents a relationship to another collection
   * @param fieldName Name of the field
   * @param collectionName Source collection name
   * @returns Relation information or undefined
   */
  private static async analyzeFieldRelation(
    fieldName: string,
    collectionName: string,
  ): Promise<RelationInfo | undefined> {
    // Simple heuristic for ObjectId fields
    if (!fieldName.toLowerCase().includes("id") && fieldName !== "_id") {
      return undefined;
    }

    // Skip the primary _id field
    if (fieldName === "_id") {
      return undefined;
    }

    try {
      // Try to determine target collection from field name
      const targetCollection = this.guessTargetCollection(fieldName);
      if (!targetCollection) {
        return {
          isReference: true,
          confidence: 0.3,
          referenceType: "unknown",
        };
      }

      // Check if target collection exists
      const mongoConnector = getMongoConnector();
      const availableCollections = await mongoConnector.listCollections();

      if (!availableCollections.includes(targetCollection)) {
        return {
          isReference: true,
          confidence: 0.4,
          referenceType: "unknown",
        };
      }

      // Assume many-to-one relationship for most foreign keys
      return {
        isReference: true,
        targetCollection,
        confidence: 0.8,
        referenceType: "many-to-one",
      };
    } catch (error) {
      console.error(
        `[SchemaViewer] Error analyzing relation for ${fieldName}:`,
        error,
      );
      return undefined;
    }
  }

  /**
   * Guess target collection from field name
   * @param fieldName Name of the field
   * @returns Guessed collection name or null
   */
  private static guessTargetCollection(fieldName: string): string | null {
    const lowerField = fieldName.toLowerCase();

    // Remove common suffixes
    let baseName = lowerField
      .replace(/id$/, "")
      .replace(/_id$/, "")
      .replace(/ref$/, "")
      .replace(/_ref$/, "");

    if (!baseName) {
      return null;
    }

    // Return plural form (common collection naming)
    if (!baseName.endsWith("s")) {
      if (baseName.endsWith("y")) {
        return baseName.slice(0, -1) + "ies";
      } else {
        return baseName + "s";
      }
    }

    return baseName;
  }

  /**
   * Analyze relationships between collections
   * @param collectionName Source collection
   * @param fields Analyzed fields
   * @returns Array of discovered relationships
   */
  private static async analyzeRelationships(
    collectionName: string,
    fields: DetailedSchemaField[],
  ): Promise<CollectionRelationship[]> {
    const relationships: CollectionRelationship[] = [];

    for (const field of fields) {
      if (
        field.relationInfo?.isReference &&
        field.relationInfo.targetCollection
      ) {
        relationships.push({
          fromCollection: collectionName,
          toCollection: field.relationInfo.targetCollection,
          fromField: field.name,
          toField: "_id", // Assuming reference to _id field
          relationshipType:
            field.relationInfo.referenceType === "unknown"
              ? "many-to-one"
              : field.relationInfo.referenceType,
          confidence: field.relationInfo.confidence,
        });
      }
    }

    return relationships;
  }

  /**
   * Get index information for a collection
   * @param collectionName Name of collection
   * @returns Array of index information
   */
  private static async getIndexes(
    collectionName: string,
  ): Promise<IndexInfo[]> {
    const mongoConnector = getMongoConnector();
    const collection = mongoConnector.getCollection(collectionName);

    if (!collection) {
      return [];
    }

    try {
      const indexes = await collection.listIndexes().toArray();

      return indexes.map((index) => ({
        name: index.name,
        keys: index.key,
        unique: index.unique || false,
        sparse: index.sparse || false,
        background: index.background || false,
      }));
    } catch (error) {
      console.error(
        `[SchemaViewer] Error getting indexes for ${collectionName}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get schema for all collections in the database
   * @param options Analysis options
   * @returns Map of collection names to their schemas
   */
  static async getAllCollectionSchemas(
    options: SchemaAnalysisOptions = {},
  ): Promise<Map<string, CollectionSchema>> {
    const mongoConnector = getMongoConnector();
    const schemas = new Map<string, CollectionSchema>();

    if (!mongoConnector.isAvailable()) {
      return schemas;
    }

    try {
      const collections = await mongoConnector.listCollections();

      // Analyze each collection
      const analysisPromises = collections.map(async (collectionName) => {
        const schema = await this.getCollectionSchema(collectionName, options);
        if (schema) {
          schemas.set(collectionName, schema);
        }
      });

      await Promise.all(analysisPromises);
      return schemas;
    } catch (error) {
      console.error(
        "[SchemaViewer] Error getting all collection schemas:",
        error,
      );
      return schemas;
    }
  }

  /**
   * Generate a human-readable schema summary
   * @param schema Collection schema
   * @returns Formatted schema summary string
   */
  static generateSchemaSummary(schema: CollectionSchema): string {
    const { collection, totalDocuments, detailedFields, statistics } = schema;

    let summary = `Collection: ${collection}\n`;
    summary += `Documents: ${totalDocuments.toLocaleString()}\n`;

    if (statistics.averageDocumentSize > 0) {
      summary += `Avg Size: ${Math.round(statistics.averageDocumentSize)} bytes\n`;
    }

    summary += "\nFields:\n";

    detailedFields.slice(0, 10).forEach((field) => {
      // Show top 10 fields
      summary += `  ${field.name} (${field.type})`;

      if (field.isRequired) {
        summary += " *required*";
      }

      summary += ` - ${field.frequency}% of documents\n`;

      if (field.possibleValues && field.possibleValues.length <= 5) {
        summary += `    Values: ${field.possibleValues.join(", ")}\n`;
      }
    });

    if (schema.relationships.length > 0) {
      summary += "\nRelationships:\n";
      schema.relationships.forEach((rel) => {
        summary += `  ${rel.fromField} → ${rel.toCollection} (${rel.relationshipType})\n`;
      });
    }

    return summary;
  }
}

/**
 * Helper function to quickly get collection schema
 * @param collectionName Name of collection
 * @param options Analysis options
 * @returns Promise<CollectionSchema | null>
 */
export async function getCollectionSchema(
  collectionName: string,
  options: SchemaAnalysisOptions = {},
): Promise<CollectionSchema | null> {
  return await SchemaViewer.getCollectionSchema(collectionName, options);
}

/**
 * Helper function to get schemas for all collections
 * @param options Analysis options
 * @returns Promise<Map<string, CollectionSchema>>
 */
export async function getAllSchemas(
  options: SchemaAnalysisOptions = {},
): Promise<Map<string, CollectionSchema>> {
  return await SchemaViewer.getAllCollectionSchemas(options);
}
