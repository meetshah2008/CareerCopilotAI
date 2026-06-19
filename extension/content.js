(function() {
  "use strict";

  const BACKEND_URL = "http://127.0.0.1:8000";
  let currentBtn = null;
  let currentToneSelect = null;
  let currentField = null;
  let debounceTimer = null;

  function extractQuestion(field) {
    if (field.placeholder && field.placeholder.length > 3) return field.placeholder;
    if (field.getAttribute("aria-label")) return field.getAttribute("aria-label");

    const id = field.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent.trim();
    }

    const parent = field.closest(".form-group, .field, .question, [class*='field'], [class*='question']");
    if (parent) {
      const label = parent.querySelector("label, .label, legend, [class*='label']");
      if (label) return label.textContent.trim();
    }

    const prev = field.previousElementSibling;
    if (prev && prev.textContent.trim().length > 3) return prev.textContent.trim();

    if (field.name) return field.name.replace(/[_-]/g, " ");

    return null;
  }

  function isFillableField(el) {
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName === "INPUT") {
      const type = (el.type || "text").toLowerCase();
      return ["text", "email", "tel", "url", "search", ""].includes(type);
    }
    if (el.isContentEditable) return true;
    return false;
  }

  function showToast(message, isError = false) {
    const existing = document.querySelector(".cc-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = `cc-toast${isError ? " cc-toast-error" : ""}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "cc-fade-out 0.3s ease-out forwards";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function removeUI() {
    if (currentBtn) { currentBtn.remove(); currentBtn = null; }
    if (currentToneSelect) { currentToneSelect.remove(); currentToneSelect = null; }
  }

  async function handleAIFill(field, question, tone) {
    if (!currentBtn) return;

    currentBtn.classList.add("cc-loading");
    currentBtn.innerHTML = '<span class="cc-sparkle">⏳</span> Generating…';

    try {
      const response = await chrome.runtime.sendMessage({
        action: "fetch_answer",
        query: question,
        tone: tone
      });

      if (!response || !response.success) {
        throw new Error(response ? response.error : "Failed to communicate with background script");
      }

      const answer = response.data.answer;

      if (field.isContentEditable) {
        field.innerText = answer;
      } else {
        field.value = answer;
      }

      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));

      field.classList.add("cc-filled");
      showToast("✅ CareerCopilot filled the field!");

      removeUI();
    } catch (err) {
      console.error("[CareerCopilot]", err);
      showToast(`❌ Error: ${err.message}`, true);

      if (currentBtn) {
        currentBtn.classList.remove("cc-loading");
        currentBtn.innerHTML = '<span class="cc-sparkle">✨</span> AI Fill';
      }
    }
  }

  function showAIButton(field) {
    removeUI();
    currentField = field;

    const question = extractQuestion(field);
    if (!question) return;

    const rect = field.getBoundingClientRect();

    const toneSelect = document.createElement("select");
    toneSelect.className = "cc-tone-select";
    toneSelect.innerHTML = `
      <option value="professional">Professional</option>
      <option value="short">Short</option>
      <option value="detailed">Detailed</option>
      <option value="ats_friendly">ATS Friendly</option>
      <option value="formal">Formal</option>
    `;
    toneSelect.style.top = `${window.scrollY + rect.top - 30}px`;
    toneSelect.style.left = `${window.scrollX + rect.right - 200}px`;
    document.body.appendChild(toneSelect);
    currentToneSelect = toneSelect;

    const btn = document.createElement("button");
    btn.className = "cc-ai-btn";
    btn.innerHTML = '<span class="cc-sparkle">✨</span> AI Fill';
    btn.style.top = `${window.scrollY + rect.top - 30}px`;
    btn.style.left = `${window.scrollX + rect.right - 90}px`;
    document.body.appendChild(btn);
    currentBtn = btn;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleAIFill(field, question, toneSelect.value);
    });
  }

  document.addEventListener("focusin", (e) => {
    if (isFillableField(e.target)) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => showAIButton(e.target), 100);
    }
  });

  document.addEventListener("click", (e) => {
    if (currentBtn && !currentBtn.contains(e.target) &&
        currentToneSelect && !currentToneSelect.contains(e.target) &&
        e.target !== currentField) {
      setTimeout(() => {
        if (currentBtn && !currentBtn.matches(":hover")) {
          removeUI();
        }
      }, 150);
    }
  });

  console.log("[CareerCopilot AI] Content script loaded ✅");
})();
