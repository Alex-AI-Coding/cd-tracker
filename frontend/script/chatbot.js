(function initializeEchoChatbot() {
  "use strict";

  const INSTANCE_KEY = "__CODETRACKER_ECHO_INSTANCE_V2__";

  if (window[INSTANCE_KEY]) {
    window[INSTANCE_KEY].ensureVisible?.();
    return;
  }

  // Reserve the singleton immediately so duplicate script tags cannot
  // register a second set of listeners before DOMContentLoaded.
  window[INSTANCE_KEY] = Object.freeze({
    ensureVisible() {}
  });

  const BOT_NAME = "Echo";
  const UI_VERSION = "2";
  const DEFAULT_API_BASE_URL = "https://codetracker-production-ab72.up.railway.app/api";
  const HISTORY_VERSION = 2;
  const HISTORY_LIMIT = 80;
  const HISTORY_CHARACTER_LIMIT = 160000;
  const MESSAGE_CHARACTER_LIMIT = 12000;
  const REQUEST_TIMEOUT_MS = 35000;
  const GUEST_HISTORY_KEY = `ct_echo_history_guest_v${HISTORY_VERSION}`;
  const LAYOUT_KEY = "ct_echo_layout_v2";
  const LEGACY_LAYOUT_KEY = "ct_echo_layout_v1";
  const DRAG_THRESHOLD = 6;
  const DESKTOP_MARGIN = 16;
  const MOBILE_MARGIN = 8;

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function normalizeBaseUrl(value) {
    const candidate = String(value || "").trim();

    if (!candidate) {
      return DEFAULT_API_BASE_URL;
    }

    try {
      const url = new URL(candidate, window.location.origin);

      if (!/^https?:$/.test(url.protocol)) {
        return DEFAULT_API_BASE_URL;
      }

      return url.href.replace(/\/+$/, "");
    } catch (_) {
      return DEFAULT_API_BASE_URL;
    }
  }

  function readApiBaseUrl() {
    const fromClient = window.ApiClient?.baseUrl;
    const fromWindow = window.__CODETRACKER_API_BASE_URL || window.__API_BASE_URL;
    const fromMeta = document
      .querySelector('meta[name="api-base-url"]')
      ?.getAttribute("content");

    let fromStorage = null;

    try {
      fromStorage = localStorage.getItem("api_base_url");
    } catch (_) {
      fromStorage = null;
    }

    return normalizeBaseUrl(
      fromClient ||
      fromWindow ||
      fromMeta ||
      fromStorage ||
      DEFAULT_API_BASE_URL
    );
  }

  function safeReadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);

      if (!raw) {
        return fallback;
      }

      const value = JSON.parse(raw);
      return value ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function safeWriteJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function safeRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) {
      // Storage can be unavailable in private or restricted browser modes.
    }
  }

  function escapeKeyPart(value) {
    return String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .slice(0, 80);
  }

  function getClassroomId() {
    const path = window.location.pathname.toLowerCase();

    if (!path.includes("/profclass/") && !path.includes("/studentclass/")) {
      return null;
    }

    const params = new URLSearchParams(window.location.search);

    try {
      return (
        params.get("classroomId") ||
        params.get("id") ||
        localStorage.getItem("classroomId") ||
        localStorage.getItem("currentClassroomId") ||
        null
      );
    } catch (_) {
      return params.get("classroomId") || params.get("id") || null;
    }
  }

  function formatTime(timestamp) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit"
      }).format(new Date(timestamp));
    } catch (_) {
      return "";
    }
  }

  async function readResponseBody(response) {
    const text = await response.text();

    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch (_) {
      return { reply: text };
    }
  }

  function whenReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function getViewportBounds() {
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;

    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height
    };
  }

  function isCompactViewport() {
    const viewport = getViewportBounds();
    return viewport.width <= 600 || viewport.height <= 520;
  }

  function getViewportMargin() {
    return isCompactViewport() ? MOBILE_MARGIN : DESKTOP_MARGIN;
  }

  function sanitizeHistoryItem(item) {
    if (!item || (item.role !== "user" && item.role !== "assistant")) {
      return null;
    }

    const text = String(item.text || "").trim().slice(0, MESSAGE_CHARACTER_LIMIT);

    if (!text) {
      return null;
    }

    return {
      role: item.role,
      text,
      timestamp: Number.isFinite(Number(item.timestamp))
        ? Number(item.timestamp)
        : Date.now()
    };
  }

  function trimHistory(items) {
    const sanitized = items
      .map(sanitizeHistoryItem)
      .filter(Boolean)
      .slice(-HISTORY_LIMIT);

    let totalCharacters = sanitized.reduce((sum, item) => sum + item.text.length, 0);

    while (sanitized.length > 1 && totalCharacters > HISTORY_CHARACTER_LIMIT) {
      const removed = sanitized.shift();
      totalCharacters -= removed.text.length;
    }

    return sanitized;
  }

  function safelyPersistHistory(key, items) {
    let candidate = trimHistory(items);

    while (candidate.length) {
      if (safeWriteJson(key, candidate)) {
        return candidate;
      }

      candidate = candidate.slice(Math.max(1, Math.floor(candidate.length / 4)));
    }

    safeRemove(key);
    return [];
  }

  whenReady(() => {
    const existingContainer = document.getElementById("chatbot-container");

    if (existingContainer && existingContainer.dataset.echoVersion !== UI_VERSION) {
      existingContainer.remove();
    }

    if (!document.getElementById("chatbot-container")) {
      document.body.insertAdjacentHTML(
        "beforeend",
        `
          <div id="chatbot-container" data-bot-name="${BOT_NAME}" data-echo-version="${UI_VERSION}">
            <button
              id="chatbot-toggle"
              type="button"
              aria-label="Open ${BOT_NAME}"
              aria-expanded="false"
              aria-controls="chatbot-window"
              aria-grabbed="false"
              title="Open ${BOT_NAME}"
            >
              <span class="chatbot-toggle-content">
                <i class="fas fa-robot" aria-hidden="true"></i>
                <span class="chatbot-toggle-label">${BOT_NAME}</span>
              </span>
            </button>

            <section
              id="chatbot-window"
              role="dialog"
              aria-modal="false"
              aria-label="${BOT_NAME} assistant"
              aria-hidden="true"
            >
              <header id="chatbot-header">
                <div class="chatbot-identity">
                  <span class="chatbot-avatar">
                    <i class="fas fa-robot" aria-hidden="true"></i>
                  </span>

                  <span class="chatbot-identity-copy">
                    <strong>${BOT_NAME}</strong>
                    <small>CodeTracker assistant</small>
                  </span>
                </div>

                <div class="chatbot-header-actions">
                  <button
                    id="chatbot-reset"
                    class="chatbot-icon-btn"
                    type="button"
                    aria-label="Reset ${BOT_NAME} position and size"
                    title="Reset position and size"
                  >
                    <i class="fas fa-location-crosshairs" aria-hidden="true"></i>
                  </button>

                  <button
                    id="chatbot-clear"
                    class="chatbot-icon-btn"
                    type="button"
                    aria-label="Clear chat history"
                    title="Clear history"
                  >
                    <i class="fas fa-trash-can" aria-hidden="true"></i>
                  </button>

                  <button
                    id="chatbot-minimize"
                    class="chatbot-icon-btn"
                    type="button"
                    aria-label="Minimize ${BOT_NAME}"
                    title="Minimize"
                  >
                    <i class="fas fa-minus" aria-hidden="true"></i>
                  </button>

                  <button
                    id="chatbot-maximize"
                    class="chatbot-icon-btn"
                    type="button"
                    aria-label="Maximize ${BOT_NAME}"
                    title="Maximize"
                  >
                    <i class="fas fa-expand" aria-hidden="true"></i>
                  </button>

                  <button
                    id="chatbot-close"
                    class="chatbot-icon-btn"
                    type="button"
                    aria-label="Close ${BOT_NAME}"
                    title="Close"
                  >
                    <i class="fas fa-xmark" aria-hidden="true"></i>
                  </button>
                </div>
              </header>

              <div
                id="chatbot-status"
                class="chatbot-status"
                role="status"
                aria-live="polite"
              ></div>

              <div
                id="chatbot-messages"
                aria-live="polite"
                aria-label="Chat history"
              ></div>

              <form id="chatbot-input-area">
                <label class="sr-only" for="chatbot-input">Message ${BOT_NAME}</label>

                <textarea
                  id="chatbot-input"
                  rows="1"
                  maxlength="2000"
                  placeholder="Ask Echo something…"
                  autocomplete="off"
                ></textarea>

                <button id="chatbot-send" type="submit" aria-label="Send message">
                  <i class="fas fa-paper-plane" aria-hidden="true"></i>
                  <span>Send</span>
                </button>
              </form>

              <div class="chatbot-resize-hint" aria-hidden="true">
                <i class="fas fa-up-right-and-down-left-from-center"></i>
              </div>
            </section>
          </div>
        `
      );
    }

    const elements = {
      container: document.getElementById("chatbot-container"),
      toggle: document.getElementById("chatbot-toggle"),
      window: document.getElementById("chatbot-window"),
      header: document.getElementById("chatbot-header"),
      close: document.getElementById("chatbot-close"),
      clear: document.getElementById("chatbot-clear"),
      reset: document.getElementById("chatbot-reset"),
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
    let isOpen = false;
    let suppressNextToggleClick = false;
    let resizeSaveTimer = null;
    let launcherAnimationTimer = null;
    let windowAnimationTimer = null;
    let statusTimer = null;
    let activeRequestController = null;
    let dragFrame = null;
    let pendingDragPosition = null;

    const cleanupCallbacks = [];

    function addManagedEvent(target, type, listener, options) {
      target.addEventListener(type, listener, options);
      cleanupCallbacks.push(() => target.removeEventListener(type, listener, options));
    }

    function readHistory() {
      const stored = safeReadJson(historyKey, []);
      return Array.isArray(stored) ? trimHistory(stored) : [];
    }

    function saveHistory() {
      history = safelyPersistHistory(historyKey, history);
    }

    function appendFormattedText(target, text) {
      const parts = String(text || "").split(/(\*\*[^*]+\*\*)/g);

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
        <span class="chatbot-welcome-icon">
          <i class="fas fa-robot" aria-hidden="true"></i>
        </span>
        <div>
          <strong>Hi, I’m ${BOT_NAME}.</strong>
          <p>
            Ask about CodeTracker, your classroom, or an activity.
            Your recent chat is saved in this browser.
          </p>
        </div>
      `;
      elements.messages.appendChild(welcome);
    }

    function renderMessage(item, { animate = false, temporary = false } = {}) {
      const wrapper = document.createElement("article");
      wrapper.className = `chat-message ${item.role === "user" ? "user-message" : "bot-message"}`;

      if (animate && !reducedMotionQuery.matches) {
        wrapper.classList.add("chat-message-animation");
      }

      if (temporary) {
        wrapper.dataset.temporary = "true";
      }

      const bubble = document.createElement("div");
      bubble.className = "chat-message-bubble";
      appendFormattedText(bubble, item.text);

      const meta = document.createElement("div");
      meta.className = "chat-message-meta";
      meta.textContent = `${item.role === "user" ? "You" : BOT_NAME}${
        item.timestamp ? ` · ${formatTime(item.timestamp)}` : ""
      }`;

      wrapper.append(bubble, meta);
      elements.messages.appendChild(wrapper);
      elements.messages.scrollTop = elements.messages.scrollHeight;
      return wrapper;
    }

    function renderHistory() {
      elements.messages.innerHTML = "";
      history = readHistory();

      if (!history.length) {
        createWelcome();
      }

      history.forEach((item) => renderMessage(item));
      elements.messages.scrollTop = elements.messages.scrollHeight;
    }

    function addPersistentMessage(text, role) {
      const item = sanitizeHistoryItem({
        role,
        text: String(text || ""),
        timestamp: Date.now()
      });

      if (!item) {
        return null;
      }

      elements.messages.querySelector(".chatbot-welcome")?.remove();
      history.push(item);
      saveHistory();
      return renderMessage(item, { animate: true });
    }

    function setStatus(message = "", duration = 0) {
      window.clearTimeout(statusTimer);
      elements.status.textContent = message;
      elements.status.classList.toggle("is-visible", Boolean(message));

      if (message && duration > 0) {
        statusTimer = window.setTimeout(() => setStatus(""), duration);
      }
    }

    function setSending(sending) {
      isSending = sending;
      elements.input.disabled = sending;
      elements.send.disabled = sending;
      elements.clear.disabled = sending;
      elements.send.classList.toggle("is-loading", sending);
      elements.form.setAttribute("aria-busy", String(sending));
    }

    function autoGrowInput() {
      elements.input.style.height = "auto";
      elements.input.style.height = `${Math.min(elements.input.scrollHeight, 120)}px`;
    }

    function sanitizeLayout(value) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
      }

      const layout = {};

      if (isFiniteNumber(value.launcherX)) {
        layout.launcherX = clamp(value.launcherX, -10000, 10000);
      }

      if (isFiniteNumber(value.launcherY)) {
        layout.launcherY = clamp(value.launcherY, -10000, 10000);
      }

      if (isFiniteNumber(value.width)) {
        layout.width = clamp(value.width, 240, 2400);
      }

      if (isFiniteNumber(value.height)) {
        layout.height = clamp(value.height, 260, 2400);
      }

      layout.maximized = Boolean(value.maximized);
      layout.minimized = Boolean(value.minimized);
      return layout;
    }

    function migrateLegacyLayout() {
      const current = safeReadJson(LAYOUT_KEY, null);

      if (current && typeof current === "object") {
        return;
      }

      const legacy = sanitizeLayout(safeReadJson(LEGACY_LAYOUT_KEY, {}));

      if (Object.keys(legacy).length) {
        safeWriteJson(LAYOUT_KEY, legacy);
      }

      safeRemove(LEGACY_LAYOUT_KEY);
    }

    function getLayout() {
      return sanitizeLayout(safeReadJson(LAYOUT_KEY, {}));
    }

    function saveLayout(patch, removeKeys = []) {
      const next = {
        ...getLayout(),
        ...patch
      };

      removeKeys.forEach((key) => delete next[key]);
      safeWriteJson(LAYOUT_KEY, sanitizeLayout(next));
    }

    function clampLauncherPosition(x, y) {
      const bounds = getViewportBounds();
      const margin = getViewportMargin();
      const rect = elements.toggle.getBoundingClientRect();
      const width = Math.max(rect.width, elements.toggle.offsetWidth, 1);
      const height = Math.max(rect.height, elements.toggle.offsetHeight, 1);
      const maximumX = Math.max(bounds.left + margin, bounds.right - width - margin);
      const maximumY = Math.max(bounds.top + margin, bounds.bottom - height - margin);

      return {
        x: clamp(x, bounds.left + margin, maximumX),
        y: clamp(y, bounds.top + margin, maximumY)
      };
    }

    function positionLauncher(x, y, { persist = false } = {}) {
      const position = clampLauncherPosition(x, y);

      elements.container.style.left = `${position.x}px`;
      elements.container.style.top = `${position.y}px`;
      elements.container.style.right = "auto";
      elements.container.style.bottom = "auto";

      if (persist) {
        saveLayout({ launcherX: position.x, launcherY: position.y });
      }

      return position;
    }

    function resetLauncherToDefault({ animate = true, persist = true } = {}) {
      elements.container.style.left = "";
      elements.container.style.top = "";
      elements.container.style.right = "";
      elements.container.style.bottom = "";

      if (persist) {
        saveLayout({}, ["launcherX", "launcherY"]);
      }

      if (animate && !reducedMotionQuery.matches) {
        elements.toggle.classList.remove("is-settling", "chatbot-launcher-entering");
        void elements.toggle.offsetWidth;
        elements.toggle.classList.add("is-settling");
      }

      window.requestAnimationFrame(() => ensureLauncherVisible({ persist }));
    }

    function ensureLauncherVisible({ persist = true } = {}) {
      const rect = elements.toggle.getBoundingClientRect();

      if (!rect.width || !rect.height) {
        return;
      }

      const position = clampLauncherPosition(rect.left, rect.top);
      const moved = Math.abs(position.x - rect.left) > 0.5 || Math.abs(position.y - rect.top) > 0.5;

      if (moved || elements.container.style.left) {
        positionLauncher(position.x, position.y, { persist });
      }
    }

    function applySavedLayout() {
      const layout = getLayout();

      if (isFiniteNumber(layout.launcherX) && isFiniteNumber(layout.launcherY)) {
        positionLauncher(layout.launcherX, layout.launcherY, { persist: true });
      } else {
        resetLauncherToDefault({ animate: false, persist: false });
      }

      if (!isCompactViewport()) {
        if (isFiniteNumber(layout.width)) {
          elements.window.style.width = `${layout.width}px`;
        }

        if (isFiniteNumber(layout.height)) {
          elements.window.style.height = `${layout.height}px`;
        }
      }

      elements.window.classList.toggle("chatbot-maximized", Boolean(layout.maximized));
      elements.window.classList.toggle("chatbot-minimized", Boolean(layout.minimized));
      updateWindowControls();

      window.requestAnimationFrame(() => {
        ensureLauncherVisible({ persist: true });
        clampWindowToViewport();
      });
    }

    function clampWindowToViewport() {
      if (elements.window.classList.contains("chatbot-maximized")) {
        return;
      }

      if (isCompactViewport()) {
        elements.window.style.removeProperty("width");
        elements.window.style.removeProperty("height");
        return;
      }

      const bounds = getViewportBounds();
      const margin = getViewportMargin();
      const availableWidth = Math.max(240, bounds.width - margin * 2);
      const availableHeight = Math.max(260, bounds.height - margin * 2);
      const width = Math.min(elements.window.offsetWidth || 390, availableWidth);
      const height = Math.min(elements.window.offsetHeight || 560, availableHeight);

      elements.window.style.width = `${width}px`;
      elements.window.style.height = `${height}px`;
    }

    function clearAnimationTimer(name) {
      if (name === "launcher") {
        window.clearTimeout(launcherAnimationTimer);
        launcherAnimationTimer = null;
      } else {
        window.clearTimeout(windowAnimationTimer);
        windowAnimationTimer = null;
      }
    }

    function animateLauncherOut() {
      clearAnimationTimer("launcher");
      elements.toggle.classList.remove("chatbot-launcher-entering", "is-settling");

      if (reducedMotionQuery.matches) {
        elements.toggle.classList.add("chatbot-toggle-hidden");
        return;
      }

      elements.toggle.classList.add("chatbot-launcher-exiting");
      launcherAnimationTimer = window.setTimeout(() => {
        elements.toggle.classList.remove("chatbot-launcher-exiting");
        elements.toggle.classList.add("chatbot-toggle-hidden");
      }, 190);
    }

    function animateLauncherIn() {
      clearAnimationTimer("launcher");
      elements.toggle.classList.remove("chatbot-launcher-exiting", "chatbot-toggle-hidden");

      if (reducedMotionQuery.matches) {
        return;
      }

      elements.toggle.classList.remove("chatbot-launcher-entering");
      void elements.toggle.offsetWidth;
      elements.toggle.classList.add("chatbot-launcher-entering");

      launcherAnimationTimer = window.setTimeout(() => {
        elements.toggle.classList.remove("chatbot-launcher-entering");
      }, 380);
    }

    function focusSafely(element) {
      try {
        element?.focus({ preventScroll: true });
      } catch (_) {
        element?.focus();
      }
    }

    function openChatbot() {
      if (isOpen) {
        return;
      }

      isOpen = true;
      clearAnimationTimer("window");
      elements.window.classList.remove("chatbot-closing");
      elements.window.classList.add("chatbot-open");
      elements.window.setAttribute("aria-hidden", "false");
      elements.toggle.setAttribute("aria-expanded", "true");
      animateLauncherOut();
      clampWindowToViewport();

      windowAnimationTimer = window.setTimeout(() => {
        if (elements.window.classList.contains("chatbot-minimized")) {
          focusSafely(elements.minimize);
        } else {
          focusSafely(elements.input);
        }
      }, reducedMotionQuery.matches ? 0 : 220);
    }

    function closeChatbot() {
      if (!isOpen) {
        return;
      }

      isOpen = false;
      clearAnimationTimer("window");
      elements.window.classList.add("chatbot-closing");
      elements.window.classList.remove("chatbot-open");
      elements.window.setAttribute("aria-hidden", "true");
      elements.toggle.setAttribute("aria-expanded", "false");
      animateLauncherIn();
      ensureLauncherVisible({ persist: true });

      windowAnimationTimer = window.setTimeout(() => {
        elements.window.classList.remove("chatbot-closing");
        focusSafely(elements.toggle);
      }, reducedMotionQuery.matches ? 0 : 240);
    }

    function updateWindowControls() {
      const isMinimized = elements.window.classList.contains("chatbot-minimized");
      const isMaximized = elements.window.classList.contains("chatbot-maximized");
      const minimizeIcon = elements.minimize.querySelector("i");
      const maximizeIcon = elements.maximize.querySelector("i");

      elements.minimize.setAttribute(
        "aria-label",
        isMinimized ? `Restore ${BOT_NAME}` : `Minimize ${BOT_NAME}`
      );
      elements.minimize.title = isMinimized ? "Restore" : "Minimize";

      if (minimizeIcon) {
        minimizeIcon.className = isMinimized ? "fas fa-window-restore" : "fas fa-minus";
      }

      elements.maximize.setAttribute(
        "aria-label",
        isMaximized ? `Restore ${BOT_NAME} window size` : `Maximize ${BOT_NAME}`
      );
      elements.maximize.title = isMaximized ? "Restore size" : "Maximize";

      if (maximizeIcon) {
        maximizeIcon.className = isMaximized ? "fas fa-compress" : "fas fa-expand";
      }
    }

    function toggleMinimize() {
      const willMinimize = !elements.window.classList.contains("chatbot-minimized");

      elements.window.classList.toggle("chatbot-minimized", willMinimize);

      if (willMinimize) {
        elements.window.classList.remove("chatbot-maximized");
      }

      saveLayout({ minimized: willMinimize, maximized: false });
      updateWindowControls();

      if (!willMinimize) {
        focusSafely(elements.input);
      }
    }

    function toggleMaximize() {
      const willMaximize = !elements.window.classList.contains("chatbot-maximized");

      elements.window.classList.toggle("chatbot-maximized", willMaximize);
      elements.window.classList.remove("chatbot-minimized");
      saveLayout({ maximized: willMaximize, minimized: false });
      updateWindowControls();
      focusSafely(elements.input);
    }

    async function confirmAction(message, options) {
      if (window.AppDialog?.confirm) {
        return Boolean(await window.AppDialog.confirm(message, options));
      }

      return window.confirm(message);
    }

    async function clearHistory() {
      if (isSending) {
        setStatus("Please wait for the current reply before clearing history.", 2200);
        return;
      }

      const confirmed = await confirmAction(
        "Clear Echo’s saved chat history on this browser?",
        {
          title: "Clear chat history",
          confirmText: "Clear history",
          cancelText: "Keep history",
          danger: true
        }
      );

      if (!confirmed) {
        return;
      }

      history = [];
      saveHistory();
      renderHistory();
      setStatus("Chat history cleared.", 1800);
    }

    async function resetLayout() {
      const confirmed = await confirmAction(
        "Reset Echo’s button position and window size? Chat history will not be deleted.",
        {
          title: "Reset Echo layout",
          confirmText: "Reset layout",
          cancelText: "Cancel"
        }
      );

      if (!confirmed) {
        return;
      }

      safeRemove(LAYOUT_KEY);
      safeRemove(LEGACY_LAYOUT_KEY);
      elements.window.classList.remove("chatbot-maximized", "chatbot-minimized");
      elements.window.style.removeProperty("width");
      elements.window.style.removeProperty("height");
      resetLauncherToDefault({ animate: true, persist: false });
      updateWindowControls();
      clampWindowToViewport();
      setStatus("Echo’s position and size were reset.", 2200);
    }

    function createRequestController() {
      activeRequestController?.abort();
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort("timeout"), REQUEST_TIMEOUT_MS);

      return {
        controller,
        clearTimeout: () => window.clearTimeout(timeoutId)
      };
    }

    async function sendMessage() {
      const message = elements.input.value.trim();

      if (!message || isSending) {
        return;
      }

      if (navigator.onLine === false) {
        setStatus("You appear to be offline.", 2200);
        return;
      }

      addPersistentMessage(message, "user");
      elements.input.value = "";
      autoGrowInput();
      setSending(true);
      setStatus(`${BOT_NAME} is thinking…`);

      const thinking = renderMessage(
        {
          role: "assistant",
          text: `${BOT_NAME} is thinking…`,
          timestamp: Date.now()
        },
        { temporary: true }
      );
      thinking.classList.add("chatbot-thinking");

      const request = createRequestController();
      activeRequestController = request.controller;

      try {
        const response = await fetch(`${readApiBaseUrl()}/chatbot`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          credentials: "include",
          signal: request.controller.signal,
          body: JSON.stringify({
            message,
            classroomId: getClassroomId()
          })
        });

        const data = await readResponseBody(response);
        thinking.remove();

        let reply;

        if (response.ok) {
          reply = data.reply || data.message || "Sorry, I could not generate a response.";
        } else if (response.status === 401 || response.status === 403) {
          reply = "Your session may have expired. Please sign in again and retry.";
        } else if (response.status === 429) {
          reply = "Echo is receiving too many requests right now. Please wait a moment and try again.";
        } else {
          reply = data.reply || data.message || data.error || "Sorry, I could not access that information.";
        }

        addPersistentMessage(String(reply).slice(0, MESSAGE_CHARACTER_LIMIT), "assistant");
      } catch (error) {
        thinking.remove();

        if (error?.name === "AbortError") {
          addPersistentMessage(
            "That request took too long and was stopped. Please try again.",
            "assistant"
          );
        } else {
          console.error("Echo chatbot error:", error);
          addPersistentMessage(
            navigator.onLine === false
              ? "You appear to be offline. Reconnect and try again."
              : "I couldn’t connect right now. Please check your connection and try again.",
            "assistant"
          );
        }
      } finally {
        request.clearTimeout();
        activeRequestController = null;
        setSending(false);
        setStatus("");

        if (isOpen && !elements.window.classList.contains("chatbot-minimized")) {
          focusSafely(elements.input);
        }
      }
    }

    function settleLauncher() {
      elements.toggle.style.removeProperty("--echo-drag-tilt");
      elements.toggle.classList.remove("is-dragging");
      elements.toggle.setAttribute("aria-grabbed", "false");

      if (!reducedMotionQuery.matches) {
        elements.toggle.classList.remove("is-settling");
        void elements.toggle.offsetWidth;
        elements.toggle.classList.add("is-settling");
        window.setTimeout(() => elements.toggle.classList.remove("is-settling"), 420);
      }
    }

    function setupLauncherDrag() {
      let drag = null;

      function applyPendingDrag() {
        dragFrame = null;

        if (!drag || !pendingDragPosition) {
          return;
        }

        const position = positionLauncher(
          pendingDragPosition.x,
          pendingDragPosition.y,
          { persist: false }
        );

        const tilt = clamp(pendingDragPosition.dx * 0.18, -9, 9);
        elements.toggle.style.setProperty("--echo-drag-tilt", `${tilt}deg`);
        drag.lastPosition = position;
        pendingDragPosition = null;
      }

      function finishDrag(event) {
        if (!drag || drag.pointerId !== event.pointerId) {
          return;
        }

        const finishedDrag = drag;

        if (dragFrame) {
          window.cancelAnimationFrame(dragFrame);
          dragFrame = null;
        }

        if (pendingDragPosition) {
          applyPendingDrag();
        }

        // Clear the active drag before releasing capture. Some browsers fire
        // lostpointercapture synchronously, which would otherwise finish twice.
        drag = null;
        pendingDragPosition = null;

        try {
          elements.toggle.releasePointerCapture(event.pointerId);
        } catch (_) {
          // Pointer capture may already have been released by the browser.
        }

        if (finishedDrag.moved) {
          const rect = elements.toggle.getBoundingClientRect();
          const position = positionLauncher(rect.left, rect.top, { persist: true });
          saveLayout({ launcherX: position.x, launcherY: position.y });
          suppressNextToggleClick = true;
          window.setTimeout(() => {
            suppressNextToggleClick = false;
          }, 0);
        }

        settleLauncher();
      }

      addManagedEvent(elements.toggle, "pointerdown", (event) => {
        if (event.button !== 0 || isOpen) {
          return;
        }

        const rect = elements.toggle.getBoundingClientRect();

        drag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: rect.left,
          originY: rect.top,
          lastClientX: event.clientX,
          lastPosition: { x: rect.left, y: rect.top },
          moved: false
        };

        try {
          elements.toggle.setPointerCapture(event.pointerId);
        } catch (_) {
          // Some browsers may not support pointer capture in every state.
        }

        elements.toggle.classList.remove("is-settling");
        elements.toggle.classList.add("is-dragging");
        elements.toggle.setAttribute("aria-grabbed", "true");
      });

      addManagedEvent(elements.toggle, "pointermove", (event) => {
        if (!drag || drag.pointerId !== event.pointerId) {
          return;
        }

        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;

        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          drag.moved = true;
        }

        if (!drag.moved) {
          return;
        }

        event.preventDefault();

        pendingDragPosition = {
          x: drag.originX + dx,
          y: drag.originY + dy,
          dx: event.clientX - drag.lastClientX
        };
        drag.lastClientX = event.clientX;

        if (!dragFrame) {
          dragFrame = window.requestAnimationFrame(applyPendingDrag);
        }
      });

      addManagedEvent(elements.toggle, "pointerup", finishDrag);
      addManagedEvent(elements.toggle, "pointercancel", finishDrag);
      addManagedEvent(elements.toggle, "lostpointercapture", (event) => {
        if (drag && drag.pointerId === event.pointerId) {
          finishDrag(event);
        }
      });

      addManagedEvent(elements.toggle, "keydown", (event) => {
        if (!event.altKey || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
          return;
        }

        event.preventDefault();
        const rect = elements.toggle.getBoundingClientRect();
        const step = event.shiftKey ? 32 : 12;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        positionLauncher(rect.left + dx, rect.top + dy, { persist: true });
        settleLauncher();
        setStatus("Echo button moved.", 900);
      });
    }

    async function resolveHistoryScope() {
      if (
        !window.ApiClient?.request ||
        !/\/(dashboard|studentclass|profclass|syntax)/i.test(window.location.pathname)
      ) {
        return;
      }

      try {
        const profile = await window.ApiClient.request(
          "/users/profile",
          {
            method: "GET",
            headers: { Accept: "application/json" }
          },
          {
            redirectOnUnauthorized: false,
            retryOnRefresh: false
          }
        );

        const identifier =
          profile?.userId ||
          profile?.id ||
          profile?.email ||
          profile?.data?.userId ||
          profile?.data?.id ||
          profile?.data?.email;

        if (!identifier) {
          return;
        }

        const userKey = `ct_echo_history_${escapeKeyPart(identifier)}_v${HISTORY_VERSION}`;

        if (userKey === historyKey) {
          return;
        }

        historyKey = userKey;
        renderHistory();
      } catch (_) {
        // Browser-scoped guest history remains available as a fallback.
      }
    }

    function handleViewportChange() {
      window.requestAnimationFrame(() => {
        ensureLauncherVisible({ persist: true });
        clampWindowToViewport();
      });
    }

    addManagedEvent(elements.toggle, "click", () => {
      if (suppressNextToggleClick) {
        return;
      }

      openChatbot();
    });

    addManagedEvent(elements.close, "click", closeChatbot);
    addManagedEvent(elements.clear, "click", () => void clearHistory());
    addManagedEvent(elements.reset, "click", () => void resetLayout());
    addManagedEvent(elements.minimize, "click", toggleMinimize);
    addManagedEvent(elements.maximize, "click", toggleMaximize);

    addManagedEvent(elements.form, "submit", (event) => {
      event.preventDefault();
      void sendMessage();
    });

    addManagedEvent(elements.input, "input", autoGrowInput);

    addManagedEvent(elements.input, "keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendMessage();
      }
    });

    addManagedEvent(document, "keydown", (event) => {
      if (event.key === "Escape" && isOpen) {
        closeChatbot();
        return;
      }

      if (event.altKey && event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        resetLauncherToDefault({ animate: true, persist: true });
        ensureLauncherVisible({ persist: true });
        openChatbot();
      }
    });

    addManagedEvent(window, "resize", handleViewportChange, { passive: true });
    addManagedEvent(window, "orientationchange", handleViewportChange, { passive: true });
    addManagedEvent(window, "online", () => setStatus("You’re back online.", 1400));
    addManagedEvent(window, "offline", () => setStatus("You’re offline."));

    if (window.visualViewport) {
      addManagedEvent(window.visualViewport, "resize", handleViewportChange, { passive: true });
      addManagedEvent(window.visualViewport, "scroll", handleViewportChange, { passive: true });
    }

    addManagedEvent(window, "pagehide", () => {
      activeRequestController?.abort();
      cleanupCallbacks.splice(0).forEach((cleanup) => cleanup());
      window[INSTANCE_KEY] = null;
    }, { once: true });

    setupLauncherDrag();
    migrateLegacyLayout();
    applySavedLayout();
    renderHistory();
    autoGrowInput();
    void resolveHistoryScope();

    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        if (
          !isOpen ||
          isCompactViewport() ||
          elements.window.classList.contains("chatbot-maximized") ||
          elements.window.classList.contains("chatbot-minimized")
        ) {
          return;
        }

        window.clearTimeout(resizeSaveTimer);
        resizeSaveTimer = window.setTimeout(() => {
          saveLayout({
            width: elements.window.offsetWidth,
            height: elements.window.offsetHeight
          });
        }, 180);
      });

      resizeObserver.observe(elements.window);
      cleanupCallbacks.push(() => resizeObserver.disconnect());
    }

    const publicApi = Object.freeze({
      open: openChatbot,
      close: closeChatbot,
      resetLayout,
      ensureVisible: () => {
        ensureLauncherVisible({ persist: true });
        clampWindowToViewport();
      }
    });

    window[INSTANCE_KEY] = publicApi;
    window.CodeTrackerEcho = publicApi;
  });
})();
