/**
 * CareerCopilot AI — Background Service Worker
 *
 * Handles API requests to the local backend.
 * By moving fetch() here, we avoid "Mixed Content" and CSP blocks
 * that happen when content.js tries to fetch http:// from https:// pages.
 */

const BACKEND_URL = "http://127.0.0.1:8000";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetch_answer") {
    fetch(`${BACKEND_URL}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: request.query, tone: request.tone }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Backend error: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        sendResponse({ success: true, data: data });
      })
      .catch((error) => {
        console.error("[CareerCopilot Background]", error);
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }
});
