(() => {
  "use strict";

  const STORAGE_KEY = "codetracker-theme";
  const root = document.documentElement;
  const systemThemeQuery = window.matchMedia("(prefers-color-scheme: light)");

  function readSavedTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === "light" || saved === "dark" ? saved : null;
    } catch (_) {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) {
      // Theme still works for the current visit when storage is blocked.
    }
  }

  function preferredTheme() {
    return readSavedTheme() || (systemThemeQuery.matches ? "light" : "dark");
  }

  function createToggle() {
    const existing = document.getElementById("themeToggle");
    if (existing) return existing;

    const button = document.createElement("button");
    button.id = "themeToggle";
    button.className = "theme-toggle";
    button.type = "button";
    button.innerHTML = [
      '<span class="theme-toggle__icon" id="themeToggleIcon" aria-hidden="true"></span>',
      '<span id="themeToggleText"></span>'
    ].join("");

    document.body.appendChild(button);
    return button;
  }

  function updateToggle(theme) {
    const toggle = document.getElementById("themeToggle");
    if (!toggle) return;

    const icon = document.getElementById("themeToggleIcon");
    const text = document.getElementById("themeToggleText");
    const nextTheme = theme === "dark" ? "light" : "dark";
    const nextLabel = nextTheme === "light" ? "Light mode" : "Dark mode";

    toggle.setAttribute("aria-label", `Switch to ${nextLabel.toLowerCase()}`);
    toggle.setAttribute("title", `Switch to ${nextLabel.toLowerCase()}`);
    toggle.setAttribute("aria-pressed", String(theme === "light"));

    if (text) text.textContent = nextLabel;

    if (icon) {
      const usingFontAwesome = icon.tagName === "I" || icon.classList.contains("fa-solid");
      if (usingFontAwesome) {
        icon.classList.add("fa-solid");
        icon.classList.toggle("fa-sun", nextTheme === "light");
        icon.classList.toggle("fa-moon", nextTheme === "dark");
        icon.textContent = "";
      } else {
        icon.textContent = nextTheme === "light" ? "☀" : "☾";
      }
    }
  }

  function applyTheme(theme, persist = false) {
    const safeTheme = theme === "light" ? "light" : "dark";
    root.dataset.theme = safeTheme;
    root.style.colorScheme = safeTheme;
    updateToggle(safeTheme);

    if (persist) saveTheme(safeTheme);
  }

  // The small inline script inserted in <head> normally sets this first.
  if (root.dataset.theme !== "light" && root.dataset.theme !== "dark") {
    applyTheme(preferredTheme());
  }

  document.addEventListener("DOMContentLoaded", () => {
    const toggle = createToggle();
    applyTheme(root.dataset.theme || preferredTheme());

    toggle.addEventListener("click", () => {
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next, true);
    });
  });

  systemThemeQuery.addEventListener?.("change", (event) => {
    if (readSavedTheme()) return;
    applyTheme(event.matches ? "light" : "dark");
  });
})();
