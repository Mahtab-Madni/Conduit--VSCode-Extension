import crypto from "crypto";
import { RouteSnapshot, Collection } from "../models/index.js";

/**
 * Create a new route snapshot
 * POST /api/snapshots
 */
export const createSnapshot = async (req, res) => {
  try {
    const {
      routeId,
      routePath,
      method,
      filePath,
      lineNumber,
      code,
      predictedPayload,
      lastResponse,
      metadata,
      collectionId,
      tags,
    } = req.body;

    // Create code hash for deduplication
    const codeHash = crypto.createHash("md5").update(code).digest("hex");

    // Check if we already have this exact snapshot
    const existingSnapshot = await RouteSnapshot.findOne({
      userId: req.user._id,
      routeId,
      codeHash,
    });

    if (existingSnapshot) {
      return res.json({
        message: "No changes detected, snapshot skipped",
        snapshot: existingSnapshot,
      });
    }

    const snapshot = new RouteSnapshot({
      userId: req.user._id,
      routeId,
      routePath,
      method,
      filePath,
      lineNumber,
      code,
      codeHash,
      predictedPayload,
      lastResponse,
      metadata,
      collectionId,
      tags,
    });

    await snapshot.save();

    // Update collection stats if associated with a collection
    if (collectionId) {
      const collection = await Collection.findById(collectionId);
      if (collection) {
        await collection.updateStats();
      }
    }

    res.status(201).json(snapshot);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Get snapshots for a specific route
 * GET /api/snapshots/route/:routeId
 */
export const getRouteSnapshots = async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;
    const snapshots = await RouteSnapshot.find({
      userId: req.user._id,
      routeId: req.params.routeId,
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate("collectionId", "name color")
      .exec();

    res.json(snapshots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get a single snapshot
 * GET /api/snapshots/:id
 */
export const getSnapshot = async (req, res) => {
  try {
    const snapshot = await RouteSnapshot.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).populate("collectionId", "name color");

    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot not found" });
    }

    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete a snapshot
 * DELETE /api/snapshots/:id
 */
export const deleteSnapshot = async (req, res) => {
  try {
    const snapshot = await RouteSnapshot.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot not found" });
    }

    // Update collection stats if needed
    if (snapshot.collectionId) {
      const collection = await Collection.findById(snapshot.collectionId);
      if (collection) {
        await collection.updateStats();
      }
    }

    res.json({ message: "Snapshot deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Compare two snapshots (diff)
 * POST /api/snapshots/diff
 */
export const diffSnapshots = async (req, res) => {
  try {
    const { snapshotId1, snapshotId2 } = req.body;

    const [snapshot1, snapshot2] = await Promise.all([
      RouteSnapshot.findOne({ _id: snapshotId1, userId: req.user._id }),
      RouteSnapshot.findOne({ _id: snapshotId2, userId: req.user._id }),
    ]);

    if (!snapshot1 || !snapshot2) {
      return res.status(404).json({ error: "One or both snapshots not found" });
    }

    // Simple diff implementation
    const diff = {
      code: {
        old: snapshot1.code,
        new: snapshot2.code,
        changed: snapshot1.codeHash !== snapshot2.codeHash,
      },
      payload: {
        old: snapshot1.predictedPayload,
        new: snapshot2.predictedPayload,
        changed:
          JSON.stringify(snapshot1.predictedPayload) !==
          JSON.stringify(snapshot2.predictedPayload),
      },
      timestamps: {
        old: snapshot1.createdAt,
        new: snapshot2.createdAt,
      },
    };

    res.json(diff);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
