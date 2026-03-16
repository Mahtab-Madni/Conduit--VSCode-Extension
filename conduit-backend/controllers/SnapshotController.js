import crypto from "crypto";
import { RouteSnapshot, Collection } from "../models/index.js";
import {
  autoGenerateLabel,
  compareSnapshots,
  formatComparisonForUI,
} from "../utils/labelGenerator.js";

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
      middleware = [],
      fullPath,
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

    // Fetch the last snapshot for this route to generate a label
    const lastSnapshot = await RouteSnapshot.findOne({
      userId: req.user._id,
      routeId,
    }).sort({ createdAt: -1 });

    // Generate auto-label based on comparison with previous snapshot
    const newSnapshotData = {
      routePath,
      method,
      code,
      codeHash,
      predictedPayload,
      middleware,
      fullPath,
    };

    const autoLabel = autoGenerateLabel(lastSnapshot, newSnapshotData);

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
      middleware,
      fullPath: fullPath || routePath,
      label: autoLabel,
      description: autoLabel, // Keep for backwards compatibility
    });

    await snapshot.save();

    console.log(
      `[CreateSnapshot] Created snapshot with label: "${autoLabel}" for route ${routePath}`,
    );

    // Update collection stats if associated with a collection
    if (collectionId) {
      const collection = await Collection.findById(collectionId);
      if (collection) {
        await collection.updateStats();
      }
    }

    res.status(201).json(snapshot.toObject());
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

    // Generate labels for snapshots that don't have them yet
    const snapshotsWithLabels = snapshots.map((snapshot, idx) => {
      const snapshotObj = snapshot.toObject ? snapshot.toObject() : snapshot;

      // If snapshot already has label, return with it
      if (snapshotObj.label && snapshotObj.label.trim()) {
        console.log(`[Snapshot] Already has label: "${snapshotObj.label}"`);
        return snapshotObj;
      }

      let generatedLabel = "Initial version";
      const previousSnapshot =
        idx < snapshots.length - 1 ? snapshots[idx + 1] : null;

      if (previousSnapshot) {
        const newSnapshotData = {
          routePath: snapshotObj.routePath,
          method: snapshotObj.method,
          code: snapshotObj.code,
          codeHash: snapshotObj.codeHash,
          predictedPayload: snapshotObj.predictedPayload,
          middleware: snapshotObj.middleware || [],
          fullPath: snapshotObj.fullPath,
        };

        generatedLabel = autoGenerateLabel(previousSnapshot, newSnapshotData);
        console.log(
          `[Snapshot] Generated label: "${generatedLabel}" for route ${snapshotObj.routePath}`,
        );

        // Save label in background without blocking response
        if (!snapshotObj.label || !snapshotObj.label.trim()) {
          snapshot.label = generatedLabel;
          snapshot.description = generatedLabel;
          snapshot.save().catch(() => {});
        }
      } else {
        console.log(`[Snapshot] First snapshot, label: "${generatedLabel}"`);
      }

      return {
        ...snapshotObj,
        label: generatedLabel,
        description: generatedLabel,
      };
    });

    console.log(
      `[GetRouteSnapshots] Returning ${snapshotsWithLabels.length} snapshots with labels:`,
      snapshotsWithLabels.map((s) => ({
        routePath: s.routePath,
        label: s.label,
      })),
    );

    res.json(snapshotsWithLabels);
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

    // Get detailed comparison
    const comparison = compareSnapshots(snapshot1, snapshot2);
    const formattedChanges = formatComparisonForUI(comparison);

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
        ...comparison,
      },
      response: {
        old: snapshot1.lastResponse,
        new: snapshot2.lastResponse,
      },
      middleware: {
        old: snapshot1.middleware || [],
        new: snapshot2.middleware || [],
        changed:
          JSON.stringify(snapshot1.middleware) !==
          JSON.stringify(snapshot2.middleware),
      },
      route: {
        old: `${snapshot1.method} ${snapshot1.routePath}`,
        new: `${snapshot2.method} ${snapshot2.routePath}`,
        changed:
          snapshot1.routePath !== snapshot2.routePath ||
          snapshot1.method !== snapshot2.method,
      },
      timestamps: {
        old: snapshot1.createdAt,
        new: snapshot2.createdAt,
      },
      summary: formattedChanges,
    };

    res.json(diff);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update snapshot metadata (tags, notes, description)
 * PATCH /api/snapshots/:id
 */
export const updateSnapshot = async (req, res) => {
  try {
    const { id } = req.params;
    const { tags, notes, description } = req.body;

    const snapshot = await RouteSnapshot.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot not found" });
    }

    // Only allow updating specific fields
    if (tags !== undefined) {
      snapshot.tags = tags.map((tag) => tag.toLowerCase().trim());
    }
    if (notes !== undefined) {
      snapshot.notes = notes;
    }
    if (description !== undefined) {
      snapshot.description = description;
    }

    await snapshot.save();

    res.json({
      message: "Snapshot updated successfully",
      snapshot,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Save a checkpoint — intentional, user-controlled snapshot
 * This is different from auto-snapshots. User explicitly decides when to checkpoint.
 * POST /api/snapshots/checkpoint
 *
 * Body:
 * {
 *   routeId: string,
 *   routePath: string,
 *   method: string,
 *   code: string,
 *   label: string (REQUIRED - user message like git commit),
 *   lastPayload: object (payload used to test this route),
 *   lastResponse: { statusCode, body, responseTime, testedAt },
 *   filePath: string,
 *   lineNumber?: number,
 *   metadata?: object,
 *   collectionId?: string,
 *   tags?: string[],
 *   middleware?: string[],
 *   fullPath?: string,
 * }
 */
export const saveCheckpoint = async (req, res) => {
  try {
    const {
      routeId,
      routePath,
      method,
      code,
      label,
      lastPayload,
      lastResponse,
      filePath,
      lineNumber,
      metadata,
      collectionId,
      tags = [],
      middleware = [],
      fullPath,
    } = req.body;

    // Validate required fields
    if (!routeId || !routePath || !method || !code || !label) {
      return res.status(400).json({
        error:
          "Missing required fields: routeId, routePath, method, code, label",
      });
    }

    if (!label.trim()) {
      return res.status(400).json({
        error: "Checkpoint label cannot be empty",
      });
    }

    // Create code hash for deduplication
    const codeHash = crypto.createHash("md5").update(code).digest("hex");

    // Create the checkpoint snapshot
    const checkpoint = new RouteSnapshot({
      userId: req.user._id,
      routeId,
      routePath,
      method,
      filePath,
      lineNumber,
      code,
      codeHash,
      lastPayload,
      lastResponse,
      metadata,
      collectionId,
      tags: tags.map((tag) => tag.toLowerCase().trim()),
      middleware,
      fullPath: fullPath || routePath,
      label: label.trim(),
      description: label.trim(),
      isCheckpoint: true, // Mark this as an intentional checkpoint
    });

    await checkpoint.save();

    console.log(
      `[SaveCheckpoint] User ${req.user._id} created checkpoint "${label}" for route ${method} ${routePath}`,
    );

    // Update collection stats if associated with a collection
    if (collectionId) {
      const collection = await Collection.findById(collectionId);
      if (collection) {
        await collection.updateStats();
      }
    }

    res.status(201).json({
      message: "Checkpoint saved successfully",
      checkpoint: checkpoint.toObject(),
    });
  } catch (error) {
    console.error("[SaveCheckpoint] Error:", error.message);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Restore a snapshot (get full snapshot details for restoration)
 * GET /api/snapshots/:id/restore
 */
export const restoreSnapshot = async (req, res) => {
  try {
    const { id } = req.params;

    const snapshot = await RouteSnapshot.findOne({
      _id: id,
      userId: req.user._id,
    }).populate("collectionId", "name color");

    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot not found" });
    }

    // Return snapshot in a format suitable for restoration
    res.json({
      success: true,
      data: {
        id: snapshot._id,
        routePath: snapshot.routePath,
        method: snapshot.method,
        code: snapshot.code,
        predictedPayload: snapshot.predictedPayload,
        filePath: snapshot.filePath,
        createdAt: snapshot.createdAt,
        notes: snapshot.notes,
        tags: snapshot.tags,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
