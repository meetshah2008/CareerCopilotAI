/**
 * CareerCopilot AI — Popup Script
 *
 * Handles manual queries from the popup UI and displays results.
 */

const BACKEND_URL = "http://127.0.0.1:8000";

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const queryInput = document.getElementById("queryInput");
const toneSelect = document.getElementById("toneSelect");
const askBtn = document.getElementById("askBtn");
const answerBox = document.getElementById("answerBox");
const answerText = document.getElementById("answerText");
const copyBtn = document.getElementById("copyBtn");

// ── Health Check ───────────────────────────────────────────────────────

async function checkBackend() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { method: "GET" });
    if (res.ok) {
      statusDot.classList.add("connected");
      statusText.textContent = "Backend connected";
    } else {
      throw new Error("Not OK");
    }
  } catch {
    statusDot.classList.remove("connected");
    statusText.textContent = "Backend offline — start the server";
  }
}

// ── Generate Answer ────────────────────────────────────────────────────

async function generateAnswer() {
  const query = queryInput.value.trim();
  if (!query) return;

  askBtn.disabled = true;
  askBtn.textContent = "⏳ Generating…";

  try {
    const res = await fetch(`${BACKEND_URL}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, tone: toneSelect.value }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Server error: ${res.status}`);
    }

    const data = await res.json();
    answerText.textContent = data.answer;
    answerBox.classList.add("visible");
  } catch (err) {
    answerText.textContent = `Error: ${err.message}`;
    answerBox.classList.add("visible");
  } finally {
    askBtn.disabled = false;
    askBtn.textContent = "✨ Generate";
  }
}

// ── Copy ───────────────────────────────────────────────────────────────

copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(answerText.textContent).then(() => {
    copyBtn.textContent = "✅ Copied!";
    setTimeout(() => (copyBtn.textContent = "📋 Copy to clipboard"), 1500);
  });
});

// ── Events ─────────────────────────────────────────────────────────────

askBtn.addEventListener("click", generateAnswer);
queryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    generateAnswer();
  }
});

// ── Init ───────────────────────────────────────────────────────────────
checkBackend();
