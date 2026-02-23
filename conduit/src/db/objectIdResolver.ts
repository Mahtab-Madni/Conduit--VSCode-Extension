import { ObjectId } from "mongodb";
import { getMongoConnector } from "./mongoConnector";

export interface ResolvedObjectId {
  objectId: ObjectId;
  sourceCollection: string;
  displayInfo?: any; // Additional info about the referenced document
  confidence: number;
}

export interface ObjectIdFieldMapping {
  fieldName: string;
  sourceCollection: string;
  targetField: string; // field in source collection (usually '_id')
  confidence: number;
}

export interface ObjectIdResolution {
  fieldName: string;
  suggestedIds: ResolvedObjectId[];
  possibleCollections: string[];
  success: boolean;
  errorMessage?: string;
}

export class ObjectIdResolver {
  // Common field name to collection mappings
  private static readonly FIELD_COLLECTION_MAPPINGS: Record<string, string[]> =
    {
      userId: ["users", "user", "accounts", "profiles"],
      user_id: ["users", "user", "accounts", "profiles"],
      authorId: ["users", "user", "authors", "profiles"],
      author_id: ["users", "user", "authors", "profiles"],
      ownerId: ["users", "user", "owners"],
      owner_id: ["users", "user", "owners"],
      createdBy: ["users", "user", "accounts"],
      updatedBy: ["users", "user", "accounts"],

      productId: ["products", "product", "items"],
      product_id: ["products", "product", "items"],
      itemId: ["items", "item", "products"],
      item_id: ["items", "item", "products"],

      orderId: ["orders", "order", "purchases"],
      order_id: ["orders", "order", "purchases"],
      purchaseId: ["purchases", "purchase", "orders"],
      purchase_id: ["purchases", "purchase", "orders"],

      categoryId: ["categories", "category", "tags"],
      category_id: ["categories", "category", "tags"],
      tagId: ["tags", "tag", "categories"],
      tag_id: ["tags", "tag", "categories"],

      postId: ["posts", "post", "articles", "blogs"],
      post_id: ["posts", "post", "articles", "blogs"],
      articleId: ["articles", "article", "posts"],
      article_id: ["articles", "article", "posts"],

      commentId: ["comments", "comment", "replies"],
      comment_id: ["comments", "comment", "replies"],

      fileId: ["files", "file", "uploads", "attachments"],
      file_id: ["files", "file", "uploads", "attachments"],
      uploadId: ["uploads", "upload", "files"],
      upload_id: ["uploads", "upload", "files"],

      sessionId: ["sessions", "session", "tokens"],
      session_id: ["sessions", "session", "tokens"],
      tokenId: ["tokens", "token", "sessions"],
      token_id: ["tokens", "token", "sessions"],

      organizationId: ["organizations", "organization", "orgs", "companies"],
      organization_id: ["organizations", "organization", "orgs", "companies"],
      companyId: ["companies", "company", "organizations"],
      company_id: ["companies", "company", "organizations"],

      projectId: ["projects", "project"],
      project_id: ["projects", "project"],
      taskId: ["tasks", "task", "todos"],
      task_id: ["tasks", "task", "todos"],
    };

  // Fields that should be treated as ObjectIds even if not explicitly named
  private static readonly OBJECTID_INDICATORS = [
    "id",
    "_id",
    "ref",
    "reference",
    "foreignKey",
  ];

  /**
   * Resolve ObjectIds for a field that appears to reference another collection
   * @param fieldName Name of the field (e.g., 'userId', 'productId')
   * @param contextCollection Collection where this field appears (for context)
   * @param limit Maximum number of ObjectIds to return
   * @returns Resolution result with suggested ObjectIds
   */
  static async resolveObjectIdField(
    fieldName: string,
    contextCollection?: string,
    limit: number = 5,
  ): Promise<ObjectIdResolution> {
    const mongoConnector = getMongoConnector();

    if (!mongoConnector.isAvailable()) {
      return {
        fieldName,
        suggestedIds: [],
        possibleCollections: [],
        success: false,
        errorMessage: "MongoDB not connected",
      };
    }

    try {
      // Find possible source collections for this field
      const possibleCollections = this.getPossibleCollections(fieldName);
      const availableCollections = await mongoConnector.listCollections();

      // Filter to only existing collections
      const existingCollections = possibleCollections.filter((col) =>
        availableCollections.includes(col),
      );

      if (existingCollections.length === 0) {
        // Try to infer from field name patterns
        const inferredCollections = this.inferCollectionFromFieldName(
          fieldName,
        ).filter((col) => availableCollections.includes(col));

        if (inferredCollections.length === 0) {
          return {
            fieldName,
            suggestedIds: [],
            possibleCollections: availableCollections,
            success: true,
            errorMessage: `No matching collections found for field '${fieldName}'`,
          };
        }

        existingCollections.push(...inferredCollections);
      }

      // Collect ObjectIds from all possible collections
      const allSuggestedIds: ResolvedObjectId[] = [];

      for (const collectionName of existingCollections) {
        const objectIds = await this.getObjectIdsFromCollection(
          collectionName,
          fieldName,
          contextCollection,
          limit,
        );
        allSuggestedIds.push(...objectIds);
      }

      // Sort by confidence and limit results
      allSuggestedIds.sort((a, b) => b.confidence - a.confidence);
      const topSuggestions = allSuggestedIds.slice(0, limit);

      return {
        fieldName,
        suggestedIds: topSuggestions,
        possibleCollections: existingCollections,
        success: true,
      };
    } catch (error) {
      console.error(`[ObjectIdResolver] Error resolving ${fieldName}:`, error);
      return {
        fieldName,
        suggestedIds: [],
        possibleCollections: [],
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get ObjectIds from a specific collection
   * @param collectionName Collection to get ObjectIds from
   * @param fieldName Original field name for context
   * @param contextCollection Collection where the field appears
   * @param limit Number of ObjectIds to fetch
   * @returns Array of resolved ObjectIds
   */
  private static async getObjectIdsFromCollection(
    collectionName: string,
    fieldName: string,
    contextCollection?: string,
    limit: number = 5,
  ): Promise<ResolvedObjectId[]> {
    const mongoConnector = getMongoConnector();
    const collection = mongoConnector.getCollection(collectionName);

    if (!collection) {
      return [];
    }

    try {
      // If we have context, try to find ObjectIds that are actually referenced
      let referencedIds: ResolvedObjectId[] = [];

      if (contextCollection && contextCollection !== collectionName) {
        referencedIds = await this.findReferencedObjectIds(
          collectionName,
          contextCollection,
          fieldName,
          limit,
        );
      }

      // If we have enough referenced IDs, prefer those
      if (referencedIds.length >= limit) {
        return referencedIds;
      }

      // Otherwise, get random ObjectIds from the collection
      const documents = await collection
        .find(
          {},
          {
            projection: {
              _id: 1,
              name: 1,
              title: 1,
              username: 1,
              email: 1,
              displayName: 1,
            },
          },
        )
        .limit(limit * 2) // Get extra in case some are duplicates
        .toArray();

      const randomIds = documents.map((doc) => ({
        objectId: doc._id,
        sourceCollection: collectionName,
        displayInfo: this.extractDisplayInfo(doc),
        confidence: referencedIds.length > 0 ? 0.5 : 0.8, // Lower confidence if we couldn't find references
      }));

      // Combine referenced IDs with random IDs, avoiding duplicates
      const existingIds = new Set(
        referencedIds.map((r) => r.objectId.toString()),
      );
      const filteredRandomIds = randomIds.filter(
        (r) => !existingIds.has(r.objectId.toString()),
      );

      const combined = [...referencedIds, ...filteredRandomIds];
      return combined.slice(0, limit);
    } catch (error) {
      console.error(
        `[ObjectIdResolver] Error getting ObjectIds from ${collectionName}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Find ObjectIds that are actually referenced between collections
   * @param sourceCollection Collection containing the ObjectIds
   * @param targetCollection Collection that references these ObjectIds
   * @param fieldName Field name in target collection
   * @param limit Number of ObjectIds to return
   * @returns Array of referenced ObjectIds
   */
  private static async findReferencedObjectIds(
    sourceCollection: string,
    targetCollection: string,
    fieldName: string,
    limit: number,
  ): Promise<ResolvedObjectId[]> {
    const mongoConnector = getMongoConnector();
    const sourceCol = mongoConnector.getCollection(sourceCollection);
    const targetCol = mongoConnector.getCollection(targetCollection);

    if (!sourceCol || !targetCol) {
      return [];
    }

    try {
      // Find documents in target collection that have the field
      const referencingDocs = await targetCol
        .find({
          [fieldName]: { $exists: true, $type: "objectId" },
        })
        .limit(limit * 2)
        .toArray();

      if (referencingDocs.length === 0) {
        return [];
      }

      // Extract the referenced ObjectIds
      const referencedObjectIds = referencingDocs
        .map((doc) => doc[fieldName])
        .filter((id) => id instanceof ObjectId);

      // Get display information for these ObjectIds from source collection
      const referencedDocs = await sourceCol
        .find({
          _id: { $in: referencedObjectIds },
        })
        .toArray();

      return referencedDocs.map((doc) => ({
        objectId: doc._id,
        sourceCollection,
        displayInfo: this.extractDisplayInfo(doc),
        confidence: 0.9, // High confidence since these are actually referenced
      }));
    } catch (error) {
      console.error(
        `[ObjectIdResolver] Error finding referenced ObjectIds:`,
        error,
      );
      return [];
    }
  }

  /**
   * Extract display information from a document
   * @param doc Document to extract info from
   * @returns Display information object
   */
  private static extractDisplayInfo(doc: any): any {
    const displayFields = [
      "name",
      "title",
      "username",
      "email",
      "displayName",
      "firstName",
      "lastName",
    ];
    const info: any = {};

    for (const field of displayFields) {
      if (doc[field] && typeof doc[field] === "string") {
        info[field] = doc[field];
      }
    }

    // If we have firstName and lastName, create a fullName
    if (info.firstName && info.lastName) {
      info.fullName = `${info.firstName} ${info.lastName}`;
    }

    return Object.keys(info).length > 0 ? info : null;
  }

  /**
   * Get possible collections for a field name based on known mappings
   * @param fieldName Name of the field
   * @returns Array of possible collection names
   */
  private static getPossibleCollections(fieldName: string): string[] {
    // Check exact match first
    if (this.FIELD_COLLECTION_MAPPINGS[fieldName]) {
      return [...this.FIELD_COLLECTION_MAPPINGS[fieldName]];
    }

    // Check case-insensitive match
    const lowerFieldName = fieldName.toLowerCase();
    for (const [mappedField, collections] of Object.entries(
      this.FIELD_COLLECTION_MAPPINGS,
    )) {
      if (mappedField.toLowerCase() === lowerFieldName) {
        return [...collections];
      }
    }

    return [];
  }

  /**
   * Infer collection names from field name patterns
   * @param fieldName Name of the field
   * @returns Array of inferred collection names
   */
  private static inferCollectionFromFieldName(fieldName: string): string[] {
    const collections: string[] = [];
    const lowerFieldName = fieldName.toLowerCase();

    // Remove common suffixes
    const withoutSuffix = lowerFieldName
      .replace(/id$/, "")
      .replace(/_id$/, "")
      .replace(/ref$/, "")
      .replace(/_ref$/, "");

    if (withoutSuffix && withoutSuffix !== lowerFieldName) {
      // Try both singular and plural forms
      collections.push(withoutSuffix);
      collections.push(withoutSuffix + "s");

      // Try some common variations
      if (withoutSuffix.endsWith("y")) {
        collections.push(withoutSuffix.slice(0, -1) + "ies");
      }
    }

    return collections;
  }

  /**
   * Detect ObjectId fields in a payload structure
   * @param payload The payload object to analyze
   * @returns Array of field names that likely contain ObjectIds
   */
  static detectObjectIdFields(payload: any): string[] {
    const objectIdFields: string[] = [];

    if (!payload || typeof payload !== "object") {
      return objectIdFields;
    }

    Object.keys(payload).forEach((key) => {
      if (this.isLikelyObjectIdField(key, payload[key])) {
        objectIdFields.push(key);
      }
    });

    return objectIdFields;
  }

  /**
   * Check if a field is likely to contain an ObjectId
   * @param fieldName Name of the field
   * @param value Current value of the field
   * @returns True if field likely contains ObjectId
   */
  private static isLikelyObjectIdField(fieldName: string, value: any): boolean {
    const lowerFieldName = fieldName.toLowerCase();

    // Check if fieldName matches known patterns
    if (
      this.FIELD_COLLECTION_MAPPINGS[fieldName] ||
      this.FIELD_COLLECTION_MAPPINGS[lowerFieldName]
    ) {
      return true;
    }

    // Check if fieldName ends with common ObjectId suffixes
    if (
      lowerFieldName.endsWith("id") ||
      lowerFieldName.endsWith("_id") ||
      lowerFieldName.endsWith("ref") ||
      lowerFieldName.endsWith("_ref")
    ) {
      return true;
    }

    // Check if value is already an ObjectId or ObjectId-like string
    if (value instanceof ObjectId) {
      return true;
    }

    if (
      typeof value === "string" &&
      value.length === 24 &&
      /^[0-9a-fA-F]{24}$/.test(value)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Resolve multiple ObjectId fields in a payload at once
   * @param payload Payload object with potential ObjectId fields
   * @param contextCollection Context collection name
   * @returns Map of field names to their resolved ObjectIds
   */
  static async resolvePayloadObjectIds(
    payload: any,
    contextCollection?: string,
  ): Promise<Map<string, ObjectIdResolution>> {
    const results = new Map<string, ObjectIdResolution>();

    if (!payload || typeof payload !== "object") {
      return results;
    }

    const objectIdFields = this.detectObjectIdFields(payload);

    // Resolve each ObjectId field
    const resolutionPromises = objectIdFields.map(async (fieldName) => {
      const resolution = await this.resolveObjectIdField(
        fieldName,
        contextCollection,
      );
      return [fieldName, resolution] as [string, ObjectIdResolution];
    });

    const resolutions = await Promise.all(resolutionPromises);

    resolutions.forEach(([fieldName, resolution]) => {
      results.set(fieldName, resolution);
    });

    return results;
  }

  /**
   * Get a random valid ObjectId for a field from the best matching collection
   * @param fieldName Name of the field
   * @param contextCollection Context collection name
   * @returns Single ObjectId or null if none found
   */
  static async getRandomValidObjectId(
    fieldName: string,
    contextCollection?: string,
  ): Promise<ObjectId | null> {
    const resolution = await this.resolveObjectIdField(
      fieldName,
      contextCollection,
      1,
    );

    if (resolution.success && resolution.suggestedIds.length > 0) {
      return resolution.suggestedIds[0].objectId;
    }

    return null;
  }
}

/**
 * Helper function to quickly resolve an ObjectId field
 * @param fieldName Name of the field to resolve
 * @param contextCollection Optional context collection
 * @returns Promise<ObjectIdResolution>
 */
export async function resolveObjectId(
  fieldName: string,
  contextCollection?: string,
): Promise<ObjectIdResolution> {
  return await ObjectIdResolver.resolveObjectIdField(
    fieldName,
    contextCollection,
  );
}

/**
 * Helper function to get valid ObjectIds for multiple fields
 * @param fields Array of field names
 * @param contextCollection Optional context collection
 * @returns Promise<Map<string, ObjectIdResolution>>
 */
export async function resolveMultipleObjectIds(
  fields: string[],
  contextCollection?: string,
): Promise<Map<string, ObjectIdResolution>> {
  const results = new Map<string, ObjectIdResolution>();

  const promises = fields.map(async (field) => {
    const resolution = await ObjectIdResolver.resolveObjectIdField(
      field,
      contextCollection,
    );
    return [field, resolution] as [string, ObjectIdResolution];
  });

  const resolutions = await Promise.all(promises);

  resolutions.forEach(([field, resolution]) => {
    results.set(field, resolution);
  });

  return results;
}
