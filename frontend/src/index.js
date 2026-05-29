// Polyfills for legacy browsers (Smart TVs: Tizen, WebOS, older Android TV WebViews).
// IMPORTANT: these must be the very first imports so the polyfills run before
// any other module touches the browser globals.
import "react-app-polyfill/stable";

import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import ErrorBoundary from "@/components/ErrorBoundary";

// Silently swallow generic cross-origin "Script error." noise that Smart-TV
// and older browsers emit — these are usually third-party or extension-triggered
// and have no actionable info (they're masked by the browser's CORS rules).
// All real, same-origin errors still propagate to the ErrorBoundary and console.
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    if (event && event.message === "Script error." && !event.filename) {
      event.preventDefault();
      return false;
    }
  });
  window.addEventListener("unhandledrejection", (event) => {
    const msg = event && event.reason && event.reason.message;
    if (msg === "Script error.") {
      event.preventDefault();
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
