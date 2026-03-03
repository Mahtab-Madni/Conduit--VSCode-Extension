import { Router } from "express";
import { authenticateToken } from "../middleware/authentication.js";
import {
  getAllCollections,
  createCollection,
  updateCollection,
  deleteCollection,
} from "../controllers/CollectionController.js";

const collectionRouter = Router();

collectionRouter
  .get("/", authenticateToken, getAllCollections)
  .post("/", authenticateToken, createCollection)
  .put("/:id", authenticateToken, updateCollection)
  .delete("/:id", authenticateToken, deleteCollection);

export default collectionRouter;
