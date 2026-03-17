import React, { useState } from "react";
import "./DiffView.css";

const DiffView = ({ snapshot1, snapshot2, diff, onClose }) => {
  const [viewType, setViewType] = useState("payload"); // 'payload' or 'code'
  const [showSideBySide, setShowSideBySide] = useState(true);

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

  const renderPayloadDiff = () => {
    const oldPayload = diff.payload?.old || {};
    const newPayload = diff.payload?.new || {};
    const hasPayloads =
      Object.keys(oldPayload).length > 0 || Object.keys(newPayload).length > 0;

    if (!hasPayloads) {
      return (
        <div className="no-changes">
          <p>No payload data available</p>
        </div>
      );
    }

    // Simple diff algorithm
    const allKeys = new Set([
      ...Object.keys(oldPayload),
      ...Object.keys(newPayload),
    ]);
    const changes = [];

    allKeys.forEach((key) => {
      const oldValue = oldPayload[key];
      const newValue = newPayload[key];
      const oldType = oldValue !== undefined ? typeof oldValue : "undefined";
      const newType = newValue !== undefined ? typeof newValue : "undefined";

      if (oldValue === undefined && newValue !== undefined) {
        changes.push({ type: "added", key, newValue, newType });
      } else if (oldValue !== undefined && newValue === undefined) {
        changes.push({ type: "removed", key, oldValue, oldType });
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          type: "changed",
          key,
          oldValue,
          oldType,
          newValue,
          newType,
        });
      }
    });

    if (showSideBySide) {
      return (
        <div className="side-by-side">
          <div className="diff-column old">
            <h4>Before ({formatDate(diff.timestamps.old)})</h4>
            <pre className="json-content">
              {JSON.stringify(oldPayload, null, 2)}
            </pre>
          </div>
          <div className="diff-column new">
            <h4>After ({formatDate(diff.timestamps.new)})</h4>
            <pre className="json-content">
              {JSON.stringify(newPayload, null, 2)}
            </pre>
          </div>
        </div>
      );
    } else {
      return (
        <div className="unified-diff">
          <div className="changes-list">
            {changes.length === 0 ? (
              <p>Payloads are identical</p>
            ) : (
              changes.map((change, index) => (
                <div key={index} className={`change-item ${change.type}`}>
                  <div className="change-header">
                    <span className={`change-type ${change.type}`}>
                      {change.type === "added" && "+ Added"}
                      {change.type === "removed" && "- Removed"}
                      {change.type === "changed" && "~ Changed"}
                    </span>
                    <code className="field-name">{change.key}</code>
                  </div>
                  <div className="change-details">
                    {change.type === "added" && (
                      <div className="new-value">
                        <span className="type-badge">{change.newType}</span>
                        <code>{JSON.stringify(change.newValue)}</code>
                      </div>
                    )}
                    {change.type === "removed" && (
                      <div className="old-value">
                        <span className="type-badge">{change.oldType}</span>
                        <code>{JSON.stringify(change.oldValue)}</code>
                      </div>
                    )}
                    {change.type === "changed" && (
                      <>
                        <div className="old-value">
                          <span className="label">Before:</span>
                          <span className="type-badge">{change.oldType}</span>
                          <code>{JSON.stringify(change.oldValue)}</code>
                        </div>
                        <div className="new-value">
                          <span className="label">After:</span>
                          <span className="type-badge">{change.newType}</span>
                          <code>{JSON.stringify(change.newValue)}</code>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
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

    if (showSideBySide) {
      return (
        <div className="side-by-side">
          <div className="diff-column old">
            <h4>Before ({formatDate(diff.timestamps.old)})</h4>
            <pre className="code-content">
              {oldLines.map((line, index) => (
                <div key={index} className="code-line">
                  <span className="line-number">{index + 1}</span>
                  <span className="line-content">{line}</span>
                </div>
              ))}
            </pre>
          </div>
          <div className="diff-column new">
            <h4>After ({formatDate(diff.timestamps.new)})</h4>
            <pre className="code-content">
              {newLines.map((line, index) => (
                <div key={index} className="code-line">
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
          <pre className="code-content">
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
                  className={`status-badge status-${Math.floor(snapshot1.lastResponse.statusCode || snapshot1.lastResponse.status || 0 / 100)}`}
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
                  className={`status-badge status-${Math.floor(snapshot2.lastResponse.statusCode || snapshot2.lastResponse.status || 0 / 100)}`}
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
