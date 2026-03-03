// Error handling middleware
export const errorHandler = (error, req, res, next) => {
  console.error("Server Error:", error);
  res.status(500).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message,
  });
};

// 404 Not Found handler
export const notFoundHandler = (req, res) => {
  res.status(404).json({ error: "Route not found" });
};

// Configure all error handlers
export const configureErrorHandlers = (app) => {
  // Apply error handling middleware (must be last)
  app.use(errorHandler);
  // Apply 404 handler (must be after all other middleware)
  app.use(notFoundHandler);
};

export default { errorHandler, notFoundHandler, configureErrorHandlers };
