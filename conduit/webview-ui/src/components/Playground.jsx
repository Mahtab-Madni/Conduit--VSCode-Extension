import { useState, useEffect } from "react";
import ResponseView from "./ResponseView";
import PayloadForm from "./PayloadForm";
import JsonEditor from "./JsonEditor";
import AiResponseFormatter from "./AiResponseFormatter";
import "./Playground.css";

const vscode =
  window.vscode || (window.acquireVsCodeApi ? window.acquireVsCodeApi() : null);

const Playground = ({ route, onSendRequest }) => {
  const [baseUrl, setBaseUrl] = useState("http://localhost:3000");
  const [fullUrl, setFullUrl] = useState("");
  const [suggestedUrl, setSuggestedUrl] = useState("");
  const [payload, setPayload] = useState("");
  const [headers, setHeaders] = useState("{}");
  const [pathParams, setPathParams] = useState({});
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userEditedUrl, setUserEditedUrl] = useState(false);

  // AI Prediction states
  const [prediction, setPrediction] = useState(null);
  const [isPredictionLoading, setIsPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState(null);
  const [useFormMode, setUseFormMode] = useState(false);
  const [formPayload, setFormPayload] = useState({});

  // Auth states
  const [authToken, setAuthToken] = useState(
    localStorage.getItem("conduit-auth-token") || "",
  );
  const [requiresAuth, setRequiresAuth] = useState(false);

  // Error suggestion states
  const [errorSuggestion, setErrorSuggestion] = useState(null);
  const [isErrorSuggestionLoading, setIsErrorSuggestionLoading] =
    useState(false);

  // Extract path parameters from route path
  const getPathParams = (path) => {
    const params = [];
    const matches = path.match(/:([^/]+)/g);
    if (matches) {
      matches.forEach((match) => {
        const paramName = match.substring(1); // Remove the ':'
        params.push(paramName);
      });
    }
    return params;
  };

  // Generate default payload based on route
  const generateDefaultPayload = (route) => {
    if (!route || route.method === "GET" || route.method === "DELETE") {
      return "";
    }

    const defaultPayloads = {
      users: { name: "", email: "", password: "" },
      user: { name: "", email: "" },
      products: { name: "", price: 0, description: "" },
      product: { name: "", price: 0 },
      orders: { userId: "", items: [], total: 0 },
      order: { status: "", items: [] },
      auth: { email: "", password: "" },
      login: { email: "", password: "" },
      register: { name: "", email: "", password: "" },
    };

    // Try to match route path to get appropriate default payload
    const path = route.path.toLowerCase();
    for (const [key, value] of Object.entries(defaultPayloads)) {
      if (path.includes(key)) {
        return JSON.stringify(value, null, 2);
      }
    }

    // Generic default payload
    return JSON.stringify(
      {
        // Add some common fields
      },
      null,
      2,
    );
  };

  // Generate basic headers immediately for route type
  const generateBasicHeaders = (route) => {
    const headers = {};

    // Always add Content-Type for POST/PUT/PATCH
    if (route.method !== "GET" && route.method !== "DELETE") {
      headers["Content-Type"] = "application/json";
    }

    // Don't add Authorization header here - it will be added automatically when token is set

    // Always add Accept header
    headers["Accept"] = "application/json";

    console.log("Generated basic headers for route:", route.method, route.path);
    return headers;
  };

  // Generate predicted base URL immediately for route type
  const generatePredictedBaseUrl = () => {
    // In VS Code webview, window.location refers to webview's internal URL
    // So we always default to common development URL and let backend AI enhance it
    return "http://localhost:3000";
  };

  // Reset form when route changes and auto-predict payload
  useEffect(() => {
    if (route) {
      setPayload(generateDefaultPayload(route));
      setHeaders("{}"); // Reset headers when route changes
      setResponse(null);
      setIsLoading(false);
      setPrediction(null);
      setPredictionError(null);
      setUseFormMode(false);
      setUserEditedUrl(false); // Reset URL edited flag when route changes

      // Initialize path parameters
      const params = getPathParams(route.path);
      const initialParams = {};
      params.forEach((param) => {
        initialParams[param] = "";
      });
      setPathParams(initialParams);

      // Immediately set basic headers for the route type
      const basicHeaders = generateBasicHeaders(route);
      if (Object.keys(basicHeaders).length > 0) {
        setHeaders(JSON.stringify(basicHeaders, null, 2));
      }

      // Set predicted base URL immediately (will be enhanced by AI prediction)
      const predictedUrl = generatePredictedBaseUrl();
      setBaseUrl(predictedUrl);
      const fullPredictedUrl = `${predictedUrl}${route.path}`;
      setFullUrl(fullPredictedUrl);
      setSuggestedUrl(fullPredictedUrl);

      // Auto-predict payload for POST/PUT/PATCH requests
      if (route.method !== "GET" && route.method !== "DELETE" && vscode) {
        // Small delay to ensure state is updated
        setTimeout(() => {
          vscode.postMessage({
            command: "predictPayload",
            route: route,
          });
        }, 100);
      }
    }
  }, [route]);

  // Update fullUrl when baseUrl changes (from AI prediction)
  useEffect(() => {
    if (route && !userEditedUrl) {
      const newFullUrl = `${baseUrl}${route.path}`;
      setFullUrl(newFullUrl);
      setSuggestedUrl(newFullUrl);
    }
  }, [baseUrl, route, userEditedUrl]);

  // Listen for response from extension
  useEffect(() => {
    const handleResponse = (event) => {
      setResponse(event.detail);
      setIsLoading(false);

      // If request failed, clear error suggestions
      if (event.detail && (event.detail.status >= 400 || event.detail.error)) {
        setErrorSuggestion(null);
      }
    };

    window.addEventListener("requestResponse", handleResponse);
    return () => window.removeEventListener("requestResponse", handleResponse);
  }, []);

  // Listen for AI prediction events
  useEffect(() => {
    const handlePredictionLoading = () => {
      setIsPredictionLoading(true);
      setPredictionError(null);
    };

    const handlePredictionResult = (event) => {
      setPrediction(event.detail.prediction);
      setRequiresAuth(event.detail.requiresAuth || false);
      setIsPredictionLoading(false);
      setPredictionError(null);

      // Automatically populate headers from prediction
      if (event.detail.prediction && event.detail.prediction.headers) {
        const predictedHeaders = {};
        event.detail.prediction.headers.forEach((header) => {
          predictedHeaders[header.name] = header.value;
        });

        // Update headers if they are empty or contain default/basic headers
        const currentHeadersObj = JSON.parse(headers || "{}");
        const hasOnlyBasicHeaders =
          Object.keys(currentHeadersObj).length === 0 ||
          (Object.keys(currentHeadersObj).length <= 2 &&
            (currentHeadersObj["Content-Type"] || currentHeadersObj["Accept"]));

        if (headers === "{}" || headers.trim() === "" || hasOnlyBasicHeaders) {
          setHeaders(JSON.stringify(predictedHeaders, null, 2));
        }
      }

      // Automatically populate base URL from prediction
      if (event.detail.prediction && event.detail.prediction.baseUrl) {
        const newBaseUrl = event.detail.prediction.baseUrl;
        setBaseUrl(newBaseUrl);
        // fullUrl will be updated automatically by the baseUrl useEffect if user hasn't edited it
      }

      // Automatically populate JSON payload from AI prediction
      if (
        event.detail.prediction &&
        event.detail.prediction.fields.length > 0
      ) {
        const predictedPayload = {};
        event.detail.prediction.fields.forEach((field) => {
          predictedPayload[field.name] = field.example;
        });

        // Set the JSON payload directly
        setPayload(JSON.stringify(predictedPayload, null, 2));

        // Also set form payload for when user switches to form mode
        setFormPayload(predictedPayload);
      }

      // Stay in JSON mode by default - user can manually switch to form mode if needed
    };

    const handlePredictionError = (event) => {
      setPredictionError(event.detail.error);
      setIsPredictionLoading(false);
    };

    const handleErrorSuggestionLoading = () => {
      setIsErrorSuggestionLoading(true);
    };

    const handleErrorSuggestionResult = (event) => {
      setErrorSuggestion(event.detail.suggestion);
      setIsErrorSuggestionLoading(false);
    };

    const handleErrorSuggestionError = () => {
      setIsErrorSuggestionLoading(false);
    };

    window.addEventListener(
      "payloadPredictionLoading",
      handlePredictionLoading,
    );
    window.addEventListener("payloadPredictionResult", handlePredictionResult);
    window.addEventListener("payloadPredictionError", handlePredictionError);
    window.addEventListener(
      "errorSuggestionLoading",
      handleErrorSuggestionLoading,
    );
    window.addEventListener(
      "errorSuggestionResult",
      handleErrorSuggestionResult,
    );
    window.addEventListener("errorSuggestionError", handleErrorSuggestionError);

    return () => {
      window.removeEventListener(
        "payloadPredictionLoading",
        handlePredictionLoading,
      );
      window.removeEventListener(
        "payloadPredictionResult",
        handlePredictionResult,
      );
      window.removeEventListener(
        "payloadPredictionError",
        handlePredictionError,
      );
      window.removeEventListener(
        "errorSuggestionLoading",
        handleErrorSuggestionLoading,
      );
      window.removeEventListener(
        "errorSuggestionResult",
        handleErrorSuggestionResult,
      );
      window.removeEventListener(
        "errorSuggestionError",
        handleErrorSuggestionError,
      );
    };
  }, []);

  // Handle auth token changes - automatically update headers with auth token
  useEffect(() => {
    localStorage.setItem("conduit-auth-token", authToken);

    // Automatically add/update auth token in headers if token exists
    if (authToken) {
      try {
        const currentHeadersObj = JSON.parse(headers || "{}");
        const currentAuth = currentHeadersObj["Authorization"] || "";
        const newAuth = `Bearer ${authToken}`;

        // Only update if Authorization header is missing, empty, or still a placeholder
        if (
          !currentAuth ||
          currentAuth === "Bearer your-token-here" ||
          currentAuth === "Bearer " ||
          currentAuth.startsWith("Bearer ")
        ) {
          // Update if it's a Bearer token (likely ours)
          if (currentAuth !== newAuth) {
            // Only update if actually changed
            currentHeadersObj["Authorization"] = newAuth;
            setHeaders(JSON.stringify(currentHeadersObj, null, 2));
          }
        }
      } catch (e) {
        // If headers aren't valid JSON, skip the update
      }
    } else {
      // When token is cleared, remove Authorization header if it's a Bearer token
      try {
        const currentHeadersObj = JSON.parse(headers || "{}");
        const currentAuth = currentHeadersObj["Authorization"] || "";

        // Remove Authorization header only if it's a Bearer token (our managed one)
        if (currentAuth && currentAuth.startsWith("Bearer ")) {
          delete currentHeadersObj["Authorization"];
          setHeaders(JSON.stringify(currentHeadersObj, null, 2));
        }
      } catch (e) {
        // If headers aren't valid JSON, skip the update
      }
    }
  }, [authToken, headers]);

  const handleSendRequest = () => {
    if (!route) return;

    // Validate headers JSON
    let parsedHeaders = {};
    if (headers.trim()) {
      try {
        parsedHeaders = JSON.parse(headers);
      } catch (e) {
        alert("Invalid JSON in headers");
        return;
      }
    }

    // Validate payload JSON
    let parsedPayload = {};
    if (payload.trim() && route.method !== "GET") {
      try {
        parsedPayload = JSON.parse(payload);
      } catch (e) {
        alert("Invalid JSON in request body");
        return;
      }
    }

    // Build the final URL with path parameters
    let finalPath = route.path;
    Object.entries(pathParams).forEach(([param, value]) => {
      if (value) {
        finalPath = finalPath.replace(`:${param}`, value);
      }
    });

    // Extract baseUrl from fullUrl if user has edited it
    let effectiveBaseUrl = baseUrl;
    if (fullUrl) {
      const pathIndex = fullUrl.indexOf(route.path);
      if (pathIndex > 0) {
        effectiveBaseUrl = fullUrl.substring(0, pathIndex);
      }
    }

    // Create the request object
    const requestData = {
      ...route,
      path: finalPath,
      baseUrl: effectiveBaseUrl,
    };

    setIsLoading(true);
    setResponse(null);
    setErrorSuggestion(null);

    // Headers now include auth token automatically from the headers state
    onSendRequest(requestData, parsedPayload, parsedHeaders);
  };

  const handleRequestErrorSuggestion = () => {
    if (!route || !response || !vscode) return;

    const requestPayload = useFormMode
      ? formPayload
      : payload
        ? JSON.parse(payload || "{}")
        : {};

    vscode.postMessage({
      command: "predictErrorFix",
      route: route,
      errorResponse: response.data,
      requestPayload: requestPayload,
      statusCode: response.status,
    });
  };

  const handleFormPayloadChange = (newPayload) => {
    setFormPayload(newPayload);
    setPayload(JSON.stringify(newPayload, null, 2));
  };

  const toggleFormMode = () => {
    if (!useFormMode && payload) {
      try {
        const parsed = JSON.parse(payload);
        setFormPayload(parsed);
      } catch (e) {
        // If parsing fails, reset payload
        setFormPayload({});
      }
    }
    setUseFormMode(!useFormMode);
  };

  const handlePathParamChange = (param, value) => {
    setPathParams((prev) => ({
      ...prev,
      [param]: value,
    }));
  };

  const getMethodColor = (method) => {
    switch (method?.toUpperCase()) {
      case "GET":
        return "#28a745";
      case "POST":
        return "#007bff";
      case "PUT":
        return "#ffc107";
      case "DELETE":
        return "#dc3545";
      case "PATCH":
        return "#6f42c1";
      default:
        return "#6c757d";
    }
  };

  const pathParamsList = route ? getPathParams(route.path) : [];

  return (
    <div className="playground">
      <div className="playground-header">
        <div className="route-info">
          <div
            className="method-badge"
            style={{ backgroundColor: getMethodColor(route?.method) }}
          >
            {route?.method}
          </div>
          <div className="route-details">
            <div className="route-path">{route?.path}</div>
            <div className="route-file">
              {route?.filePath?.split(/[\\/]/).pop()}:{route?.line}
            </div>
          </div>
        </div>
      </div>

      <div className="playground-content">
        {/* URL Section */}
        <div className="url-section">
          <div className="url-bar">
            <div
              className="method-selector"
              style={{ backgroundColor: getMethodColor(route?.method) }}
            >
              {route?.method || "GET"}
            </div>
            <div className="url-input-wrapper">
              <input
                type="text"
                value={fullUrl}
                onChange={(e) => {
                  const newUrl = e.target.value;
                  setFullUrl(newUrl);
                  setUserEditedUrl(true); // Mark URL as manually edited
                  // Try to extract base URL and update it
                  if (route?.path) {
                    const pathIndex = newUrl.indexOf(route.path);
                    if (pathIndex > 0) {
                      setBaseUrl(newUrl.substring(0, pathIndex));
                    }
                  }
                }}
                onKeyDown={(e) => {
                  // Accept suggestion with Tab or Right Arrow at end of input
                  if (
                    (e.key === "Tab" ||
                      (e.key === "ArrowRight" &&
                        e.target.selectionStart === fullUrl.length)) &&
                    suggestedUrl &&
                    suggestedUrl.startsWith(fullUrl) &&
                    suggestedUrl !== fullUrl
                  ) {
                    e.preventDefault();
                    setFullUrl(suggestedUrl);
                  }
                }}
                className="url-input-main"
                placeholder="Enter request URL"
              />
              {suggestedUrl &&
                suggestedUrl.startsWith(fullUrl) &&
                suggestedUrl !== fullUrl && (
                  <div className="url-suggestion" aria-hidden="true">
                    <span className="url-typed">{fullUrl}</span>
                    <span className="url-ghost">
                      {suggestedUrl.substring(fullUrl.length)}
                    </span>
                  </div>
                )}
            </div>
            <button
              onClick={handleSendRequest}
              disabled={isLoading || !route}
              className={`send-button-main ${isLoading ? "loading" : ""}`}
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner"></span>
                  Sending...
                </>
              ) : (
                "Send"
              )}
            </button>
          </div>
          <small style={{ color: "#888", marginTop: "8px", display: "block" }}>
            💡 Check that the URL is correct before sending the request
          </small>
        </div>

        {/* Path Parameters */}
        {pathParamsList.length > 0 && (
          <div className="section">
            <label className="section-title">Path Parameters</label>
            <div className="path-params">
              {pathParamsList.map((param) => (
                <div key={param} className="param-input-group">
                  <label className="param-label">:{param}</label>
                  <input
                    type="text"
                    value={pathParams[param] || ""}
                    onChange={(e) =>
                      handlePathParamChange(param, e.target.value)
                    }
                    className="param-input"
                    placeholder={`Enter value for ${param}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Request Headers */}
        <div className="section">
          <div className="section-header">
            <label className="section-title">Headers (JSON)</label>
            {authToken && (
              <div className="auth-section">
                <span className="auth-label">🔐 Auth Token Configured</span>
              </div>
            )}
          </div>
          <div className="header-info">
            {requiresAuth && (
              <>
                <small
                  style={{
                    color: "#666",
                    marginBottom: "8px",
                    display: "block",
                  }}
                >
                  This route requires authentication. Enter your token below:
                </small>
                <div
                  style={{ display: "flex", gap: "8px", marginBottom: "8px" }}
                >
                  <input
                    type="password"
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    className="auth-input"
                    placeholder="Enter Bearer token (will be added to Authorization header automatically)..."
                    style={{ flex: 1 }}
                  />
                </div>
              </>
            )}
          </div>
          <JsonEditor
            value={headers}
            onChange={setHeaders}
            className="headers-editor"
            placeholder='{"Content-Type": "application/json", "Authorization": "Bearer token"}'
            rows={3}
          />
        </div>

        {/* Request Body */}
        {route?.method !== "GET" && route?.method !== "DELETE" && (
          <div className="section">
            <div className="section-header">
              <label className="section-title">Request Body</label>
              <div className="payload-controls">
                {isPredictionLoading && (
                  <div className="prediction-status">
                    <span className="loading-spinner"></span>
                    <span className="prediction-text">
                      AI analyzing route...
                    </span>
                  </div>
                )}
                {prediction && (
                  <div
                    className="mode-toggle-container"
                    title={
                      useFormMode
                        ? "Switch to JSON Mode"
                        : "Switch to Form Mode"
                    }
                  >
                    <label className="mode-toggle-switch">
                      <input
                        type="checkbox"
                        checked={useFormMode}
                        onChange={toggleFormMode}
                        className="mode-toggle-checkbox"
                      />
                      <span className="mode-toggle-slider">
                        <span className="mode-icon mode-icon-left">
                          &lt;&gt;
                        </span>
                        <span className="mode-icon mode-icon-right">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                          </svg>
                        </span>
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {predictionError && (
              <div className="prediction-error">⚠️ {predictionError}</div>
            )}

            {useFormMode && prediction ? (
              <PayloadForm
                prediction={prediction}
                onPayloadChange={handleFormPayloadChange}
                initialPayload={formPayload}
                disabled={isLoading}
              />
            ) : (
              <JsonEditor
                value={payload}
                onChange={setPayload}
                className="payload-editor"
                placeholder="Enter JSON payload..."
                rows={12}
              />
            )}
          </div>
        )}

        {/* Send Button */}
        <div className="section send-section" style={{ display: "none" }}>
          <button
            onClick={handleSendRequest}
            disabled={isLoading}
            className={`send-button ${isLoading ? "loading" : ""}`}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Sending Request...
              </>
            ) : (
              `Send ${route?.method} Request`
            )}
          </button>
        </div>

        {/* Response */}
        {(response || isLoading) && (
          <div className="response-section">
            <ResponseView response={response} isLoading={isLoading} />

            {/* Error Suggestions */}
            {response && (response.status >= 400 || response.error) && (
              <div className="error-suggestions">
                <div className="error-header">
                  <h4> Need help fixing this error?</h4>
                  <button
                    onClick={handleRequestErrorSuggestion}
                    disabled={isErrorSuggestionLoading}
                    className="suggest-button"
                  >
                    {isErrorSuggestionLoading ? (
                      <>
                        <span className="loading-spinner"></span>
                        Analyzing...
                      </>
                    ) : (
                      "Get AI Suggestion"
                    )}
                  </button>
                </div>

                {errorSuggestion && (
                  <div className="suggestion-content">
                    <AiResponseFormatter content={errorSuggestion} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Playground;
