import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";


window.React = React;

console.log("main.jsx loading...");
console.log("React imported:", !!React);
console.log("StrictMode imported:", !!StrictMode);
console.log("createRoot imported:", !!createRoot);
console.log("App imported:", !!App);

try {
  const rootElement = document.getElementById("root");
  console.log("Root element found:", !!rootElement);

  if (rootElement) {
    const root = createRoot(rootElement);
    console.log("Root created:", !!root);

    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    console.log("App rendered successfully");
  } else {
    console.error("Could not find root element");
  }
} catch (error) {
  console.error("Error rendering React app:", error);
}
