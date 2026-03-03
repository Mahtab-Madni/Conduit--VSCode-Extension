import { Collection } from "../models/index.js";

/**
 * Get all collections for authenticated user
 * GET /api/collections
 */
export const getAllCollections = async (req, res) => {
  try {
    const collections = await Collection.getUserCollections(req.user._id);
    res.json(collections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create a new collection
 * POST /api/collections
 */
export const createCollection = async (req, res) => {
  try {
    const collection = new Collection({
      ...req.body,
      userId: req.user._id,
    });
    await collection.save();
    res.status(201).json(collection);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Update a collection
 * PUT /api/collections/:id
 */
export const updateCollection = async (req, res) => {
  try {
    const collection = await Collection.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true },
    );
    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }
    res.json(collection);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Delete a collection and associated snapshots
 * DELETE /api/collections/:id
 */
export const deleteCollection = async (req, res) => {
  try {
    const collection = await Collection.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }

    // Also delete associated snapshots
    const { RouteSnapshot } = await import("../models/index.js");
    await RouteSnapshot.deleteMany({ collectionId: req.params.id });

    res.json({ message: "Collection deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
