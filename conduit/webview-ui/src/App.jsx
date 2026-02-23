import { useState, useEffect } from "react";
import RouteList from "./components/RouteList";
import Playground from "./components/Playground";
import HistoryPanel from "./components/HistoryPanel";
import DiffView from "./components/DiffView";
import "./App.css";

const vscode =
  window.vscode || (window.acquireVsCodeApi ? window.acquireVsCodeApi() : null);

function App() {
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showDiffView, setShowDiffView] = useState(false);
  const [diffData, setDiffData] = useState(null);

  // Add debugging
  useEffect(() => {
    console.log("App component mounted");
    console.log("VS Code API available:", !!vscode);
  }, []);

  useEffect(() => {
    console.log("Routes updated:", routes);
  }, [routes]);

  useEffect(() => {
    const handleMessage = (event) => {
      const message = event.data;

      switch (message.command) {
        case "updateRoutes":
          setRoutes(message.routes);
          setIsLoading(false);
          break;
        case "authStatusUpdate":
          setIsAuthenticated(message.isAuthenticated);
          setUser(message.user);
          break;
        case "routeHistoryResponse":
          // Forward to HistoryPanel via custom event
          window.dispatchEvent(
            new CustomEvent("routeHistoryResponse", {
              detail: message,
            }),
          );
          break;
        case "snapshotDiffResponse":
          if (message.success) {
            setDiffData(message.data);
            setShowDiffView(true);
          } else {
            console.error("Diff comparison failed:", message.error);
          }
          break;
        case "requestResponse":
          // This will be handled by the Playground component
          window.dispatchEvent(
            new CustomEvent("requestResponse", {
              detail: message.response,
            }),
          );
          break;
        case "payloadPredictionLoading":
          window.dispatchEvent(
            new CustomEvent("payloadPredictionLoading", {
              detail: { route: message.route },
            }),
          );
          break;
        case "payloadPredictionResult":
          window.dispatchEvent(
            new CustomEvent("payloadPredictionResult", {
              detail: {
                route: message.route,
                prediction: message.prediction,
                requiresAuth: message.requiresAuth,
              },
            }),
          );
          break;
        case "payloadPredictionError":
          window.dispatchEvent(
            new CustomEvent("payloadPredictionError", {
              detail: {
                route: message.route,
                error: message.error,
              },
            }),
          );
          break;
        case "errorSuggestionLoading":
          window.dispatchEvent(
            new CustomEvent("errorSuggestionLoading", {
              detail: { route: message.route },
            }),
          );
          break;
        case "errorSuggestionResult":
          window.dispatchEvent(
            new CustomEvent("errorSuggestionResult", {
              detail: {
                route: message.route,
                suggestion: message.suggestion,
              },
            }),
          );
          break;
        case "errorSuggestionError":
          window.dispatchEvent(
            new CustomEvent("errorSuggestionError", {
              detail: {
                route: message.route,
                error: message.error,
              },
            }),
          );
          break;
      }
    };

    window.addEventListener("message", handleMessage);

    // Request initial routes and auth status
    if (vscode) {
      vscode.postMessage({ command: "refresh" });
      vscode.postMessage({ command: "checkAuthStatus" });
    }

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    if (vscode) {
      vscode.postMessage({ command: "refresh" });
    }
  };

  const handleSendRequest = (route, payload, headers) => {
    if (vscode) {
      vscode.postMessage({
        command: "sendRequest",
        route: route,
        payload: payload,
        headers: headers,
      });
    }
  };

  const handleLogin = () => {
    if (vscode) {
      vscode.postMessage({ command: "login" });
    }
  };

  const handleLogout = () => {
    if (vscode) {
      vscode.postMessage({ command: "logout" });
    }
    setIsAuthenticated(false);
    setUser(null);
  };

  const handleSnapshotSelect = (snapshot) => {
    // When a snapshot is selected, load its payload into the playground
    if (snapshot.predictedPayload) {
      window.dispatchEvent(
        new CustomEvent("loadPayload", {
          detail: { payload: snapshot.predictedPayload },
        }),
      );
    }
  };

  const handleDiffSelect = (snapshotId1, snapshotId2) => {
    if (vscode) {
      vscode.postMessage({
        command: "compareSnapshots",
        snapshotId1: snapshotId1,
        snapshotId2: snapshotId2,
      });
    }
  };

  const closeDiffView = () => {
    setShowDiffView(false);
    setDiffData(null);
  };

  const toggleHistoryPanel = () => {
    setShowHistory(!showHistory);
  };

  return (
    <div className="app">
      <div className="header">
        <h1 className="title">
          <img
            src="Conduit.png"
            alt="Conduit Logo"
            style={{
              maxWidth: "30px",
              maxHeight: "30px",
              margin: "0 10px 0 0",
              translate: "0 6px",
            }}
          />
          Conduit API Explorer
        </h1>
        <div className="header-actions">
          <button
            className={`history-toggle ${showHistory ? "active" : ""}`}
            onClick={toggleHistoryPanel}
            title="Toggle History Panel"
          >
            📅 History
          </button>
          {isAuthenticated ? (
            <div className="auth-info">
              <span className="user-name">
                {user?.displayName || user?.username}
              </span>
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : (
            <button className="login-btn" onClick={handleLogin}>
              Login
            </button>
          )}
          <button className="refresh-btn" onClick={handleRefresh}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className={`content ${showHistory ? "with-history" : ""}`}>
        <div className="sidebar">
          <RouteList
            routes={routes}
            selectedRoute={selectedRoute}
            onSelectRoute={setSelectedRoute}
            isLoading={isLoading}
          />
        </div>

        <div className="main">
          {selectedRoute ? (
            <Playground
              route={selectedRoute}
              onSendRequest={handleSendRequest}
            />
          ) : (
            <div className="placeholder">
              <h3>Select a route to test</h3>
              <p>Choose a route from the sidebar to start testing your API</p>
            </div>
          )}
        </div>

        {showHistory && (
          <div className="history-sidebar">
            <HistoryPanel
              selectedRoute={selectedRoute}
              onSnapshotSelect={handleSnapshotSelect}
              onDiffSelect={handleDiffSelect}
              isAuthenticated={isAuthenticated}
              onLogin={handleLogin}
            />
          </div>
        )}
      </div>

      {showDiffView && diffData && (
        <DiffView
          snapshot1={diffData.snapshot1}
          snapshot2={diffData.snapshot2}
          diff={diffData}
          onClose={closeDiffView}
        />
      )}
    </div>
  );
}

export default App;
