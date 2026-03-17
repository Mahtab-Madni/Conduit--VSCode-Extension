import { useState } from "react";
import "./ResponseView.css";

const ResponseView = ({ response, isLoading, onCheckpoint }) => {
  const [showHeaders, setShowHeaders] = useState(false);
  const [copiedText, setCopiedText] = useState(null);
  const [showCheckpointModal, setShowCheckpointModal] = useState(false);
  const [checkpointLabel, setCheckpointLabel] = useState("");
  const [checkpointLoading, setCheckpointLoading] = useState(false);

  const getStatusClass = (status) => {
    if (!status) return "";
    if (status >= 200 && status < 300) return "status-success";
    if (status >= 400 && status < 500) return "status-warning";
    if (status >= 500) return "status-error";
    return "status-info";
  };

  const isSuccessResponse = (status) => {
    return status >= 200 && status < 300;
  };

  const formatResponseTime = (startTime, endTime) => {
    if (!startTime || !endTime) return null;
    const diff = endTime - startTime;
    return `${diff}ms`;
  };

  const formatJson = (data) => {
    if (!data) return "";
    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error("Error formatting JSON:", error);
      return String(data);
    }
  };

  const copyToClipboard = (text, identifier = "default") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(identifier);
      setTimeout(() => {
        setCopiedText(null);
      }, 2000);
    });
  };

  const handleSaveCheckpoint = async () => {
    if (!checkpointLabel.trim()) {
      alert("Please enter a checkpoint label (like a git commit message)");
      return;
    }

    setCheckpointLoading(true);
    try {
      await onCheckpoint({
        label: checkpointLabel.trim(),
        payload: response.lastPayload,
        response: {
          statusCode: response.status,
          body: response.data,
          responseTime: response.endTime - response.startTime,
          testedAt: new Date().toISOString(),
        },
      });
      setShowCheckpointModal(false);
      setCheckpointLabel("");
    } catch (error) {
      console.error("Error saving checkpoint:", error);
      alert("Failed to save checkpoint: " + error.message);
    } finally {
      setCheckpointLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="response-view loading-state">
        <div className="response-header">
          <h3 className="response-title">Response</h3>
        </div>
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <span>Sending request...</span>
        </div>
      </div>
    );
  }

  if (!response) {
    return null;
  }

  return (
    <div className="response-view">
      {/* Success Banner with Checkpoint Option */}
      {isSuccessResponse(response.status) && (
        <div className="success-banner">
          <div className="banner-content">
            <span className="banner-message">
              ✅ {response.status} {response.statusText} •{" "}
              {formatResponseTime(response.startTime, response.endTime)}
            </span>
            <span className="banner-text">
              Route is working. Save this moment?
            </span>
          </div>
          <div className="banner-actions">
            <button
              className="checkpoint-btn"
              onClick={() => setShowCheckpointModal(true)}
            >
              Save as Checkpoint
            </button>
            {/* Dismiss is implicit - just don't click the button */}
          </div>
        </div>
      )}

      {/* Checkpoint Modal */}
      {showCheckpointModal && (
        <div
          className="checkpoint-modal-overlay"
          onClick={() => setShowCheckpointModal(false)}
        >
          <div
            className="checkpoint-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title"> Save Checkpoint</h3>
            <p className="modal-description">
              Enter a message describing what this checkpoint captures (like a
              git commit message):
            </p>
            <input
              type="text"
              className="checkpoint-input"
              placeholder="e.g., added shippingAddress field to payload validation"
              value={checkpointLabel}
              onChange={(e) => setCheckpointLabel(e.target.value)}
              onKeyPress={(e) => {
                if (
                  e.key === "Enter" &&
                  checkpointLabel.trim() &&
                  !checkpointLoading
                ) {
                  handleSaveCheckpoint();
                }
              }}
              disabled={checkpointLoading}
              autoFocus
            />
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowCheckpointModal(false)}
                disabled={checkpointLoading}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveCheckpoint}
                disabled={checkpointLoading || !checkpointLabel.trim()}
              >
                {checkpointLoading ? "Saving..." : "Save Checkpoint"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="response-header">
        <h3 className="response-title">Response</h3>
        <div className="response-meta">
          <div className={`status-badge ${getStatusClass(response.status)}`}>
            {response.status} {response.statusText}
          </div>
          {response.responseTime && (
            <div className="response-time">
              {formatResponseTime(response.startTime, response.endTime)}
            </div>
          )}
        </div>
      </div>

      <div className="response-content">
        {/* Headers Toggle */}
        {response.headers && Object.keys(response.headers).length > 0 && (
          <div className="headers-section">
            <button
              className="headers-toggle"
              onClick={() => setShowHeaders(!showHeaders)}
            >
              <span
                className={`toggle-icon ${showHeaders ? "expanded" : "collapsed"}`}
              >
                ▼
              </span>
              Headers ({Object.keys(response.headers).length})
            </button>

            {showHeaders && (
              <div className="headers-content">
                <div className="headers-actions">
                  <button
                    className="copy-button"
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(response.headers, null, 2),
                        "headers",
                      )
                    }
                  >
                    {copiedText === "headers" ? "✓ Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="headers-text">
                  {Object.entries(response.headers).map(([key, value]) => (
                    <div key={key} className="header-line">
                      <span className="header-key">{key}:</span>{" "}
                      <span className="header-value">{value}</span>
                    </div>
                  ))}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Response Body */}
        <div className="response-body">
          <div className="body-header">
            <span className="body-title">Response Body</span>
            <div className="body-actions">
              <button
                className="copy-button"
                onClick={() =>
                  copyToClipboard(formatJson(response.data), "body")
                }
              >
                {copiedText === "body" ? "✓ Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <div className="response-data">
            {response.data ? (
              <pre className="json-content">{formatJson(response.data)}</pre>
            ) : (
              <div className="empty-response">
                <span>No response body</span>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {response.error && (
          <div className="error-section">
            <div className="error-header">
              <span className="error-title">Error</span>
            </div>
            <div className="error-content">
              <pre className="error-text">{response.error}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResponseView;
