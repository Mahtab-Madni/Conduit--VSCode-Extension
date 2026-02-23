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

  // Fetch snapshots when route changes
  useEffect(() => {
    if (selectedRoute && isAuthenticated) {
      fetchSnapshots();
    } else {
      setSnapshots([]);
      setSelectedSnapshots(new Set());
    }
  }, [selectedRoute, isAuthenticated, fetchSnapshots]);

  const fetchSnapshots = useCallback(async () => {
    if (!selectedRoute) return;

    setLoading(true);
    setError(null);

    try {
      const routeId = generateRouteId(
        selectedRoute.method,
        selectedRoute.path,
        selectedRoute.filePath,
      );

      // Send message to extension to fetch snapshots
      window.vscode.postMessage({
        type: "getRouteHistory",
        routeId: routeId,
        limit: 50,
      });
    } catch (err) {
      setError("Failed to fetch route history");
      console.error("Error fetching snapshots:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedRoute]);

  // Generate route ID (should match the backend logic)
  const generateRouteId = (method, path, filePath) => {
    const routeString = `${method.toUpperCase()}_${path}_${filePath}`;
    // Simple hash function for client-side (ideally this would use crypto)
    let hash = 0;
    for (let i = 0; i < routeString.length; i++) {
      const char = routeString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 16);
  };

  // Handle messages from extension
  useEffect(() => {
    const handleMessage = (event) => {
      const message = event.data;

      switch (message.type) {
        case "routeHistoryResponse":
          if (message.success) {
            setSnapshots(message.data || []);
          } else {
            setError(message.error || "Failed to fetch history");
          }
          setLoading(false);
          break;

        default:
          break;
      }
    };

    window.addEventListener("message", handleMessage);
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
      // Timeline mode - select snapshot
      onSnapshotSelect && onSnapshotSelect(snapshot);
    }
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

      {!loading && !error && snapshots.length === 0 && (
        <div className="empty-history">
          <p>No history found for this route</p>
          <p>History is created automatically when you save files</p>
        </div>
      )}

      {!loading && snapshots.length > 0 && (
        <div className="timeline">
          {snapshots.map((snapshot, index) => (
            <div
              key={snapshot._id}
              className={`timeline-item ${
                viewMode === "diff" && selectedSnapshots.has(snapshot._id)
                  ? "selected"
                  : ""
              }`}
              onClick={() => handleSnapshotClick(snapshot)}
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
                      className={`status-badge status-${Math.floor(snapshot.lastResponse.status / 100)}`}
                    >
                      {snapshot.lastResponse.status}
                    </span>
                  </div>
                )}
              </div>

              {index < snapshots.length - 1 && (
                <div className="timeline-line" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
