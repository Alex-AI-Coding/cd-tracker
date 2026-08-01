(function initializeEchoChatbot() {
  "use strict";

  const BOT_NAME = "Echo";
  const DEFAULT_API_BASE_URL = "https://codetracker-production-ab72.up.railway.app/api";
  const HISTORY_VERSION = 1;
  const HISTORY_LIMIT = 80;
  const GUEST_HISTORY_KEY = `ct_echo_history_guest_v${HISTORY_VERSION}`;
  const LAYOUT_KEY = "ct_echo_layout_v1";

  function normalizeBaseUrl(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function readApiBaseUrl() {
    const fromClient = window.ApiClient?.baseUrl;
    const fromWindow = window.__CODETRACKER_API_BASE_URL || window.__API_BASE_URL;
    const fromMeta = document.querySelector('meta[name="api-base-url"]')?.getAttribute("content");
    let fromStorage = null;
    try {
      fromStorage = localStorage.getItem("api_base_url");
    } catch (_) {
      fromStorage = null;
    }
    return normalizeBaseUrl(fromClient || fromWindow || fromMeta || fromStorage || DEFAULT_API_BASE_URL);
  }

  function safeReadJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function safeWriteJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      // Continue without persistence when storage is unavailable.
    }
  }

  function escapeKeyPart(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80);
  }

  function getClassroomId() {
    const path = window.location.pathname.toLowerCase();
    if (!path.includes("/profclass/") && !path.includes("/studentclass/")) return null;
    const params = new URLSearchParams(window.location.search);
    try {
      return params.get("classroomId")
        || params.get("id")
        || localStorage.getItem("classroomId")
        || localStorage.getItem("currentClassroomId")
        || null;
    } catch (_) {
      return params.get("classroomId") || params.get("id") || null;
    }
  }

  function formatTime(timestamp) {
    try {
      return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })
        .format(new Date(timestamp));
    } catch (_) {
      return "";
    }
  }

  function readResponseBody(response) {
    return response.text().then((text) => {
      if (!text) return {};
      try {
        return JSON.parse(text);
      } catch (_) {
        return { reply: text };
      }
    });
  }

  function whenReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  whenReady(() => {
    if (!document.getElementById("chatbot-container")) {
      document.body.insertAdjacentHTML("beforeend", `
        <div id="chatbot-container" data-bot-name="${BOT_NAME}">
          <button id="chatbot-toggle" type="button" aria-label="Open ${BOT_NAME}" title="Open ${BOT_NAME}">
            <i class="fas fa-robot" aria-hidden="true"></i>
            <span class="chatbot-toggle-label">${BOT_NAME}</span>
          </button>
          <section id="chatbot-window" role="dialog" aria-modal="false" aria-label="${BOT_NAME} assistant" aria-hidden="true">
            <header id="chatbot-header">
              <div class="chatbot-identity">
                <span class="chatbot-avatar"><i class="fas fa-robot" aria-hidden="true"></i></span>
                <span class="chatbot-identity-copy"><strong>${BOT_NAME}</strong><small>CodeTracker assistant</small></span>
              </div>
              <div class="chatbot-header-actions">
                <button id="chatbot-clear" class="chatbot-icon-btn" type="button" aria-label="Clear chat history" title="Clear history">
                  <i class="fas fa-trash-can" aria-hidden="true"></i>
                </button>
                <button id="chatbot-minimize" class="chatbot-icon-btn" type="button" aria-label="Minimize ${BOT_NAME}" title="Minimize">
                  <i class="fas fa-minus" aria-hidden="true"></i>
                </button>
                <button id="chatbot-maximize" class="chatbot-icon-btn" type="button" aria-label="Maximize ${BOT_NAME}" title="Maximize">
                  <i class="fas fa-expand" aria-hidden="true"></i>
                </button>
                <button id="chatbot-close" class="chatbot-icon-btn" type="button" aria-label="Close ${BOT_NAME}" title="Close">
                  <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
              </div>
            </header>
            <div id="chatbot-status" class="chatbot-status" aria-live="polite"></div>
            <div id="chatbot-messages" aria-live="polite" aria-label="Chat history"></div>
            <form id="chatbot-input-area">
              <label class="sr-only" for="chatbot-input">Message ${BOT_NAME}</label>
              <textarea id="chatbot-input" rows="1" maxlength="2000" placeholder="Ask Echo something…" autocomplete="off"></textarea>
              <button id="chatbot-send" type="submit" aria-label="Send message">
                <i class="fas fa-paper-plane" aria-hidden="true"></i><span>Send</span>
              </button>
            </form>
            <div class="chatbot-resize-hint" aria-hidden="true"><i class="fas fa-up-right-and-down-left-from-center"></i></div>
          </section>
        </div>
      `);
    }

    const elements = {
      container: document.getElementById("chatbot-container"),
      toggle: document.getElementById("chatbot-toggle"),
      window: document.getElementById("chatbot-window"),
      header: document.getElementById("chatbot-header"),
      close: document.getElementById("chatbot-close"),
      clear: document.getElementById("chatbot-clear"),
      minimize: document.getElementById("chatbot-minimize"),
      maximize: document.getElementById("chatbot-maximize"),
      messages: document.getElementById("chatbot-messages"),
      status: document.getElementById("chatbot-status"),
      form: document.getElementById("chatbot-input-area"),
      input: document.getElementById("chatbot-input"),
      send: document.getElementById("chatbot-send")
    };

    if (Object.values(elements).some((element) => !element)) {
      console.error("Echo chatbot elements could not be initialized.");
      return;
    }

    let historyKey = GUEST_HISTORY_KEY;
    let history = [];
    let isSending = false;
    let suppressNextToggleClick = false;
    let resizeSaveTimer = null;

    function readHistory() {
      const stored = safeReadJson(historyKey, []);
      return Array.isArray(stored)
        ? stored.filter((item) => item && (item.role === "user" || item.role === "assistant") && item.text)
        : [];
    }

    function saveHistory() {
      history = history.slice(-HISTORY_LIMIT);
      safeWriteJson(historyKey, history);
    }

    function appendFormattedText(target, text) {
      const parts = String(text || "").split(/(\*\*.*?\*\*)/g);
      parts.forEach((part) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          const strong = document.createElement("strong");
          strong.textContent = part.slice(2, -2);
          target.appendChild(strong);
        } else {
          target.appendChild(document.createTextNode(part));
        }
      });
    }

    function createWelcome() {
      const welcome = document.createElement("div");
      welcome.className = "chatbot-welcome";
      welcome.innerHTML = `
        <span class="chatbot-welcome-icon"><i class="fas fa-robot" aria-hidden="true"></i></span>
        <div><strong>Hi, I’m ${BOT_NAME}.</strong><p>Ask about CodeTracker, your classroom, or an activity. Your recent chat is saved in this browser.</p></div>
      `;
      elements.messages.appendChild(welcome);
    }

    function renderMessage(item, { animate = false, temporary = false } = {}) {
      const wrapper = document.createElement("article");
      wrapper.className = `chat-message ${item.role === "user" ? "user-message" : "bot-message"}`;
      if (animate) wrapper.classList.add("chat-message-animation");
      if (temporary) wrapper.dataset.temporary = "true";

      const bubble = document.createElement("div");
      bubble.className = "chat-message-bubble";
      appendFormattedText(bubble, item.text);

      const meta = document.createElement("div");
      meta.className = "chat-message-meta";
      meta.textContent = `${item.role === "user" ? "You" : BOT_NAME}${item.timestamp ? ` · ${formatTime(item.timestamp)}` : ""}`;

      wrapper.append(bubble, meta);
      elements.messages.appendChild(wrapper);
      elements.messages.scrollTop = elements.messages.scrollHeight;
      return wrapper;
    }

    function renderHistory() {
      elements.messages.innerHTML = "";
      history = readHistory();
      if (!history.length) createWelcome();
      history.forEach((item) => renderMessage(item));
      elements.messages.scrollTop = elements.messages.scrollHeight;
    }

    function addPersistentMessage(text, role) {
      const item = { role, text: String(text || ""), timestamp: Date.now() };
      const welcome = elements.messages.querySelector(".chatbot-welcome");
      welcome?.remove();
      history.push(item);
      saveHistory();
      return renderMessage(item, { animate: true });
    }

    function setStatus(message = "") {
      elements.status.textContent = message;
      elements.status.classList.toggle("is-visible", Boolean(message));
    }

    function setSending(sending) {
      isSending = sending;
      elements.input.disabled = sending;
      elements.send.disabled = sending;
      elements.send.classList.toggle("is-loading", sending);
    }

    function autoGrowInput() {
      elements.input.style.height = "auto";
      elements.input.style.height = `${Math.min(elements.input.scrollHeight, 120)}px`;
    }

    function getLayout() {
      const value = safeReadJson(LAYOUT_KEY, {});
      return value && typeof value === "object" ? value : {};
    }

    function saveLayout(patch) {
      safeWriteJson(LAYOUT_KEY, { ...getLayout(), ...patch });
    }

    function clampLauncherPosition(x, y) {
      const margin = 12;
      const rect = elements.toggle.getBoundingClientRect();
      return {
        x: Math.min(Math.max(margin, x), Math.max(margin, window.innerWidth - rect.width - margin)),
        y: Math.min(Math.max(margin, y), Math.max(margin, window.innerHeight - rect.height - margin))
      };
    }

    function applySavedLayout() {
      const layout = getLayout();
      if (Number.isFinite(layout.launcherX) && Number.isFinite(layout.launcherY)) {
        const position = clampLauncherPosition(layout.launcherX, layout.launcherY);
        elements.container.style.left = `${position.x}px`;
        elements.container.style.top = `${position.y}px`;
        elements.container.style.right = "auto";
        elements.container.style.bottom = "auto";
      }
      if (Number.isFinite(layout.width)) elements.window.style.width = `${layout.width}px`;
      if (Number.isFinite(layout.height)) elements.window.style.height = `${layout.height}px`;
      elements.window.classList.toggle("chatbot-maximized", Boolean(layout.maximized));
      elements.window.classList.toggle("chatbot-minimized", Boolean(layout.minimized));
      updateWindowControls();
    }

    function clampWindowToViewport() {
      if (elements.window.classList.contains("chatbot-maximized")) return;
      const maxWidth = Math.max(300, window.innerWidth - 24);
      const maxHeight = Math.max(360, window.innerHeight - 24);
      const width = Math.min(elements.window.offsetWidth, maxWidth);
      const height = Math.min(elements.window.offsetHeight, maxHeight);
      elements.window.style.width = `${width}px`;
      elements.window.style.height = `${height}px`;
    }

    function openChatbot() {
      elements.window.classList.add("chatbot-open");
      elements.window.setAttribute("aria-hidden", "false");
      elements.toggle.classList.add("chatbot-toggle-hidden");
      clampWindowToViewport();
      window.setTimeout(() => elements.input.focus(), 180);
    }

    function closeChatbot() {
      elements.window.classList.remove("chatbot-open");
      elements.window.setAttribute("aria-hidden", "true");
      elements.toggle.classList.remove("chatbot-toggle-hidden");
      elements.toggle.focus({ preventScroll: true });
    }

    function updateWindowControls() {
      const isMinimized = elements.window.classList.contains("chatbot-minimized");
      const isMaximized = elements.window.classList.contains("chatbot-maximized");
      const minimizeIcon = elements.minimize.querySelector("i");
      const maximizeIcon = elements.maximize.querySelector("i");

      elements.minimize.setAttribute("aria-label", isMinimized ? `Restore ${BOT_NAME}` : `Minimize ${BOT_NAME}`);
      elements.minimize.title = isMinimized ? "Restore" : "Minimize";
      if (minimizeIcon) minimizeIcon.className = isMinimized ? "fas fa-window-restore" : "fas fa-minus";

      elements.maximize.setAttribute("aria-label", isMaximized ? `Restore ${BOT_NAME} window size` : `Maximize ${BOT_NAME}`);
      elements.maximize.title = isMaximized ? "Restore size" : "Maximize";
      if (maximizeIcon) maximizeIcon.className = isMaximized ? "fas fa-compress" : "fas fa-expand";
    }

    function toggleMinimize() {
      const willMinimize = !elements.window.classList.contains("chatbot-minimized");
      elements.window.classList.toggle("chatbot-minimized", willMinimize);
      if (willMinimize) elements.window.classList.remove("chatbot-maximized");
      saveLayout({ minimized: willMinimize, maximized: false });
      updateWindowControls();
      if (!willMinimize) elements.input.focus();
    }

    function toggleMaximize() {
      const willMaximize = !elements.window.classList.contains("chatbot-maximized");
      elements.window.classList.toggle("chatbot-maximized", willMaximize);
      elements.window.classList.remove("chatbot-minimized");
      saveLayout({ maximized: willMaximize, minimized: false });
      updateWindowControls();
      elements.input.focus();
    }

    async function clearHistory() {
      const confirmed = window.AppDialog?.confirm
        ? await window.AppDialog.confirm("Clear Echo’s saved chat history on this browser?", {
            title: "Clear chat history",
            confirmText: "Clear history",
            cancelText: "Keep history",
            danger: true
          })
        : window.confirm("Clear Echo’s saved chat history on this browser?");
      if (!confirmed) return;
      history = [];
      saveHistory();
      renderHistory();
      setStatus("Chat history cleared.");
      window.setTimeout(() => setStatus(""), 1800);
    }

    async function sendMessage() {
      const message = elements.input.value.trim();
      if (!message || isSending) return;

      addPersistentMessage(message, "user");
      elements.input.value = "";
      autoGrowInput();
      setSending(true);
      setStatus(`${BOT_NAME} is thinking…`);
      const thinking = renderMessage({ role: "assistant", text: `${BOT_NAME} is thinking…`, timestamp: Date.now() }, { temporary: true });
      thinking.classList.add("chatbot-thinking");

      try {
        const response = await fetch(`${readApiBaseUrl()}/chatbot`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "include",
          body: JSON.stringify({ message, classroomId: getClassroomId() })
        });
        const data = await readResponseBody(response);
        thinking.remove();

        const reply = response.ok
          ? data.reply || data.message || "Sorry, I could not generate a response."
          : data.reply || data.message || data.error || "Sorry, I could not access that information.";
        addPersistentMessage(reply, "assistant");
      } catch (error) {
        thinking.remove();
        console.error("Echo chatbot error:", error);
        addPersistentMessage("I couldn’t connect right now. Please check your connection and try again.", "assistant");
      } finally {
        setSending(false);
        setStatus("");
        elements.input.focus();
      }
    }

    function setupLauncherDrag() {
      let drag = null;

      elements.toggle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const rect = elements.toggle.getBoundingClientRect();
        drag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: rect.left,
          originY: rect.top,
          moved: false
        };
        elements.toggle.setPointerCapture(event.pointerId);
        elements.toggle.classList.add("is-dragging");
      });

      elements.toggle.addEventListener("pointermove", (event) => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (Math.hypot(dx, dy) > 5) drag.moved = true;
        if (!drag.moved) return;

        const position = clampLauncherPosition(drag.originX + dx, drag.originY + dy);
        elements.container.style.left = `${position.x}px`;
        elements.container.style.top = `${position.y}px`;
        elements.container.style.right = "auto";
        elements.container.style.bottom = "auto";
      });

      function finishDrag(event) {
        if (!drag || drag.pointerId !== event.pointerId) return;
        elements.toggle.classList.remove("is-dragging");
        if (drag.moved) {
          const rect = elements.toggle.getBoundingClientRect();
          saveLayout({ launcherX: rect.left, launcherY: rect.top });
          suppressNextToggleClick = true;
          window.setTimeout(() => { suppressNextToggleClick = false; }, 0);
        }
        drag = null;
      }

      elements.toggle.addEventListener("pointerup", finishDrag);
      elements.toggle.addEventListener("pointercancel", finishDrag);
    }

    async function resolveHistoryScope() {
      if (!window.ApiClient?.request || !/\/(dashboard|studentclass|profclass|syntax)/i.test(location.pathname)) return;
      try {
        const profile = await window.ApiClient.request(
          "/users/profile",
          { method: "GET", headers: { Accept: "application/json" } },
          { redirectOnUnauthorized: false, retryOnRefresh: false }
        );
        const identifier = profile?.userId || profile?.id || profile?.email || profile?.data?.userId || profile?.data?.id;
        if (!identifier) return;
        const userKey = `ct_echo_history_${escapeKeyPart(identifier)}_v${HISTORY_VERSION}`;
        if (userKey === historyKey) return;
        historyKey = userKey;
        renderHistory();
      } catch (_) {
        // Guest/browser-scoped history remains active.
      }
    }

    elements.toggle.addEventListener("click", () => {
      if (suppressNextToggleClick) return;
      openChatbot();
    });
    elements.close.addEventListener("click", closeChatbot);
    elements.clear.addEventListener("click", clearHistory);
    elements.minimize.addEventListener("click", toggleMinimize);
    elements.maximize.addEventListener("click", toggleMaximize);
    elements.form.addEventListener("submit", (event) => {
      event.preventDefault();
      void sendMessage();
    });
    elements.input.addEventListener("input", autoGrowInput);
    elements.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendMessage();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && elements.window.classList.contains("chatbot-open")) closeChatbot();
    });

    setupLauncherDrag();
    applySavedLayout();
    renderHistory();
    autoGrowInput();
    void resolveHistoryScope();

    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        if (!elements.window.classList.contains("chatbot-open")
          || elements.window.classList.contains("chatbot-maximized")
          || elements.window.classList.contains("chatbot-minimized")) return;
        window.clearTimeout(resizeSaveTimer);
        resizeSaveTimer = window.setTimeout(() => {
          saveLayout({ width: elements.window.offsetWidth, height: elements.window.offsetHeight });
        }, 180);
      });
      resizeObserver.observe(elements.window);
    }

    window.addEventListener("resize", () => {
      const rect = elements.toggle.getBoundingClientRect();
      const position = clampLauncherPosition(rect.left, rect.top);
      if (elements.container.style.left) {
        elements.container.style.left = `${position.x}px`;
        elements.container.style.top = `${position.y}px`;
        saveLayout({ launcherX: position.x, launcherY: position.y });
      }
      clampWindowToViewport();
    });
  });
})();
