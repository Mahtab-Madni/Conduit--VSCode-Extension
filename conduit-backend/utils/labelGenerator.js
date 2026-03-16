/**
 * Label Generator Utility
 * Automatically generates human-readable descriptions of what changed between snapshots
 */

/**
 * Generates an auto-label for a new snapshot based on comparison with the previous one
 * @param {Object} lastSnapshot - The previous snapshot (null if first ever)
 * @param {Object} newSnapshotData - The new snapshot data
 * @returns {string} Human-readable label describing the changes
 */
export function autoGenerateLabel(lastSnapshot, newSnapshotData) {
  // ── Case 1: First ever snapshot ──────────────────────────
  if (!lastSnapshot) {
    return "Initial version";
  }

  const parts = []; // collect all change descriptions

  // ── Case 7: Route path changed ───────────────────────────
  if (lastSnapshot.routePath !== newSnapshotData.routePath) {
    parts.push(`Route renamed to ${newSnapshotData.routePath}`);
  }

  // ── Case 6: Middleware changed ───────────────────────────
  const oldMw = lastSnapshot.middleware || [];
  const newMw = newSnapshotData.middleware || [];
  const addedMw = newMw.filter((m) => !oldMw.includes(m));
  const removedMw = oldMw.filter((m) => !newMw.includes(m));

  if (addedMw.length > 0) {
    parts.push(`Added middleware: ${addedMw.join(", ")}`);
  }
  if (removedMw.length > 0) {
    parts.push(`Removed middleware: ${removedMw.join(", ")}`);
  }

  // ── Cases 2, 3, 4: Payload fields changed ────────────────
  const oldPayload = lastSnapshot.predictedPayload || {};
  const newPayload = newSnapshotData.predictedPayload || {};

  const oldFields = Object.keys(oldPayload);
  const newFields = Object.keys(newPayload);

  const addedFields = newFields.filter((f) => !oldFields.includes(f));
  const removedFields = oldFields.filter((f) => !newFields.includes(f));

  if (addedFields.length > 0) {
    parts.push(`Added ${addedFields.join(", ")}`);
  }
  if (removedFields.length > 0) {
    parts.push(`Removed ${removedFields.join(", ")}`);
  }

  // ── Case 5: Code changed but payload is same ─────────────
  if (parts.length === 0) {
    // If payload is empty on both sides, describe by code change character count
    if (oldFields.length === 0 && newFields.length === 0) {
      const oldCodeLength = lastSnapshot.code?.length || 0;
      const newCodeLength = newSnapshotData.code?.length || 0;
      const diff = Math.abs(newCodeLength - oldCodeLength);
      return `Code updated (~${diff} characters changed)`;
    }

    // Otherwise, code changed internally without payload impact
    return "Controller logic updated";
  }

  // Join all parts with middot separator
  // e.g. "Added shippingAddress · Removed notes · Added middleware: verifyToken"
  return parts.join(" · ");
}

/**
 * Compares two snapshots and returns a detailed diff object
 * Useful for generating detailed change descriptions or diff views
 * @param {Object} snapshot1 - First snapshot
 * @param {Object} snapshot2 - Second snapshot
 * @returns {Object} Detailed comparison object
 */
export function compareSnapshots(snapshot1, snapshot2) {
  const oldPayload = snapshot1.predictedPayload || {};
  const newPayload = snapshot2.predictedPayload || {};

  const oldFields = Object.keys(oldPayload);
  const newFields = Object.keys(newPayload);

  const addedFields = newFields.filter((f) => !oldFields.includes(f));
  const removedFields = oldFields.filter((f) => !newFields.includes(f));
  const unchangedFields = oldFields.filter((f) => newFields.includes(f));

  return {
    addedFields,
    removedFields,
    unchangedFields,
    oldPayload,
    newPayload,
    addedMiddleware: (snapshot2.middleware || []).filter(
      (m) => !(snapshot1.middleware || []).includes(m),
    ),
    removedMiddleware: (snapshot1.middleware || []).filter(
      (m) => !(snapshot2.middleware || []).includes(m),
    ),
    pathChanged:
      snapshot1.routePath !== snapshot2.routePath ||
      snapshot1.method !== snapshot2.method,
    codeChanged: snapshot1.codeHash !== snapshot2.codeHash,
  };
}

/**
 * Formats a comparison for display in UI
 * @param {Object} comparison - Output from compareSnapshots()
 * @returns {Array} Array of formatted change objects
 */
export function formatComparisonForUI(comparison) {
  const changes = [];

  if (comparison.addedFields.length > 0) {
    changes.push({
      type: "added",
      category: "fields",
      items: comparison.addedFields,
      description: `Added ${comparison.addedFields.join(", ")}`,
    });
  }

  if (comparison.removedFields.length > 0) {
    changes.push({
      type: "removed",
      category: "fields",
      items: comparison.removedFields,
      description: `Removed ${comparison.removedFields.join(", ")}`,
    });
  }

  if (comparison.addedMiddleware.length > 0) {
    changes.push({
      type: "added",
      category: "middleware",
      items: comparison.addedMiddleware,
      description: `Added middleware: ${comparison.addedMiddleware.join(", ")}`,
    });
  }

  if (comparison.removedMiddleware.length > 0) {
    changes.push({
      type: "removed",
      category: "middleware",
      items: comparison.removedMiddleware,
      description: `Removed middleware: ${comparison.removedMiddleware.join(", ")}`,
    });
  }

  if (comparison.pathChanged) {
    changes.push({
      type: "modified",
      category: "route",
      description: "Route path or method changed",
    });
  }

  if (comparison.codeChanged && changes.length === 0) {
    changes.push({
      type: "modified",
      category: "code",
      description: "Internal controller logic updated",
    });
  }

  return changes;
}
