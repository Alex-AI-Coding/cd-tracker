// GitHub OAuth Configuration
const DEFAULT_API_BASE_URL = "https://codetracker-production-979d.up.railway.app/api";

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

  return normalizeBaseUrl(fromClient || fromWindow || fromMeta || DEFAULT_API_BASE_URL);
}

const BACKEND_URL = `${readApiBaseUrl()}/oauth`;

function clearOAuthQueryParamsFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("oauth");
  url.searchParams.delete("success");
  url.searchParams.delete("registered");
  url.searchParams.delete("error");
  window.history.replaceState({}, document.title, url.toString());
}

function parseBooleanParam(value) {
  if (typeof value !== "string") return null;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return null;
}

async function redirectAuthenticatedSession() {
  if (!window.ApiClient?.checkSessionState) return false;

  const sessionState = await window.ApiClient.checkSessionState();
  if (!sessionState.authenticated) return false;

  window.location.replace(sessionState.fullyInitialized ? "/dashboard/" : "/onboarding/");
  return true;
}

async function handleOAuthCallbackRedirect() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("oauth") !== "github") return false;

  const success = parseBooleanParam(params.get("success"));
  const alreadyRegistered = parseBooleanParam(params.get("registered"));
  const error = params.get("error");

  if (success === true) {
    clearOAuthQueryParamsFromUrl();

    if (alreadyRegistered === true) {
      window.location.replace("/dashboard/");
      return true;
    }

    if (alreadyRegistered === false) {
      window.location.replace("/onboarding/");
      return true;
    }

    await redirectAuthenticatedSession();
    return true;
  }

  if (success === false) {
    const message = (typeof error === "string" && error.trim())
      ? error.trim()
      : "GitHub sign in failed. Please try again.";
    clearOAuthQueryParamsFromUrl();
    console.warn("GitHub OAuth sign-in failed:", message);
    return true;
  }

  return false;
}

function getDeviceIdForAutoRedirect() {
  if (window.ApiClient?._getCookie) {
    const cookieDeviceId = window.ApiClient._getCookie("device_id");
    if (cookieDeviceId && cookieDeviceId.trim()) {
      return cookieDeviceId.trim();
    }
  }

  const storageDeviceId = localStorage.getItem("device_id") || sessionStorage.getItem("device_id");
  if (storageDeviceId && storageDeviceId.trim()) {
    return storageDeviceId.trim();
  }

  return null;
}

// Check if user is already authenticated on page load.
document.addEventListener("DOMContentLoaded", async () => {
  if (await handleOAuthCallbackRedirect()) {
    return;
  }

  if (!window.ApiClient) return;

  const deviceId = getDeviceIdForAutoRedirect();
  if (!deviceId) return;

  try {
    const refreshed = await window.ApiClient.refreshToken(deviceId);
    if (refreshed) {
      await redirectAuthenticatedSession();
      return;
    }

    await redirectAuthenticatedSession();
  } catch (error) {
    console.warn("Auto-redirect check failed:", error);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const githubBtn = document.getElementById("githubLogin");
  if (githubBtn) {
    githubBtn.addEventListener("click", () => {
      console.log("GitHub login clicked");

      githubBtn.disabled = true;
      window.location.assign(`${BACKEND_URL}/github/authorize`);
    });
  }

  const note = document.getElementById("platformNote");
  const noteToggle = document.getElementById("platformNoteToggle");
  const noteBody = document.getElementById("platformNoteBody");

  if (!note || !noteToggle || !noteBody) return;

  noteBody.style.maxHeight = "0px";

  noteToggle.addEventListener("click", () => {
    const isExpanded = note.getAttribute("data-expanded") === "true";

    if (isExpanded) {
      noteBody.style.maxHeight = `${noteBody.scrollHeight}px`;
      requestAnimationFrame(() => {
        note.setAttribute("data-expanded", "false");
        noteToggle.setAttribute("aria-expanded", "false");
        noteBody.setAttribute("aria-hidden", "true");
        noteBody.style.maxHeight = "0px";
      });
      return;
    }

    note.setAttribute("data-expanded", "true");
    noteToggle.setAttribute("aria-expanded", "true");
    noteBody.setAttribute("aria-hidden", "false");
    noteBody.style.maxHeight = `${noteBody.scrollHeight}px`;
  });

  noteBody.addEventListener("transitionend", (event) => {
    if (event.propertyName !== "max-height") return;
    const isExpanded = note.getAttribute("data-expanded") === "true";
    if (isExpanded) {
      noteBody.style.maxHeight = "none";
    }
  });
});
