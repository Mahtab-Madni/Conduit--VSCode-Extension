import React, { useState } from "react";
import "./DiffView.css";

const DiffView = ({ snapshot1, snapshot2, diff, onClose }) => {
  const [viewType, setViewType] = useState("payload"); // 'payload' or 'code'
  const [showSideBySide, setShowSideBySide] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%, 0.8 = 80%, etc.

  if (!snapshot1 || !snapshot2 || !diff) {
    return null;
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getTimeDifference = () => {
    const time1 = new Date(snapshot1.createdAt).getTime();
    const time2 = new Date(snapshot2.createdAt).getTime();
    const diffMs = Math.abs(time2 - time1);
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? "s" : ""} apart`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} apart`;
    } else if (diffMins > 0) {
      return `${diffMins} minute${diffMins > 1 ? "s" : ""} apart`;
    } else {
      return `${diffSecs} second${diffSecs > 1 ? "s" : ""} apart`;
    }
  };

  // Simple diff algorithm - find common lines
  const computeLineDiff = (oldLines, newLines) => {
    const lineMap = new Map();
    const oldMarked = new Array(oldLines.length).fill(false);
    const newMarked = new Array(newLines.length).fill(false);

    // Mark identical lines
    for (let i = 0; i < oldLines.length; i++) {
      for (let j = 0; j < newLines.length; j++) {
        if (!oldMarked[i] && !newMarked[j] && oldLines[i] === newLines[j]) {
          oldMarked[i] = true;
          newMarked[j] = true;
          break;
        }
      }
    }

    return {
      oldMarked,
      newMarked,
      getLineType: (isOld, index) => {
        const marked = isOld ? oldMarked[index] : newMarked[index];
        return marked ? "unchanged" : "changed";
      },
    };
  };

  const renderPayloadDiff = () => {
    // Build complete request-response details from snapshots
    const buildRequestDetails = (snapshot) => {
      const details = {
        "Request URL": snapshot.lastRequest?.url || snapshot.routePath || "N/A",
        Method: snapshot.lastRequest?.method || snapshot.method || "N/A",
        Headers: snapshot.lastRequest?.headers || {},
        "Request Body":
          snapshot.lastRequest?.body || snapshot.lastPayload || {},
        "Response Status": snapshot.lastResponse?.statusCode || "N/A",
        "Response Body": snapshot.lastResponse?.body || {},
        "Tested At":
          snapshot.lastRequest?.testedAt || snapshot.updatedAt || "N/A",
      };
      return details;
    };

    const oldDetails = buildRequestDetails(snapshot1);
    const newDetails = buildRequestDetails(snapshot2);

    // Function to compare and highlight differences
    const renderJsonWithDiff = (current, other, isOld) => {
      const lines = JSON.stringify(current, null, 2).split("\n");
      const otherStr = JSON.stringify(other, null, 2);

      return lines.map((line, idx) => {
        const lineContent = line;
        // Extract the key from the line
        const keyMatch = line.match(/^\s*"([^"]+)"\s*:/);
        const key = keyMatch ? keyMatch[1] : null;

        // Check if this line exists in the other version and if values differ
        let isChanged = false;
        let isAdded = false;
        let isRemoved = false;

        if (key) {
          const keyInOther = otherStr.includes(`"${key}"`);
          if (!keyInOther) {
            isAdded = !isOld;
            isRemoved = isOld;
          } else {
            // Check if value differs
            const currentValue = JSON.stringify(current[key]);
            const otherValue = JSON.stringify(other[key]);
            if (currentValue !== otherValue) {
              isChanged = true;
            }
          }
        }

        const bgColor = isChanged
          ? "rgba(255, 193, 7, 0.2)"
          : isAdded
            ? "rgba(76, 175, 80, 0.2)"
            : isRemoved
              ? "rgba(244, 67, 54, 0.2)"
              : "transparent";

        const borderColor =
          isChanged || isAdded || isRemoved ? "1px solid" : "none";
        const borderColorValue = isChanged
          ? "#ff9800"
          : isAdded
            ? "#4caf50"
            : isRemoved
              ? "#f44336"
              : "transparent";

        return (
          <div
            key={idx}
            style={{
              background: bgColor,
              borderLeft: borderColor + " " + borderColorValue,
              paddingLeft: "4px",
              margin: "1px 0",
            }}
          >
            {lineContent}
          </div>
        );
      });
    };

    if (showSideBySide) {
      return (
        <div className="side-by-side">
          <div className="diff-column old">
            <h4>Before ({formatDate(diff.timestamps.old)})</h4>
            <div
              style={{
                fontSize: `${13 * zoomLevel}px`,
                fontFamily: "var(--vscode-editor-font-family)",
                lineHeight: "1.4",
                overflow: "auto",
                padding: "16px",
              }}
            >
              {renderJsonWithDiff(oldDetails, newDetails, true)}
            </div>
          </div>
          <div className="diff-column new">
            <h4>After ({formatDate(diff.timestamps.new)})</h4>
            <div
              style={{
                fontSize: `${13 * zoomLevel}px`,
                fontFamily: "var(--vscode-editor-font-family)",
                lineHeight: "1.4",
                overflow: "auto",
                padding: "16px",
              }}
            >
              {renderJsonWithDiff(newDetails, oldDetails, false)}
            </div>
          </div>
        </div>
      );
    } else {
      // Unified diff view showing request-response details
      return (
        <div className="unified-diff">
          <div
            className="changes-list"
            style={{ fontSize: `${13 * zoomLevel}px` }}
          >
            <div className="request-details-section">
              <h5
                style={{
                  margin: "12px 0 8px 0",
                  color: "#888",
                  fontSize: "12px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Before Request Details
              </h5>
              <pre
                style={{
                  background: "rgba(244, 67, 54, 0.1)",
                  padding: "8px",
                  borderRadius: "4px",
                  margin: "0 0 16px 0",
                  border: "1px solid rgba(244, 67, 54, 0.3)",
                }}
              >
                {JSON.stringify(oldDetails, null, 2)}
              </pre>

              <h5
                style={{
                  margin: "12px 0 8px 0",
                  color: "#888",
                  fontSize: "12px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                After Request Details
              </h5>
              <pre
                style={{
                  background: "rgba(76, 175, 80, 0.1)",
                  padding: "8px",
                  borderRadius: "4px",
                  margin: "0",
                  border: "1px solid rgba(76, 175, 80, 0.3)",
                }}
              >
                {JSON.stringify(newDetails, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      );
    }
  };

  const renderCodeDiff = () => {
    const oldCode = diff.code?.old || "";
    const newCode = diff.code?.new || "";

    if (!oldCode && !newCode) {
      return (
        <div className="no-changes">
          <p>No code available</p>
        </div>
      );
    }

    const oldLines = oldCode.split("\n");
    const newLines = newCode.split("\n");
    const lineDiff = computeLineDiff(oldLines, newLines);

    if (showSideBySide) {
      return (
        <div className="side-by-side">
          <div className="diff-column old">
            <h4>Before ({formatDate(diff.timestamps.old)})</h4>
            <pre
              className="code-content"
              style={{ fontSize: `${13 * zoomLevel}px` }}
            >
              {oldLines.map((line, index) => (
                <div
                  key={index}
                  className={`code-line ${lineDiff.getLineType(true, index)}`}
                >
                  <span className="line-number">{index + 1}</span>
                  <span className="line-content">{line}</span>
                </div>
              ))}
            </pre>
          </div>
          <div className="diff-column new">
            <h4>After ({formatDate(diff.timestamps.new)})</h4>
            <pre
              className="code-content"
              style={{ fontSize: `${13 * zoomLevel}px` }}
            >
              {newLines.map((line, index) => (
                <div
                  key={index}
                  className={`code-line ${lineDiff.getLineType(false, index)}`}
                >
                  <span className="line-number">{index + 1}</span>
                  <span className="line-content">{line}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>
      );
    } else {
      // Simple unified diff (basic implementation)
      const maxLines = Math.max(oldLines.length, newLines.length);
      const unifiedLines = [];

      for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i];
        const newLine = newLines[i];

        if (oldLine === newLine) {
          unifiedLines.push({
            type: "unchanged",
            content: oldLine || "",
            lineNo: i + 1,
          });
        } else {
          if (oldLine !== undefined) {
            unifiedLines.push({
              type: "removed",
              content: oldLine,
              lineNo: i + 1,
            });
          }
          if (newLine !== undefined) {
            unifiedLines.push({
              type: "added",
              content: newLine,
              lineNo: i + 1,
            });
          }
        }
      }

      return (
        <div className="unified-diff">
          <pre
            className="code-content"
            style={{ fontSize: `${13 * zoomLevel}px` }}
          >
            {unifiedLines.map((line, index) => (
              <div key={index} className={`code-line ${line.type}`}>
                <span className="line-number">{line.lineNo}</span>
                <span className="line-prefix">
                  {line.type === "added"
                    ? "+"
                    : line.type === "removed"
                      ? "-"
                      : " "}
                </span>
                <span className="line-content">{line.content}</span>
              </div>
            ))}
          </pre>
        </div>
      );
    }
  };

  return (
    <div className="diff-view-overlay">
      <div className="diff-view">
        <div className="diff-header">
          <div className="diff-title">
            <h2>Snapshot Comparison</h2>
            <button className="close-button" onClick={onClose}>
              ×
            </button>
          </div>

          <div className="snapshot-info">
            <div className="snapshot-card old">
              <h4>Before</h4>
              <p>{formatDate(snapshot1.createdAt)}</p>
              {snapshot1.lastResponse ? (
                <span
                  className={`status-badge status-${Math.floor(
                    (snapshot1.lastResponse.statusCode ||
                      snapshot1.lastResponse.status ||
                      0) / 100,
                  )}`}
                >
                  {snapshot1.lastResponse.statusCode ||
                    snapshot1.lastResponse.status}
                </span>
              ) : (
                <span className="status-badge status-none">No Response</span>
              )}
              {snapshot1.label && (
                <p className="snapshot-label">{snapshot1.label}</p>
              )}
            </div>
            <div className="diff-arrow">
              <span>→</span>
              <p className="time-difference">{getTimeDifference()}</p>
            </div>
            <div className="snapshot-card new">
              <h4>After</h4>
              <p>{formatDate(snapshot2.createdAt)}</p>
              {snapshot2.lastResponse ? (
                <span
                  className={`status-badge status-${Math.floor(
                    (snapshot2.lastResponse.statusCode ||
                      snapshot2.lastResponse.status ||
                      0) / 100,
                  )}`}
                >
                  {snapshot2.lastResponse.statusCode ||
                    snapshot2.lastResponse.status}
                </span>
              ) : (
                <span className="status-badge status-none">No Response</span>
              )}
              {snapshot2.label && (
                <p className="snapshot-label">{snapshot2.label}</p>
              )}
            </div>
          </div>

          <div className="diff-controls">
            <div className="view-type-toggle">
              <button
                className={viewType === "payload" ? "active" : ""}
                onClick={() => setViewType("payload")}
              >
                Payload
              </button>
              <button
                className={viewType === "code" ? "active" : ""}
                onClick={() => setViewType("code")}
              >
                Code
              </button>
            </div>

            <div className="layout-toggle">
              <button
                className={showSideBySide ? "active" : ""}
                onClick={() => setShowSideBySide(true)}
              >
                Side by Side
              </button>
              <button
                className={!showSideBySide ? "active" : ""}
                onClick={() => setShowSideBySide(false)}
              >
                Unified
              </button>
            </div>

            <div className="zoom-controls">
              <button
                title="Zoom Out"
                onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.1))}
                disabled={zoomLevel <= 0.5}
              >
                −
              </button>
              <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
              <button
                title="Zoom In"
                onClick={() => setZoomLevel(Math.min(1.5, zoomLevel + 0.1))}
                disabled={zoomLevel >= 1.5}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="diff-content">
          {viewType === "payload" ? renderPayloadDiff() : renderCodeDiff()}
        </div>
      </div>
    </div>
  );
};

export default DiffView;
