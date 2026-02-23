import { useState } from "react";
import "./ResponseView.css";

const ResponseView = ({ response, isLoading }) => {
  const [showHeaders, setShowHeaders] = useState(false);

  const getStatusClass = (status) => {
    if (!status) return "";
    if (status >= 200 && status < 300) return "status-success";
    if (status >= 400 && status < 500) return "status-warning";
    if (status >= 500) return "status-error";
    return "status-info";
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
    });
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
                      copyToClipboard(JSON.stringify(response.headers, null, 2))
                    }
                  >
                    Copy
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
                onClick={() => copyToClipboard(formatJson(response.data))}
              >
                Copy
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
