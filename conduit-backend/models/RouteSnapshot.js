import { Schema, model } from "mongoose";

const routeSnapshotSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    routeId: {
      type: String,
      required: true,
    },
    routePath: {
      type: String,
      required: true,
    },
    method: {
      type: String,
      required: true,
      enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
    },
    filePath: {
      type: String,
      required: true,
    },
    lineNumber: {
      type: Number,
      required: false,
    },
    // Code snapshot at the time of save
    code: {
      type: String,
      required: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
    // Predicted payload structure
    predictedPayload: {
      type: Schema.Types.Mixed,
      required: false,
    },
    // Last response data (if available)
    lastResponse: {
      status: {
        type: Number,
        required: false,
      },
      headers: {
        type: Schema.Types.Mixed,
        required: false,
      },
      body: {
        type: Schema.Types.Mixed,
        required: false,
      },
      timestamp: {
        type: Date,
        required: false,
      },
    },
    // Metadata
    metadata: {
      fileSize: {
        type: Number,
        required: false,
      },
      totalRoutes: {
        type: Number,
        required: false,
      },
      framework: {
        type: String,
        required: false,
      },
    },
    // Collection reference
    collectionId: {
      type: Schema.Types.ObjectId,
      ref: "Collection",
      required: false,
    },
    // Tags for better organization
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Compound indexes for better query performance
routeSnapshotSchema.index({ userId: 1, routeId: 1, createdAt: -1 });
routeSnapshotSchema.index({ userId: 1, collectionId: 1, createdAt: -1 });
routeSnapshotSchema.index({ codeHash: 1, userId: 1 });

// Virtual for route identifier
routeSnapshotSchema.virtual("routeIdentifier").get(function () {
  return `${this.method} ${this.routePath}`;
});

// Instance method to check if this snapshot is different from another
routeSnapshotSchema.methods.isDifferentFrom = function (otherSnapshot) {
  return this.codeHash !== otherSnapshot.codeHash;
};

// Static method to find latest snapshot for a route
routeSnapshotSchema.statics.findLatestForRoute = function (userId, routeId) {
  return this.findOne({ userId, routeId }).sort({ createdAt: -1 }).exec();
};

// Static method to get route history
routeSnapshotSchema.statics.getRouteHistory = function (
  userId,
  routeId,
  limit = 20,
) {
  return this.find({ userId, routeId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
};

const RouteSnapshot = model("RouteSnapshot", routeSnapshotSchema);

export default RouteSnapshot;
