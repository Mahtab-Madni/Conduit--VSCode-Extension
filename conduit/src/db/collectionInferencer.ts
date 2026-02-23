import { DetectedRoute } from "../routeDetection";

export interface CollectionInference {
  collectionName: string;
  confidence: number; // 0-1 scale
  reasoning: string;
  alternativeNames: string[];
}

export class CollectionInferencer {
  // Common patterns for route to collection mapping
  private static readonly SPECIAL_CASES: Record<string, string[]> = {
    auth: ["users", "accounts"],
    login: ["users", "accounts"],
    register: ["users", "accounts"],
    signup: ["users", "accounts"],
    signin: ["users", "accounts"],
    logout: ["users", "sessions"],
    profile: ["users", "profiles"],
    me: ["users", "profiles"],
    account: ["users", "accounts"],
    session: ["sessions", "users"],
  };

  private static readonly COMMON_PREFIXES = [
    "api",
    "v1",
    "v2",
    "v3",
    "admin",
    "public",
    "private",
  ];

  private static readonly IGNORED_SEGMENTS = [
    "api",
    "v1",
    "v2",
    "v3",
    "admin",
    "public",
    "private",
    "endpoints",
  ];

  /**
   * Infer the most likely collection name from a route
   * @param route The detected route to analyze
   * @returns Collection inference with confidence score
   */
  static inferCollectionName(route: DetectedRoute): CollectionInference {
    const pathSegments = this.parseRoutePath(route.path);

    // Try different inference strategies
    const inferences = [
      this.inferFromPathSegments(pathSegments, route),
      this.inferFromSpecialCases(pathSegments, route),
      this.inferFromRouteMethod(pathSegments, route),
      this.inferFromFileName(route.filePath),
    ];

    // Find the best inference (highest confidence)
    const bestInference = inferences.reduce((best, current) =>
      current.confidence > best.confidence ? current : best,
    );

    // Collect alternative names from all inferences
    const allAlternatives = new Set<string>();
    inferences.forEach((inference) => {
      if (inference.collectionName !== bestInference.collectionName) {
        allAlternatives.add(inference.collectionName);
      }
      inference.alternativeNames.forEach((alt) => allAlternatives.add(alt));
    });

    return {
      ...bestInference,
      alternativeNames: Array.from(allAlternatives).slice(0, 5), // Limit alternatives
    };
  }

  /**
   * Parse route path into meaningful segments
   * @param path Route path like '/api/users/:id'
   * @returns Array of path segments without parameters and prefixes
   */
  private static parseRoutePath(path: string): string[] {
    return path
      .split("/")
      .filter(
        (segment) =>
          segment &&
          !segment.startsWith(":") &&
          !segment.startsWith("*") &&
          !this.IGNORED_SEGMENTS.includes(segment.toLowerCase()),
      )
      .map((segment) => segment.toLowerCase());
  }

  /**
   * Infer collection from path segments (main strategy)
   * @param segments Clean path segments
   * @param route Original route
   * @returns Collection inference
   */
  private static inferFromPathSegments(
    segments: string[],
    route: DetectedRoute,
  ): CollectionInference {
    if (segments.length === 0) {
      return {
        collectionName: "documents",
        confidence: 0.1,
        reasoning: "No meaningful segments found, using default",
        alternativeNames: ["items", "data"],
      };
    }

    // Use the first meaningful segment (usually the resource name)
    const resourceSegment = segments[0];

    // Convert to singular form for collection name
    const collectionName = this.pluralizeToSingular(resourceSegment);
    const confidence = this.calculateSegmentConfidence(
      resourceSegment,
      route.method,
    );

    return {
      collectionName,
      confidence,
      reasoning: `Inferred from path segment: ${resourceSegment}`,
      alternativeNames: [
        resourceSegment, // keep plural form as alternative
        this.pluralizeToPlural(collectionName), // ensure plural alternative
      ].filter((name) => name !== collectionName),
    };
  }

  /**
   * Infer collection from special authentication/user routes
   * @param segments Path segments
   * @param route Original route
   * @returns Collection inference
   */
  private static inferFromSpecialCases(
    segments: string[],
    route: DetectedRoute,
  ): CollectionInference {
    for (const segment of segments) {
      if (this.SPECIAL_CASES[segment]) {
        const potentialCollections = this.SPECIAL_CASES[segment];
        return {
          collectionName: potentialCollections[0],
          confidence: 0.8,
          reasoning: `Special case mapping for '${segment}'`,
          alternativeNames: potentialCollections.slice(1),
        };
      }
    }

    // Check if this looks like an auth-related route by method and path
    if (this.isAuthRoute(route)) {
      return {
        collectionName: "users",
        confidence: 0.7,
        reasoning: "Appears to be authentication-related route",
        alternativeNames: ["accounts", "profiles"],
      };
    }

    return {
      collectionName: "unknown",
      confidence: 0.0,
      reasoning: "No special cases matched",
      alternativeNames: [],
    };
  }

  /**
   * Infer collection based on HTTP method patterns
   * @param segments Path segments
   * @param route Original route
   * @returns Collection inference
   */
  private static inferFromRouteMethod(
    segments: string[],
    route: DetectedRoute,
  ): CollectionInference {
    if (segments.length === 0) {
      return {
        collectionName: "unknown",
        confidence: 0.0,
        reasoning: "No segments to analyze",
        alternativeNames: [],
      };
    }

    const resourceSegment = segments[0];
    let confidence = 0.3; // Base confidence for method-based inference

    // Boost confidence for RESTful patterns
    const hasIdParam = route.path.includes(":id") || route.path.includes("/:");
    if (
      hasIdParam &&
      ["GET", "PUT", "PATCH", "DELETE"].includes(route.method)
    ) {
      confidence += 0.2;
    }
    if (["POST"].includes(route.method) && !hasIdParam) {
      confidence += 0.2;
    }

    const collectionName = this.pluralizeToSingular(resourceSegment);

    return {
      collectionName,
      confidence,
      reasoning: `REST pattern: ${route.method} suggests '${collectionName}' collection`,
      alternativeNames: [resourceSegment],
    };
  }

  /**
   * Infer collection from file name patterns
   * @param filePath Path to the route file
   * @returns Collection inference
   */
  private static inferFromFileName(filePath: string): CollectionInference {
    const fileName =
      filePath
        .split(/[\/\\]/)
        .pop()
        ?.replace(/\.(js|ts)$/, "") || "";
    const cleanFileName = fileName.toLowerCase();

    // Skip generic file names
    const genericNames = [
      "index",
      "routes",
      "route",
      "router",
      "app",
      "server",
      "api",
    ];
    if (genericNames.includes(cleanFileName)) {
      return {
        collectionName: "unknown",
        confidence: 0.0,
        reasoning: "Generic file name provides no collection hints",
        alternativeNames: [],
      };
    }

    // Look for collection-like names in file path
    const pathParts = filePath.toLowerCase().split(/[\/\\]/);
    const potentialCollections = pathParts
      .filter(
        (part) => !part.includes(".") && !this.IGNORED_SEGMENTS.includes(part),
      )
      .filter((part) => part.length > 2);

    if (potentialCollections.length > 0) {
      const collectionName = this.pluralizeToSingular(
        potentialCollections.pop()!,
      );
      return {
        collectionName,
        confidence: 0.4,
        reasoning: `Inferred from file path: ${fileName}`,
        alternativeNames: potentialCollections,
      };
    }

    return {
      collectionName: "unknown",
      confidence: 0.0,
      reasoning: "File path provides no collection hints",
      alternativeNames: [],
    };
  }

  /**
   * Calculate confidence score for a path segment
   * @param segment Path segment
   * @param method HTTP method
   * @returns Confidence score (0-1)
   */
  private static calculateSegmentConfidence(
    segment: string,
    method: string,
  ): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence for common REST resource names
    const commonResources = [
      "users",
      "user",
      "products",
      "product",
      "orders",
      "order",
      "items",
      "item",
      "posts",
      "post",
      "comments",
      "comment",
      "categories",
      "category",
      "tags",
      "tag",
      "files",
      "file",
    ];

    if (commonResources.includes(segment)) {
      confidence += 0.3;
    }

    // Boost confidence for plural nouns (typical REST pattern)
    if (this.isPlural(segment)) {
      confidence += 0.2;
    }

    // Method-specific confidence adjustments
    if (["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Check if a route appears to be authentication-related
   * @param route The route to check
   * @returns True if it looks like an auth route
   */
  private static isAuthRoute(route: DetectedRoute): boolean {
    const pathLower = route.path.toLowerCase();
    const authKeywords = [
      "login",
      "logout",
      "auth",
      "signin",
      "signup",
      "register",
      "token",
      "session",
    ];

    return (
      authKeywords.some((keyword) => pathLower.includes(keyword)) ||
      (route.method === "POST" && pathLower.includes("password"))
    );
  }

  /**
   * Convert plural nouns to singular (simple implementation)
   * @param word Potentially plural word
   * @returns Singular form of the word
   */
  private static pluralizeToSingular(word: string): string {
    const singularRules = [
      { pattern: /ies$/, replacement: "y" }, // categories -> category
      { pattern: /ves$/, replacement: "f" }, // shelves -> shelf
      { pattern: /s$/, replacement: "" }, // users -> user
    ];

    for (const rule of singularRules) {
      if (rule.pattern.test(word)) {
        return word.replace(rule.pattern, rule.replacement);
      }
    }

    return word;
  }

  /**
   * Convert singular nouns to plural (simple implementation)
   * @param word Singular word
   * @returns Plural form of the word
   */
  private static pluralizeToPlural(word: string): string {
    const pluralRules = [
      { pattern: /y$/, replacement: "ies" }, // category -> categories
      { pattern: /f$/, replacement: "ves" }, // shelf -> shelves
      { pattern: /$/, replacement: "s" }, // user -> users
    ];

    for (const rule of pluralRules) {
      if (rule.pattern.test(word)) {
        return word.replace(rule.pattern, rule.replacement);
      }
    }

    return word + "s";
  }

  /**
   * Simple check if a word is likely plural
   * @param word Word to check
   * @returns True if word appears to be plural
   */
  private static isPlural(word: string): boolean {
    return word.endsWith("s") || word.endsWith("ies") || word.endsWith("ves");
  }

  /**
   * Get multiple collection name suggestions for a route
   * @param route The route to analyze
   * @returns Array of collection suggestions ordered by confidence
   */
  static getCollectionSuggestions(route: DetectedRoute): CollectionInference[] {
    const primary = this.inferCollectionName(route);
    const suggestions = [primary];

    // Add alternative suggestions with lower confidence
    primary.alternativeNames.forEach((altName) => {
      if (altName !== primary.collectionName) {
        suggestions.push({
          collectionName: altName,
          confidence: Math.max(0.1, primary.confidence - 0.3),
          reasoning: `Alternative to ${primary.collectionName}`,
          alternativeNames: [],
        });
      }
    });

    // Sort by confidence
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }
}

/**
 * Helper function to get the most likely collection name for a route
 * @param route The route to analyze
 * @returns The most likely collection name
 */
export function inferCollectionName(route: DetectedRoute): string {
  const inference = CollectionInferencer.inferCollectionName(route);
  return inference.collectionName;
}

/**
 * Helper function to get collection suggestions with confidence scores
 * @param route The route to analyze
 * @returns Array of collection suggestions
 */
export function getCollectionSuggestions(
  route: DetectedRoute,
): CollectionInference[] {
  return CollectionInferencer.getCollectionSuggestions(route);
}
