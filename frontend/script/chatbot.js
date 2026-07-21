(function initializeCodeTrackerChatbot() {
  const DEFAULT_API_BASE_URL = "https://codetracker-production-ab72.up.railway.app/api";

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

    return normalizeBaseUrl(
      fromClient || fromWindow || fromMeta || fromStorage || DEFAULT_API_BASE_URL
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Add the chatbot UI automatically on pages that load this script.
    if (!document.getElementById("chatbot-container")) {
      document.body.insertAdjacentHTML(
        "beforeend",
        `
          <div id="chatbot-container">
            <button id="chatbot-toggle" type="button" aria-label="Open CodeTracker Assistant">
              <i class="fas fa-robot" aria-hidden="true"></i>
            </button>

            <section id="chatbot-window" role="dialog" aria-label="CodeTracker Assistant">
              <div id="chatbot-header">
                <div>
                  <i class="fas fa-robot" aria-hidden="true"></i>
                  <span>CodeTracker Assistant</span>
                </div>
                <button id="chatbot-close" type="button" aria-label="Close CodeTracker Assistant">&times;</button>
              </div>

              <div id="chatbot-messages" aria-live="polite">
                <div class="bot-message">Hi! I'm the CodeTracker Assistant. How can I help you today?</div>
              </div>

              <div id="chatbot-input-area">
                <input
                  id="chatbot-input"
                  type="text"
                  placeholder="Ask me something..."
                  autocomplete="off"
                  aria-label="Message CodeTracker Assistant"
                >
                <button id="chatbot-send" type="button">Send</button>
              </div>
            </section>
          </div>
        `
      );
    }

    const chatbotToggle = document.getElementById("chatbot-toggle");
    const chatbotWindow = document.getElementById("chatbot-window");
    const chatbotClose = document.getElementById("chatbot-close");
    const chatbotInput = document.getElementById("chatbot-input");
    const chatbotSend = document.getElementById("chatbot-send");
    const chatbotMessages = document.getElementById("chatbot-messages");

    if (
      !chatbotToggle ||
      !chatbotWindow ||
      !chatbotClose ||
      !chatbotInput ||
      !chatbotSend ||
      !chatbotMessages
    ) {
      console.error("CodeTracker chatbot elements could not be found.");
      return;
    }

    function getClassroomId() {
      const path = window.location.pathname.toLowerCase();
      const isClassroomPage =
        path.includes("/profclass/") || path.includes("/studentclass/");

      if (!isClassroomPage) {
        return null;
      }

      const params = new URLSearchParams(window.location.search);
      return (
        params.get("classroomId") ||
        params.get("id") ||
        localStorage.getItem("classroomId") ||
        localStorage.getItem("currentClassroomId") ||
        null
      );
    }

    function openChatbot() {
      chatbotWindow.classList.add("chatbot-open");
      chatbotToggle.classList.add("chatbot-toggle-hidden");
      setTimeout(() => chatbotInput.focus(), 300);
    }

    function closeChatbot() {
      chatbotWindow.classList.remove("chatbot-open");
      chatbotToggle.classList.remove("chatbot-toggle-hidden");
    }

    function addMessage(text, type) {
      const message = document.createElement("div");
      message.classList.add(
        type === "user" ? "user-message" : "bot-message",
        "chat-message-animation"
      );

      // Safely render the assistant's **bold** formatting without injecting HTML.
      const parts = String(text || "").split(/(\*\*.*?\*\*)/g);
      parts.forEach((part) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          const strong = document.createElement("strong");
          strong.textContent = part.slice(2, -2);
          message.appendChild(strong);
        } else {
          message.appendChild(document.createTextNode(part));
        }
      });

      chatbotMessages.appendChild(message);
      chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
      return message;
    }

    async function readResponseBody(response) {
      const text = await response.text();
      if (!text) return {};

      try {
        return JSON.parse(text);
      } catch (_) {
        return { reply: text };
      }
    }

    async function sendMessage() {
      const message = chatbotInput.value.trim();
      if (!message) return;

      const classroomId = getClassroomId();
      addMessage(message, "user");
      chatbotInput.value = "";
      chatbotSend.disabled = true;
      chatbotInput.disabled = true;

      const loadingMessage = addMessage(
        "CodeTracker Assistant is thinking...",
        "bot"
      );

      try {
        const response = await fetch(`${readApiBaseUrl()}/chatbot`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            message,
            classroomId
          })
        });

        const data = await readResponseBody(response);
        loadingMessage.remove();

        if (!response.ok) {
          addMessage(
            data.reply ||
              data.message ||
              data.error ||
              "Sorry, you do not have permission to access that information.",
            "bot"
          );
          return;
        }

        addMessage(
          data.reply || "Sorry, I could not generate a response.",
          "bot"
        );
      } catch (error) {
        loadingMessage.remove();
        console.error("Chatbot error:", error);
        addMessage(
          "Sorry, I couldn't connect to the CodeTracker Assistant. Please try again.",
          "bot"
        );
      } finally {
        chatbotSend.disabled = false;
        chatbotInput.disabled = false;
        chatbotInput.focus();
      }
    }

    chatbotToggle.addEventListener("click", openChatbot);
    chatbotClose.addEventListener("click", closeChatbot);
    chatbotSend.addEventListener("click", sendMessage);

    chatbotInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeChatbot();
      }
    });
  });
})();
