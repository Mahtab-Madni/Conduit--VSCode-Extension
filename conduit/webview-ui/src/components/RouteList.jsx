import { useState } from "react";
import "./RouteList.css";

const RouteList = ({ routes, selectedRoute, onSelectRoute, isLoading }) => {
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

  // Group routes by their path prefix (e.g., /users, /orders, /auth)
  const groupRoutes = (routes) => {
    const groups = {};

    routes.forEach((route) => {
      const pathParts = route.path
        .split("/")
        .filter((part) => part && !part.startsWith(":"));
      const groupName = pathParts[0] || "root";

      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(route);
    });

    return groups;
  };

  const toggleGroup = (groupName) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(groupName)) {
      newCollapsed.delete(groupName);
    } else {
      newCollapsed.add(groupName);
    }
    setCollapsedGroups(newCollapsed);
  };

  const getMethodColor = (method) => {
    switch (method.toUpperCase()) {
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

  if (isLoading) {
    return (
      <div className="route-list">
        <div className="loading">
          <div className="loading-spinner"></div>
          <span>Scanning for routes...</span>
        </div>
      </div>
    );
  }

  if (!routes || routes.length === 0) {
    return (
      <div className="route-list">
        <div className="no-routes">
          <div className="no-routes-icon">🔍</div>
          <h3>No routes found</h3>
          <p>Make sure you have Express routes in your project.</p>
        </div>
      </div>
    );
  }

  const groupedRoutes = groupRoutes(routes);

  return (
    <div className="route-list">
      <div className="routes-header">
        <h2>API Routes ({routes.length})</h2>
      </div>

      {Object.entries(groupedRoutes).map(([groupName, groupRoutes]) => {
        const isCollapsed = collapsedGroups.has(groupName);

        return (
          <div key={groupName} className="route-group">
            <div
              className="group-header"
              onClick={() => toggleGroup(groupName)}
            >
              <span
                className={`group-toggle ${isCollapsed ? "collapsed" : "expanded"}`}
              >
                ▼
              </span>
              <span className="group-name">
                /{groupName} ({groupRoutes.length})
              </span>
            </div>

            {!isCollapsed && (
              <div className="group-routes">
                {groupRoutes.map((route, index) => {
                  const isSelected =
                    selectedRoute &&
                    selectedRoute.path === route.path &&
                    selectedRoute.method === route.method;

                  return (
                    <div
                      key={`${route.method}-${route.path}-${index}`}
                      className={`route-item ${isSelected ? "selected" : ""}`}
                      onClick={() => onSelectRoute(route)}
                    >
                      <div
                        className="route-method-badge"
                        style={{
                          backgroundColor: getMethodColor(route.method),
                        }}
                      >
                        {route.method}
                      </div>

                      <div className="route-info">
                        <div className="route-path">{route.path}</div>
                        <div className="route-meta">
                          <span className="route-handler">{route.handler}</span>
                          <span className="route-file">
                            {route.filePath.split(/[\\/]/).pop()}:{route.line}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default RouteList;
