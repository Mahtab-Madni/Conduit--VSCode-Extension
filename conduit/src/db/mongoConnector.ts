import { MongoClient, Db, Collection, Document, ObjectId } from "mongodb";
import * as vscode from "vscode";

export interface MongoConnectionConfig {
  uri: string;
  database: string;
  connectionTimeout: number;
}

export interface CollectionInfo {
  name: string;
  count: number;
  avgDocSize: number;
}

export interface SchemaField {
  name: string;
  type: string;
  frequency: number; // percentage of documents that have this field
  examples: any[];
}

export interface InferredSchema {
  collection: string;
  totalDocuments: number;
  fields: SchemaField[];
  sampleDocuments: Document[];
}

export class MongoConnector {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private connectionConfig: MongoConnectionConfig;
  private isConnected: boolean = false;

  constructor() {
    // Get configuration from VS Code settings
    const config = vscode.workspace.getConfiguration("conduit");
    this.connectionConfig = {
      uri: config.get("mongoUri", "mongodb://localhost:27017"),
      database: config.get("mongoDatabase", "test"),
      connectionTimeout: config.get("mongoConnectionTimeout", 5000),
    };
  }

  /**
   * Attempts to connect to MongoDB. Fails silently if connection is not available.
   * @returns Promise<boolean> true if connected, false otherwise
   */
  async connect(): Promise<boolean> {
    if (this.isConnected && this.client && this.db) {
      return true;
    }

    try {
      console.log(
        `[MongoDB] Attempting to connect to ${this.connectionConfig.uri}`,
      );

      this.client = new MongoClient(this.connectionConfig.uri, {
        connectTimeoutMS: this.connectionConfig.connectionTimeout,
        serverSelectionTimeoutMS: this.connectionConfig.connectionTimeout,
        socketTimeoutMS: this.connectionConfig.connectionTimeout,
      });

      await this.client.connect();

      // Test the connection
      await this.client.db("admin").admin().ping();

      this.db = this.client.db(this.connectionConfig.database);
      this.isConnected = true;

      console.log(
        `[MongoDB] Connected successfully to ${this.connectionConfig.database}`,
      );
      return true;
    } catch (error) {
      console.log(
        `[MongoDB] Connection failed (falling back to AI-only mode): ${error}`,
      );
      this.isConnected = false;
      this.client = null;
      this.db = null;
      return false;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
        console.log("[MongoDB] Disconnected successfully");
      } catch (error) {
        console.error("[MongoDB] Error during disconnect:", error);
      }
    }

    this.client = null;
    this.db = null;
    this.isConnected = false;
  }

  /**
   * Check if MongoDB is connected and available
   */
  isAvailable(): boolean {
    return this.isConnected && this.db !== null;
  }

  /**
   * Get the database instance (only if connected)
   */
  getDatabase(): Db | null {
    return this.isAvailable() ? this.db : null;
  }

  /**
   * Get a collection instance
   * @param collectionName Name of the collection
   * @returns Collection instance or null if not connected
   */
  getCollection(collectionName: string): Collection | null {
    if (!this.isAvailable() || !this.db) {
      return null;
    }
    return this.db.collection(collectionName);
  }

  /**
   * List all collections in the database
   * @returns Array of collection names or empty array if not connected
   */
  async listCollections(): Promise<string[]> {
    if (!this.isAvailable() || !this.db) {
      return [];
    }

    try {
      const collections = await this.db.listCollections().toArray();
      return collections.map((col) => col.name);
    } catch (error) {
      console.error("[MongoDB] Error listing collections:", error);
      return [];
    }
  }

  /**
   * Get basic information about all collections
   * @returns Array of collection information or empty array if not connected
   */
  async getCollectionsInfo(): Promise<CollectionInfo[]> {
    if (!this.isAvailable() || !this.db) {
      return [];
    }

    try {
      const collectionNames = await this.listCollections();
      const collectionsInfo: CollectionInfo[] = [];

      for (const name of collectionNames) {
        try {
          const collection = this.db.collection(name);
          const stats = await this.db.command({ collStats: name });

          collectionsInfo.push({
            name,
            count: stats.count || 0,
            avgDocSize: stats.avgObjSize || 0,
          });
        } catch (statsError) {
          // If we can't get stats for a collection, still include it with basic info
          const collection = this.db.collection(name);
          const count = await collection.countDocuments();

          collectionsInfo.push({
            name,
            count,
            avgDocSize: 0,
          });
        }
      }

      return collectionsInfo;
    } catch (error) {
      console.error("[MongoDB] Error getting collections info:", error);
      return [];
    }
  }

  /**
   * Get sample documents from a collection
   * @param collectionName Name of the collection
   * @param limit Number of documents to fetch (default: 3)
   * @returns Array of documents or empty array if not connected/collection not found
   */
  async getSampleDocuments(
    collectionName: string,
    limit: number = 3,
  ): Promise<Document[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const collection = this.getCollection(collectionName);
      if (!collection) {
        return [];
      }

      // Use aggregation with $sample for better random sampling
      // If collection is small, fall back to regular find
      const count = await collection.countDocuments();

      let documents: Document[];

      if (count <= limit) {
        // If collection has fewer documents than limit, just get all
        documents = await collection.find({}).toArray();
      } else if (count < 100) {
        // For small collections, use find with skip
        const skip = Math.floor(Math.random() * Math.max(0, count - limit));
        documents = await collection.find({}).skip(skip).limit(limit).toArray();
      } else {
        // For larger collections, use $sample aggregation
        documents = await collection
          .aggregate([{ $sample: { size: limit } }])
          .toArray();
      }

      return documents;
    } catch (error) {
      console.error(
        `[MongoDB] Error getting sample documents from ${collectionName}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Find documents with specific ObjectId fields that exist in related collections
   * @param collectionName Name of the collection to search in
   * @param foreignKey Name of the foreign key field (e.g., 'userId', 'productId')
   * @param relatedCollection Name of the related collection to verify ObjectIds exist
   * @param limit Number of valid ObjectIds to return (default: 5)
   * @returns Array of valid ObjectIds or empty array if not connected
   */
  async findValidObjectIds(
    collectionName: string,
    foreignKey: string,
    relatedCollection: string,
    limit: number = 5,
  ): Promise<ObjectId[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const collection = this.getCollection(collectionName);
      const relatedCol = this.getCollection(relatedCollection);

      if (!collection || !relatedCol) {
        return [];
      }

      // Get sample ObjectIds from the related collection
      const relatedDocs = await relatedCol
        .find({}, { projection: { _id: 1 } })
        .limit(limit * 2) // Get more than we need in case some don't match
        .toArray();

      const validIds: ObjectId[] = [];

      for (const doc of relatedDocs) {
        if (validIds.length >= limit) {
          break;
        }

        // Check if this ObjectId is used as a foreign key in the main collection
        const exists = await collection.findOne({ [foreignKey]: doc._id });
        if (exists) {
          validIds.push(doc._id);
        }
      }

      // If we don't have enough matching IDs, just return ObjectIds from related collection
      if (validIds.length < limit) {
        const remainingNeeded = limit - validIds.length;
        const additionalIds = relatedDocs
          .slice(0, remainingNeeded)
          .map((doc) => doc._id)
          .filter(
            (id) => !validIds.some((existingId) => existingId.equals(id)),
          );

        validIds.push(...additionalIds);
      }

      return validIds;
    } catch (error) {
      console.error(
        `[MongoDB] Error finding valid ObjectIds for ${foreignKey}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Infer schema from a collection by sampling documents
   * @param collectionName Name of the collection
   * @param sampleSize Number of documents to sample for schema inference (default: 50)
   * @returns Inferred schema or null if not connected/collection not found
   */
  async inferSchema(
    collectionName: string,
    sampleSize: number = 50,
  ): Promise<InferredSchema | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const collection = this.getCollection(collectionName);
      if (!collection) {
        return null;
      }

      const totalDocuments = await collection.countDocuments();
      if (totalDocuments === 0) {
        return {
          collection: collectionName,
          totalDocuments: 0,
          fields: [],
          sampleDocuments: [],
        };
      }

      // Get sample documents for schema inference
      const actualSampleSize = Math.min(sampleSize, totalDocuments);
      let sampleDocuments: Document[];

      if (totalDocuments <= actualSampleSize) {
        sampleDocuments = await collection.find({}).toArray();
      } else {
        sampleDocuments = await collection
          .aggregate([{ $sample: { size: actualSampleSize } }])
          .toArray();
      }

      // Analyze fields across all sample documents
      const fieldMap = new Map<
        string,
        { types: Set<string>; count: number; examples: any[] }
      >();

      sampleDocuments.forEach((doc) => {
        this.analyzeDocumentFields(doc, fieldMap, "");
      });

      // Convert field map to schema fields
      const fields: SchemaField[] = Array.from(fieldMap.entries()).map(
        ([name, info]) => {
          const frequency = Math.round(
            (info.count / sampleDocuments.length) * 100,
          );
          const types = Array.from(info.types);
          const type = types.length === 1 ? types[0] : types.join(" | ");

          return {
            name,
            type,
            frequency,
            examples: info.examples.slice(0, 3), // Keep up to 3 examples
          };
        },
      );

      // Sort fields by frequency (most common first)
      fields.sort((a, b) => b.frequency - a.frequency);

      return {
        collection: collectionName,
        totalDocuments,
        fields,
        sampleDocuments: sampleDocuments.slice(0, 3), // Return first 3 as examples
      };
    } catch (error) {
      console.error(
        `[MongoDB] Error inferring schema for ${collectionName}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Recursively analyze document fields for schema inference
   * @param obj Document or nested object to analyze
   * @param fieldMap Map to store field information
   * @param prefix Current field path prefix
   */
  private analyzeDocumentFields(
    obj: any,
    fieldMap: Map<
      string,
      { types: Set<string>; count: number; examples: any[] }
    >,
    prefix: string,
  ): void {
    if (obj === null || obj === undefined) {
      return;
    }

    if (Array.isArray(obj)) {
      // Handle arrays
      const fieldName = prefix || "array";
      const fieldInfo = fieldMap.get(fieldName) || {
        types: new Set(),
        count: 0,
        examples: [],
      };
      fieldInfo.types.add("array");
      fieldInfo.count += 1;
      if (fieldInfo.examples.length < 3) {
        fieldInfo.examples.push(obj.slice(0, 2)); // Show first 2 elements as example
      }
      fieldMap.set(fieldName, fieldInfo);

      // Analyze array elements if they're objects
      if (obj.length > 0 && typeof obj[0] === "object" && obj[0] !== null) {
        this.analyzeDocumentFields(obj[0], fieldMap, `${prefix}[]`);
      }
    } else if (typeof obj === "object") {
      // Handle objects
      Object.entries(obj).forEach(([key, value]) => {
        const fieldName = prefix ? `${prefix}.${key}` : key;
        const fieldInfo = fieldMap.get(fieldName) || {
          types: new Set(),
          count: 0,
          examples: [],
        };

        if (value instanceof ObjectId) {
          fieldInfo.types.add("ObjectId");
        } else if (value instanceof Date) {
          fieldInfo.types.add("Date");
        } else if (Array.isArray(value)) {
          fieldInfo.types.add("array");
        } else if (value === null) {
          fieldInfo.types.add("null");
        } else {
          fieldInfo.types.add(typeof value);
        }

        fieldInfo.count += 1;
        if (fieldInfo.examples.length < 3) {
          fieldInfo.examples.push(value);
        }
        fieldMap.set(fieldName, fieldInfo);

        // Recursively analyze nested objects (but not too deep to avoid explosion)
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value) &&
          !(value instanceof ObjectId) &&
          !(value instanceof Date) &&
          prefix.split(".").length < 3
        ) {
          this.analyzeDocumentFields(value, fieldMap, fieldName);
        }
      });
    }
  }

  /**
   * Update MongoDB connection configuration
   * @param config New configuration
   */
  updateConfig(config: Partial<MongoConnectionConfig>): void {
    this.connectionConfig = { ...this.connectionConfig, ...config };
  }

  /**
   * Test MongoDB connection without establishing a persistent connection
   * @returns Promise<boolean> true if connection test successful
   */
  async testConnection(): Promise<boolean> {
    let testClient: MongoClient | null = null;

    try {
      testClient = new MongoClient(this.connectionConfig.uri, {
        connectTimeoutMS: this.connectionConfig.connectionTimeout,
        serverSelectionTimeoutMS: this.connectionConfig.connectionTimeout,
      });

      await testClient.connect();
      await testClient.db("admin").admin().ping();

      return true;
    } catch (error) {
      console.log(`[MongoDB] Connection test failed: ${error}`);
      return false;
    } finally {
      if (testClient) {
        await testClient.close();
      }
    }
  }
}

// Singleton instance
let mongoConnector: MongoConnector | null = null;

/**
 * Get the singleton MongoDB connector instance
 * @returns MongoConnector instance
 */
export function getMongoConnector(): MongoConnector {
  if (!mongoConnector) {
    mongoConnector = new MongoConnector();
  }
  return mongoConnector;
}

/**
 * Initialize MongoDB connection (call this at extension startup)
 * @returns Promise<boolean> true if connection successful
 */
export async function initializeMongoDB(): Promise<boolean> {
  const connector = getMongoConnector();
  return await connector.connect();
}

/**
 * Cleanup MongoDB connection (call this at extension shutdown)
 */
export async function cleanupMongoDB(): Promise<void> {
  if (mongoConnector) {
    await mongoConnector.disconnect();
    mongoConnector = null;
  }
}
