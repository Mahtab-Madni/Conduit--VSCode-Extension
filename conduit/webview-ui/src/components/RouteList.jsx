import { useState, useMemo } from "react";
import "./RouteList.css";

const RouteList = ({
  routes,
  selectedRoute,
  onSelectRoute,
  isLoading,
  onExportPostman,
  onExportOpenAPI,
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMethods, setFilterMethods] = useState(new Set());

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

  const toggleMethodFilter = (method) => {
    const newFilters = new Set(filterMethods);
    if (newFilters.has(method)) {
      newFilters.delete(method);
    } else {
      newFilters.add(method);
    }
    setFilterMethods(newFilters);
  };

  // Filter routes based on search query and method filters
  const filteredRoutes = useMemo(() => {
    return routes.filter((route) => {
      // Apply method filter (if no filters selected, show all)
      if (
        filterMethods.size > 0 &&
        !filterMethods.has(route.method.toUpperCase())
      ) {
        return false;
      }

      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          route.path.toLowerCase().includes(query) ||
          route.handler.toLowerCase().includes(query) ||
          route.filePath.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [routes, searchQuery, filterMethods]);

  const getMethodColor = (method) => {
    switch (method.toUpperCase()) {
      case "GET":
        return "#55d372";
      case "POST":
        return "#3e80c7";
      case "PUT":
        return "#dfb843";
      case "DELETE":
        return "#c7424f";
      case "PATCH":
        return "#8554e1";
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

  const groupedRoutes = groupRoutes(filteredRoutes);
  const hasFilters = searchQuery.trim() || filterMethods.size > 0;

  return (
    <div className="route-list">
      <div className="routes-header">
        <h2>
          API Routes ({filteredRoutes.length}/{routes.length})
        </h2>
      </div>

      {/* Search and Filter Bar */}
      <div className="routes-search-section">
        <div className="search-bar-wrapper">
          <input
            type="text"
            className="search-bar"
            placeholder="Search by path, handler, or file..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchQuery("")}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Method Filter Buttons */}
        <div className="method-filters">
          {["GET", "POST", "PUT", "DELETE", "PATCH"].map((method) => {
            const methodColor = getMethodColor(method);
            const isActive =
              filterMethods.size === 0 || filterMethods.has(method);
            const isFiltered = filterMethods.has(method);

            return (
              <button
                key={method}
                className={`method-filter-btn ${isActive && !isFiltered ? "all" : isFiltered ? "active" : "inactive"}`}
                onClick={() => toggleMethodFilter(method)}
                title={`Filter by ${method}`}
                style={{
                  borderColor: methodColor,
                  backgroundColor: isFiltered ? methodColor : "transparent",
                  color: isFiltered ? "white" : methodColor,
                }}
              >
                {method}
              </button>
            );
          })}
        </div>

        {/* Export Buttons */}
        <div className="export-buttons">
          <button
            className="export-btn postman-btn"
            onClick={onExportPostman}
            title="Export as Postman Collection"
          >
            Postman
          </button>
          <button
            className="export-btn openapi-btn"
            onClick={onExportOpenAPI}
            title="Export as OpenAPI/Swagger"
          >
            OpenAPI
          </button>
        </div>
      </div>

      {/* No Results Message */}
      {hasFilters && Object.keys(groupedRoutes).length === 0 && (
        <div className="no-results">
          <p>No routes match your search criteria</p>
          <button
            onClick={() => {
              setSearchQuery("");
              setFilterMethods(new Set());
            }}
          >
            Clear filters
          </button>
        </div>
      )}

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
                    selectedRoute && selectedRoute.id === route.id;

                  return (
                    <div
                      key={route.id}
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
