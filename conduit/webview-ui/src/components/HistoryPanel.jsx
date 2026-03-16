import React, { useState, useEffect, useCallback } from "react";
import "./HistoryPanel.css";

const HistoryPanel = ({
  selectedRoute,
  onSnapshotSelect,
  onDiffSelect,
  isAuthenticated,
  onLogin,
}) => {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSnapshots, setSelectedSnapshots] = useState(new Set());
  const [viewMode, setViewMode] = useState("timeline"); // 'timeline' or 'diff'
  const [searchQuery, setSearchQuery] = useState("");
  const [filterModeSelection, setFilterModeSelection] = useState(null);
  const [expandedSnapshot, setExpandedSnapshot] = useState(null);
  const [editingNotes, setEditingNotes] = useState({});
  const [editingTags, setEditingTags] = useState({});

  // Debug logging
  useEffect(() => {
    console.log("[HistoryPanel] Component mounted/updated", {
      isAuthenticated,
      selectedRoute: selectedRoute?.path,
      loading,
      snapshotsCount: snapshots.length,
      error,
    });
  }, [isAuthenticated, selectedRoute, loading, snapshots, error]);

  // Fetch snapshots when route changes
  useEffect(() => {
    if (selectedRoute && isAuthenticated) {
      fetchSnapshots();
    } else {
      setSnapshots([]);
      setSelectedSnapshots(new Set());
    }
  }, [selectedRoute, isAuthenticated]);

  const fetchSnapshots = useCallback(() => {
    if (!selectedRoute) return;

    console.log(
      "[HistoryPanel] fetchSnapshots called for route:",
      selectedRoute.path,
    );
    setLoading(true);
    setError(null);

    try {
      console.log(
        "[HistoryPanel] Sending getRouteHistory message with route:",
        {
          method: selectedRoute.method,
          path: selectedRoute.path,
          filePath: selectedRoute.filePath,
        },
      );

      // Send message to extension to fetch snapshots
      // Let the extension calculate the correct routeId using MD5
      window.vscode.postMessage({
        command: "getRouteHistory",
        route: {
          method: selectedRoute.method,
          path: selectedRoute.path,
          filePath: selectedRoute.filePath,
        },
        limit: 50,
      });
    } catch (err) {
      setError("Failed to fetch route history");
      console.error("Error fetching snapshots:", err);
      setLoading(false);
    }
  }, [selectedRoute]);

  // Handle messages from extension
  useEffect(() => {
    const handleMessage = (event) => {
      const message = event.data;
      console.log("[HistoryPanel] Message received:", message);

      switch (message.command) {
        case "routeHistoryResponse":
          console.log("[HistoryPanel] Route history response:", {
            success: message.success,
            dataLength: message.data?.length,
            error: message.error,
          });
          if (message.success) {
            setSnapshots(message.data || []);
          } else {
            setError(message.error || "Failed to fetch history");
          }
          setLoading(false);
          break;

        case "snapshotNotesSaved":
          // Update snapshot in local state
          setSnapshots((prev) =>
            prev.map((snap) =>
              snap._id === message.snapshotId
                ? { ...snap, notes: message.notes }
                : snap,
            ),
          );
          setEditingNotes((prev) => {
            const updated = { ...prev };
            delete updated[message.snapshotId];
            return updated;
          });
          break;

        case "snapshotTagsUpdated":
          // Update snapshot in local state
          setSnapshots((prev) =>
            prev.map((snap) =>
              snap._id === message.snapshotId
                ? { ...snap, tags: message.tags }
                : snap,
            ),
          );
          setEditingTags((prev) => {
            const updated = { ...prev };
            delete updated[message.snapshotId];
            return updated;
          });
          break;

        case "snapshotRestored":
          console.log("[HistoryPanel] Snapshot restored:", message.snapshotId);
          break;

        default:
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    console.log("[HistoryPanel] Message listener registered");
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleSnapshotClick = (snapshot) => {
    if (viewMode === "diff") {
      const newSelected = new Set(selectedSnapshots);

      if (newSelected.has(snapshot._id)) {
        newSelected.delete(snapshot._id);
      } else if (newSelected.size < 2) {
        newSelected.add(snapshot._id);
      } else {
        // Replace oldest selection
        const [firstId] = newSelected;
        newSelected.delete(firstId);
        newSelected.add(snapshot._id);
      }

      setSelectedSnapshots(newSelected);

      // If we have 2 selections, trigger diff
      if (newSelected.size === 2) {
        const [id1, id2] = Array.from(newSelected);
        onDiffSelect && onDiffSelect(id1, id2);
      }
    } else {
      // Timeline mode - select snapshot and show details
      onSnapshotSelect && onSnapshotSelect(snapshot);
      setExpandedSnapshot(
        expandedSnapshot === snapshot._id ? null : snapshot._id,
      );
    }
  };

  const handleRestoreSnapshot = (snapshot) => {
    window.vscode.postMessage({
      command: "restoreSnapshot",
      snapshotId: snapshot._id,
      snapshot: snapshot,
    });
  };

  const handleSaveNotes = (snapshotId, notes) => {
    window.vscode.postMessage({
      command: "updateSnapshotNotes",
      snapshotId: snapshotId,
      notes: notes,
    });
  };

  const handleSaveTags = (snapshotId, tags) => {
    window.vscode.postMessage({
      command: "updateSnapshotTags",
      snapshotId: snapshotId,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t),
    });
  };

  const toggleViewMode = () => {
    const newMode = viewMode === "timeline" ? "diff" : "timeline";
    setViewMode(newMode);
    setSelectedSnapshots(new Set());
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString();
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getSnapshotIcon = (snapshot) => {
    if (snapshot.metadata?.framework) {
      switch (snapshot.metadata.framework) {
        case "express":
          return "🟢";
        case "fastapi":
          return "🟡";
        case "django":
          return "🔵";
        case "next.js":
          return "⚫";
        default:
          return "📄";
      }
    }
    return "📄";
  };

  // Filter snapshots based on search query
  const filteredSnapshots = snapshots.filter((snapshot) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    // Search in tags, notes, label, and response status
    return (
      (snapshot.tags && snapshot.tags.some((tag) => tag.includes(query))) ||
      (snapshot.notes && snapshot.notes.toLowerCase().includes(query)) ||
      (snapshot.label && snapshot.label.toLowerCase().includes(query)) ||
      (snapshot.lastResponse &&
        (snapshot.lastResponse.statusCode || snapshot.lastResponse.status)
          ?.toString()
          .includes(query))
    );
  });

  if (!isAuthenticated) {
    return (
      <div className="history-panel">
        <div className="history-header">
          <h3>Route History</h3>
        </div>
        <div className="auth-required">
          <div className="auth-content">
            <p>🔒 Authentication Required</p>
            <p>
              Sign in with GitHub to view and sync route history across devices.
            </p>
            <button className="login-button" onClick={onLogin}>
              Sign in with GitHub
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedRoute) {
    return (
      <div className="history-panel">
        <div className="history-header">
          <h3>Route History</h3>
        </div>
        <div className="no-selection">
          <p>Select a route to view its history</p>
        </div>
      </div>
    );
  }

  return (
    <div className="history-panel">
      <div className="history-header">
        <h3>Route History</h3>
        <div className="history-controls">
          <button
            className={`mode-button ${viewMode === "timeline" ? "active" : ""}`}
            onClick={() => setViewMode("timeline")}
          >
            Timeline
          </button>
          <button
            className={`mode-button ${viewMode === "diff" ? "active" : ""}`}
            onClick={() => setViewMode("diff")}
          >
            Compare
          </button>
          <button
            className="refresh-button"
            onClick={fetchSnapshots}
            disabled={loading}
            title="Refresh history"
          >
            🔄
          </button>
        </div>
      </div>

      <div className="route-info">
        <span className={`method-badge ${selectedRoute.method.toLowerCase()}`}>
          {selectedRoute.method}
        </span>
        <span className="route-path">{selectedRoute.path}</span>
      </div>

      {/* Search and filter section */}
      {snapshots.length > 0 && (
        <div className="history-search">
          <input
            type="text"
            placeholder="Search by tags, notes, label, status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <span className="search-results">
              {filteredSnapshots.length} of {snapshots.length}
            </span>
          )}
        </div>
      )}

      {viewMode === "diff" && (
        <div className="diff-instructions">
          {selectedSnapshots.size === 0 && (
            <p>Select two snapshots to compare</p>
          )}
          {selectedSnapshots.size === 1 && (
            <p>Select one more snapshot to compare</p>
          )}
          {selectedSnapshots.size === 2 && <p>Comparing selected snapshots</p>}
        </div>
      )}

      {loading && (
        <div className="loading">
          <p>Loading history...</p>
        </div>
      )}

      {error && (
        <div className="error">
          <p>⚠️ {error}</p>
          <button onClick={fetchSnapshots}>Retry</button>
        </div>
      )}

      {!loading && !error && filteredSnapshots.length === 0 && (
        <div className="empty-history">
          <p>
            {snapshots.length === 0
              ? "No history found for this route"
              : "No snapshots match your search"}
          </p>
          <p>History is created automatically when you save files</p>
        </div>
      )}

      {!loading && filteredSnapshots.length > 0 && (
        <div className="timeline">
          {filteredSnapshots.map((snapshot, index) => (
            <div
              key={snapshot._id}
              className={`timeline-item ${
                viewMode === "diff" && selectedSnapshots.has(snapshot._id)
                  ? "selected"
                  : ""
              } ${expandedSnapshot === snapshot._id ? "expanded" : ""}`}
            >
              <div
                className="timeline-header"
                onClick={() => handleSnapshotClick(snapshot)}
                style={{
                  cursor: viewMode === "timeline" ? "pointer" : "default",
                }}
              >
                <div className="timeline-marker">
                  <span className="snapshot-icon">
                    {getSnapshotIcon(snapshot)}
                  </span>
                </div>

                <div className="timeline-content">
                  <div className="snapshot-header">
                    <span className="snapshot-date">
                      {formatDate(snapshot.createdAt)}
                    </span>
                    {snapshot.collectionId && (
                      <span className="collection-badge">
                        {snapshot.collectionId.name}
                      </span>
                    )}
                  </div>

                  {/* Display auto-generated label prominently */}
                  {(snapshot.label || snapshot.description) && (
                    <div className="snapshot-label">
                      <span className="label-text">
                        {snapshot.label || snapshot.description}
                      </span>
                    </div>
                  )}

                  <div className="snapshot-details">
                    {snapshot.metadata?.framework && (
                      <span className="framework-badge">
                        {snapshot.metadata.framework}
                      </span>
                    )}

                    {snapshot.metadata?.fileSize && (
                      <span className="file-size">
                        {Math.round(snapshot.metadata.fileSize / 1024)}KB
                      </span>
                    )}
                  </div>

                  {snapshot.predictedPayload && (
                    <div className="payload-preview">
                      <span className="payload-label">Payload:</span>
                      <span className="payload-fields">
                        {Object.keys(snapshot.predictedPayload).length} fields
                      </span>
                    </div>
                  )}

                  {snapshot.lastResponse && (
                    <div className="response-preview">
                      <span
                        className={`status-badge status-${Math.floor((snapshot.lastResponse.statusCode || snapshot.lastResponse.status || 0) / 100)}`}
                      >
                        {snapshot.lastResponse.statusCode ||
                          snapshot.lastResponse.status}
                      </span>
                    </div>
                  )}

                  {/* Tags display */}
                  {snapshot.tags && snapshot.tags.length > 0 && (
                    <div className="tags-display">
                      {snapshot.tags.map((tag) => (
                        <span key={tag} className="tag-badge">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {index < filteredSnapshots.length - 1 && (
                  <div className="timeline-line" />
                )}
              </div>

              {/* Expanded details section */}
              {expandedSnapshot === snapshot._id && (
                <div className="snapshot-detail-panel">
                  {/* Notes section */}
                  <div className="detail-section">
                    <label className="section-title">📝 Notes</label>
                    {editingNotes[snapshot._id] !== undefined ? (
                      <div className="note-edit">
                        <textarea
                          value={editingNotes[snapshot._id]}
                          onChange={(e) =>
                            setEditingNotes((prev) => ({
                              ...prev,
                              [snapshot._id]: e.target.value,
                            }))
                          }
                          placeholder="Add notes about this snapshot..."
                          className="note-textarea"
                        />
                        <div className="note-actions">
                          <button
                            onClick={() =>
                              handleSaveNotes(
                                snapshot._id,
                                editingNotes[snapshot._id],
                              )
                            }
                            className="note-save"
                          >
                            Save
                          </button>
                          <button
                            onClick={() =>
                              setEditingNotes((prev) => {
                                const updated = { ...prev };
                                delete updated[snapshot._id];
                                return updated;
                              })
                            }
                            className="note-cancel"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="note-display">
                        <p className="note-text">
                          {snapshot.notes && snapshot.notes.trim() ? (
                            snapshot.notes
                          ) : (
                            <span className="no-notes">No notes added</span>
                          )}
                        </p>
                        <button
                          onClick={() =>
                            setEditingNotes((prev) => ({
                              ...prev,
                              [snapshot._id]: snapshot.notes || "",
                            }))
                          }
                          className="edit-note-btn"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Tags section */}
                  <div className="detail-section">
                    <label className="section-title">🏷️ Tags</label>
                    {editingTags[snapshot._id] !== undefined ? (
                      <div className="tags-edit">
                        <input
                          type="text"
                          value={editingTags[snapshot._id]}
                          onChange={(e) =>
                            setEditingTags((prev) => ({
                              ...prev,
                              [snapshot._id]: e.target.value,
                            }))
                          }
                          placeholder="Enter tags separated by commas"
                          className="tags-input"
                        />
                        <div className="tags-actions">
                          <button
                            onClick={() =>
                              handleSaveTags(
                                snapshot._id,
                                editingTags[snapshot._id],
                              )
                            }
                            className="tags-save"
                          >
                            Save
                          </button>
                          <button
                            onClick={() =>
                              setEditingTags((prev) => {
                                const updated = { ...prev };
                                delete updated[snapshot._id];
                                return updated;
                              })
                            }
                            className="tags-cancel"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="tags-display-edit">
                        <div className="tags-list">
                          {snapshot.tags && snapshot.tags.length > 0 ? (
                            snapshot.tags.map((tag) => (
                              <span key={tag} className="tag-badge">
                                #{tag}
                              </span>
                            ))
                          ) : (
                            <span className="no-tags">No tags</span>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            setEditingTags((prev) => ({
                              ...prev,
                              [snapshot._id]: snapshot.tags?.join(", ") || "",
                            }))
                          }
                          className="edit-tags-btn"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Restore section */}
                  <div className="detail-section">
                    <label className="section-title">♻️ Restore</label>
                    <button
                      onClick={() => handleRestoreSnapshot(snapshot)}
                      className="restore-button"
                    >
                      Load Payload & Code
                    </button>
                    <p className="restore-hint">
                      Load this snapshot's payload into the editor and code view
                    </p>
                  </div>

                  {/* Response info */}
                  {snapshot.lastResponse && (
                    <div className="detail-section">
                      <label className="section-title">📋 Last Response</label>
                      <div className="response-info">
                        <div className="response-status">
                          <span className="label">Status:</span>
                          <span
                            className={`status-badge status-${Math.floor(snapshot.lastResponse.status / 100)}`}
                          >
                            {snapshot.lastResponse.status}
                          </span>
                        </div>
                        {snapshot.lastResponse.timestamp && (
                          <div className="response-time">
                            <span className="label">Timestamp:</span>
                            <span className="value">
                              {new Date(
                                snapshot.lastResponse.timestamp,
                              ).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
