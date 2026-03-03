import { Router } from "express";
import { authenticateToken } from "../middleware/authentication.js";
import {
  createSnapshot,
  getRouteSnapshots,
  getSnapshot,
  deleteSnapshot,
  diffSnapshots,
} from "../controllers/SnapshotController.js";

const snapshotRouter = Router();

snapshotRouter.post("/", authenticateToken, createSnapshot);
snapshotRouter.get("/route/:routeId", authenticateToken, getRouteSnapshots);
snapshotRouter.get("/:id", authenticateToken, getSnapshot);
snapshotRouter.delete("/:id", authenticateToken, deleteSnapshot);
snapshotRouter.post("/diff", authenticateToken, diffSnapshots);

export default snapshotRouter;
