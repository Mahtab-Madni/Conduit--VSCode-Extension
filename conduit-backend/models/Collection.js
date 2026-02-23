import { Schema, model } from "mongoose";

const collectionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: false,
      trim: true,
      maxlength: 500,
    },
    color: {
      type: String,
      required: false,
      default: "#3b82f6",
      validate: {
        validator: function (v) {
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: "Color must be a valid hex color code",
      },
    },
    // Icon for UI display
    icon: {
      type: String,
      required: false,
      default: "folder",
    },
    // Whether this collection is shared publicly
    isPublic: {
      type: Boolean,
      default: false,
    },
    // Collection settings
    settings: {
      autoSnapshot: {
        type: Boolean,
        default: true,
      },
      maxSnapshots: {
        type: Number,
        default: 100,
        min: 10,
        max: 1000,
      },
      retentionDays: {
        type: Number,
        default: 30,
        min: 1,
        max: 365,
      },
    },
    // Statistics
    stats: {
      totalSnapshots: {
        type: Number,
        default: 0,
      },
      totalRoutes: {
        type: Number,
        default: 0,
      },
      lastActivity: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes
collectionSchema.index({ userId: 1, name: 1 }, { unique: true });
collectionSchema.index({ userId: 1, updatedAt: -1 });
collectionSchema.index({ isPublic: 1, updatedAt: -1 });

// Virtual for route count
collectionSchema.virtual("routeCount", {
  ref: "RouteSnapshot",
  localField: "_id",
  foreignField: "collectionId",
  count: true,
});

// Instance method to update statistics
collectionSchema.methods.updateStats = async function () {
  const RouteSnapshot = model("RouteSnapshot");

  const stats = await RouteSnapshot.aggregate([
    { $match: { collectionId: this._id } },
    {
      $group: {
        _id: null,
        totalSnapshots: { $sum: 1 },
        uniqueRoutes: { $addToSet: "$routeId" },
        lastActivity: { $max: "$createdAt" },
      },
    },
  ]);

  if (stats.length > 0) {
    this.stats.totalSnapshots = stats[0].totalSnapshots;
    this.stats.totalRoutes = stats[0].uniqueRoutes.length;
    this.stats.lastActivity = stats[0].lastActivity;
  }

  return this.save();
};

// Static method to get user collections with stats
collectionSchema.statics.getUserCollections = function (userId) {
  return this.find({ userId })
    .populate("routeCount")
    .sort({ updatedAt: -1 })
    .exec();
};

// Pre-save middleware to update stats timestamp
collectionSchema.pre("save", function () {
  if (this.isNew || this.isModified()) {
    this.stats.lastActivity = new Date();
  }
});

const Collection = model("Collection", collectionSchema);

export default Collection;
