import { Document, ObjectId } from "mongodb";
import { DetectedRoute } from "../routeDetection";
import { getMongoConnector } from "./mongoConnector";
import {
  inferCollectionName,
  getCollectionSuggestions,
  CollectionInference,
} from "./collectionInferencer";

export interface SampleDocument {
  _id: string | ObjectId;
  data: Document;
  displayName: string;
  summary: string;
}

export interface CollectionSampleData {
  collectionName: string;
  confidence: number;
  samples: SampleDocument[];
  totalDocuments: number;
  success: boolean;
  errorMessage?: string;
}

export interface RealDataOptions {
  primary: CollectionSampleData | null;
  alternatives: CollectionSampleData[];
  availableCollections: string[];
}

export class SampleDataFetcher {
  /**
   * Fetch sample data for a route by inferring the collection name
   * @param route The detected route
   * @returns Real data options with primary and alternative collections
   */
  static async fetchSampleDataForRoute(
    route: DetectedRoute,
  ): Promise<RealDataOptions> {
    const mongoConnector = getMongoConnector();

    // If MongoDB is not available, return empty results
    if (!mongoConnector.isAvailable()) {
      return {
        primary: null,
        alternatives: [],
        availableCollections: [],
      };
    }

    try {
      // Get all available collections
      const availableCollections = await mongoConnector.listCollections();

      // Get collection suggestions for this route
      const suggestions = getCollectionSuggestions(route);

      // Try to fetch sample data for each suggestion
      const collectionResults: CollectionSampleData[] = [];

      for (const suggestion of suggestions.slice(0, 5)) {
        // Limit to top 5 suggestions
        if (availableCollections.includes(suggestion.collectionName)) {
          const sampleData = await this.fetchSampleDataFromCollection(
            suggestion.collectionName,
            suggestion.confidence,
          );

          if (sampleData.success && sampleData.samples.length > 0) {
            collectionResults.push(sampleData);
          }
        }
      }

      // Separate primary (highest confidence with data) from alternatives
      const primary =
        collectionResults.length > 0 ? collectionResults[0] : null;
      const alternatives = collectionResults.slice(1);

      return {
        primary,
        alternatives,
        availableCollections,
      };
    } catch (error) {
      console.error(
        "[SampleDataFetcher] Error fetching route sample data:",
        error,
      );
      return {
        primary: null,
        alternatives: [],
        availableCollections: [],
      };
    }
  }

  /**
   * Fetch sample documents from a specific collection
   * @param collectionName Name of the collection
   * @param confidence Confidence score for this collection choice
   * @param limit Number of sample documents to fetch (default: 3)
   * @returns Collection sample data
   */
  static async fetchSampleDataFromCollection(
    collectionName: string,
    confidence: number = 1.0,
    limit: number = 3,
  ): Promise<CollectionSampleData> {
    const mongoConnector = getMongoConnector();

    if (!mongoConnector.isAvailable()) {
      return {
        collectionName,
        confidence,
        samples: [],
        totalDocuments: 0,
        success: false,
        errorMessage: "MongoDB not connected",
      };
    }

    try {
      const collection = mongoConnector.getCollection(collectionName);
      if (!collection) {
        return {
          collectionName,
          confidence,
          samples: [],
          totalDocuments: 0,
          success: false,
          errorMessage: "Collection not found",
        };
      }

      // Get total document count
      const totalDocuments = await collection.countDocuments();

      if (totalDocuments === 0) {
        return {
          collectionName,
          confidence,
          samples: [],
          totalDocuments: 0,
          success: true,
          errorMessage: "Collection is empty",
        };
      }

      // Fetch sample documents
      const sampleDocuments = await mongoConnector.getSampleDocuments(
        collectionName,
        limit,
      );

      // Convert to SampleDocument format
      const samples: SampleDocument[] = sampleDocuments.map((doc, index) => ({
        _id: doc._id,
        data: doc,
        displayName: this.generateDisplayName(doc, index + 1),
        summary: this.generateSummary(doc),
      }));

      return {
        collectionName,
        confidence,
        samples,
        totalDocuments,
        success: true,
      };
    } catch (error) {
      console.error(
        `[SampleDataFetcher] Error fetching from ${collectionName}:`,
        error,
      );
      return {
        collectionName,
        confidence,
        samples: [],
        totalDocuments: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Generate a user-friendly display name for a document
   * @param doc The document
   * @param index Document index for fallback naming
   * @returns Display name string
   */
  private static generateDisplayName(doc: Document, index: number): string {
    // Try common name fields first
    const nameFields = [
      "name",
      "title",
      "displayName",
      "label",
      "username",
      "email",
    ];

    for (const field of nameFields) {
      if (doc[field] && typeof doc[field] === "string") {
        return doc[field].slice(0, 50); // Limit length
      }
    }

    // Try ID fields
    const idFields = ["id", "_id"];
    for (const field of idFields) {
      if (doc[field]) {
        return `ID: ${doc[field]}`;
      }
    }

    // Fallback to generic name
    return `Sample ${index}`;
  }

  /**
   * Generate a summary of the document's key fields
   * @param doc The document
   * @returns Summary string
   */
  private static generateSummary(doc: Document): string {
    const keys = Object.keys(doc);
    const importantFields = keys
      .filter(
        (key) =>
          !key.startsWith("_") &&
          !key.startsWith("__") &&
          doc[key] !== null &&
          doc[key] !== undefined,
      )
      .slice(0, 4); // Show up to 4 fields

    const summaryParts = importantFields.map((key) => {
      const value = doc[key];
      let displayValue: string;

      if (typeof value === "string") {
        displayValue = value.length > 20 ? `${value.slice(0, 20)}...` : value;
      } else if (value instanceof ObjectId) {
        displayValue = `ObjectId(...${value.toString().slice(-6)})`;
      } else if (value instanceof Date) {
        displayValue = value.toISOString().split("T")[0]; // Just the date part
      } else if (Array.isArray(value)) {
        displayValue = `[${value.length} items]`;
      } else if (typeof value === "object") {
        displayValue = "{...}";
      } else {
        displayValue = String(value);
      }

      return `${key}: ${displayValue}`;
    });

    const summary = summaryParts.join(", ");
    return summary.length > 100 ? `${summary.slice(0, 100)}...` : summary;
  }

  /**
   * Fetch sample data for a specific field type (e.g., for ObjectId resolution)
   * @param collectionName Collection to fetch from
   * @param fieldName Field to focus on
   * @param limit Number of samples
   * @returns Array of field values
   */
  static async fetchFieldSamples(
    collectionName: string,
    fieldName: string,
    limit: number = 10,
  ): Promise<any[]> {
    const mongoConnector = getMongoConnector();

    if (!mongoConnector.isAvailable()) {
      return [];
    }

    try {
      const collection = mongoConnector.getCollection(collectionName);
      if (!collection) {
        return [];
      }

      // Find documents that have this field
      const docs = await collection
        .find({ [fieldName]: { $exists: true, $ne: null } })
        .limit(limit)
        .toArray();

      return docs
        .map((doc) => doc[fieldName])
        .filter((value) => value !== null && value !== undefined);
    } catch (error) {
      console.error(
        `[SampleDataFetcher] Error fetching field samples for ${fieldName}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get a formatted payload suggestion using real data from a sample
   * @param sample The sample document to use as a base
   * @param method HTTP method to predict payload structure for
   * @returns Suggested payload object
   */
  static generatePayloadFromSample(
    sample: SampleDocument,
    method: string,
  ): any {
    const doc = sample.data;

    // For GET requests, typically no payload needed
    if (method === "GET") {
      return {};
    }

    // For DELETE requests, usually just need ID
    if (method === "DELETE") {
      return doc._id ? { id: doc._id } : {};
    }

    // For POST/PUT/PATCH, create payload based on document structure
    const payload: any = {};

    Object.keys(doc).forEach((key) => {
      // Skip internal MongoDB fields for new documents
      if (key === "_id" || key === "__v" || key.startsWith("_")) {
        return;
      }

      const value = doc[key];

      // Include the field with appropriate modifications for different methods
      if (method === "POST") {
        // For POST, exclude ID fields that would be auto-generated
        if (
          !key.toLowerCase().includes("id") ||
          key === "userId" ||
          key.endsWith("Id")
        ) {
          payload[key] = this.sanitizeValueForPayload(value);
        }
      } else {
        // For PUT/PATCH, include all fields
        payload[key] = this.sanitizeValueForPayload(value);
      }
    });

    return payload;
  }

  /**
   * Sanitize a value for use in a request payload
   * @param value Original value from database
   * @returns Sanitized value appropriate for JSON payload
   */
  private static sanitizeValueForPayload(value: any): any {
    if (value instanceof ObjectId) {
      return value.toString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValueForPayload(item));
    }

    if (typeof value === "object" && value !== null) {
      const sanitized: any = {};
      Object.keys(value).forEach((key) => {
        sanitized[key] = this.sanitizeValueForPayload(value[key]);
      });
      return sanitized;
    }

    return value;
  }

  /**
   * Check if a collection exists and has data
   * @param collectionName Collection name to check
   * @returns Promise<boolean>
   */
  static async hasCollectionWithData(collectionName: string): Promise<boolean> {
    const mongoConnector = getMongoConnector();

    if (!mongoConnector.isAvailable()) {
      return false;
    }

    try {
      const collections = await mongoConnector.listCollections();
      if (!collections.includes(collectionName)) {
        return false;
      }

      const collection = mongoConnector.getCollection(collectionName);
      if (!collection) {
        return false;
      }

      const count = await collection.countDocuments();
      return count > 0;
    } catch (error) {
      console.error(
        `[SampleDataFetcher] Error checking collection ${collectionName}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get all available collections with sample counts
   * @returns Array of collections with metadata
   */
  static async getAvailableCollections(): Promise<
    Array<{ name: string; count: number; hasData: boolean }>
  > {
    const mongoConnector = getMongoConnector();

    if (!mongoConnector.isAvailable()) {
      return [];
    }

    try {
      const collectionsInfo = await mongoConnector.getCollectionsInfo();

      return collectionsInfo.map((info) => ({
        name: info.name,
        count: info.count,
        hasData: info.count > 0,
      }));
    } catch (error) {
      console.error(
        "[SampleDataFetcher] Error getting available collections:",
        error,
      );
      return [];
    }
  }
}

/**
 * Helper function to quickly get sample data for a route
 * @param route The route to get sample data for
 * @returns Promise<RealDataOptions>
 */
export async function getRealDataForRoute(
  route: DetectedRoute,
): Promise<RealDataOptions> {
  return await SampleDataFetcher.fetchSampleDataForRoute(route);
}

/**
 * Helper function to generate a payload from real data
 * @param sample Sample document to base payload on
 * @param method HTTP method
 * @returns Suggested payload
 */
export function generatePayloadFromRealData(
  sample: SampleDocument,
  method: string,
): any {
  return SampleDataFetcher.generatePayloadFromSample(sample, method);
}
