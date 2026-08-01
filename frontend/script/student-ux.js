(() => {
  "use strict";

  const container = document.getElementById("activitiesContainer");
  if (!container || !window.ApiClient?.request) return;

  const params = new URLSearchParams(window.location.search);
  const classroomId = String(
    params.get("id")
      || params.get("classroomId")
      || localStorage.getItem("currentClassroomId")
      || localStorage.getItem("classroomId")
      || ""
  ).trim();
  if (!classroomId) return;

  let activityMap = new Map();
  let isDecorating = false;
  let refreshTimer = null;

  function idOf(activity) {
    return String(activity?.activityId || activity?.id || "").trim();
  }

  function statusOf(activity) {
    return String(activity?.submissionStatus || "").trim().toUpperCase();
  }

  function escapeText(value) {
    return String(value ?? "");
  }

  function formatScore(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Number(number.toFixed(2)).toString() : escapeText(value || "—");
  }

  function shortFeedback(value) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return "No written feedback was added.";
    return text.length > 180 ? `${text.slice(0, 177).trimEnd()}…` : text;
  }

  function dueTime(activity) {
    const date = new Date(activity?.dueDate || "");
    return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
  }

  function sortRank(activity) {
    const status = statusOf(activity);
    if (status === "PENDING") return dueTime(activity) < Date.now() ? 0 : 1;
    if (status === "SUBMITTED") return 2;
    if (status === "GRADED") return 3;
    return 4;
  }

  function updateLabels() {
    const submitted = document.getElementById("submittedCount");
    const submittedLabel = submitted?.closest(".stat-body")?.querySelector(".stat-label");
    if (submittedLabel) submittedLabel.textContent = "Completed";

    const needsLabel = document.getElementById("pendingCount")?.closest(".stat-body")?.querySelector(".stat-label");
    if (needsLabel) needsLabel.textContent = "Needs Repository";

    const labelMap = {
      SUBMITTED: "Awaiting grade",
      NOT_SUBMITTED: "Awaiting submission",
      GRADED: "Graded",
      ALL: "All"
    };
    document.querySelectorAll("[data-tracked-filter]").forEach((button) => {
      const label = labelMap[button.dataset.trackedFilter];
      if (label) button.textContent = label;
    });
  }

  function buildGradeSummary(activity) {
    const summary = document.createElement("section");
    summary.className = "ct-grade-summary";
    summary.setAttribute("aria-label", "Grade summary");

    const max = activity.maxScore != null ? ` / ${formatScore(activity.maxScore)}` : "";
    summary.innerHTML = `
      <div class="ct-grade-summary__score">
        <span class="ct-grade-summary__eyebrow"><i class="fas fa-circle-check" aria-hidden="true"></i> Grade available</span>
        <strong>${formatScore(activity.score)}${max}</strong>
      </div>
      <div class="ct-grade-summary__feedback">
        <span>Teacher feedback</span>
        <p></p>
      </div>
    `;
    summary.querySelector("p").textContent = shortFeedback(activity.feedback);
    return summary;
  }

  function decorateCards() {
    if (isDecorating) return;
    isDecorating = true;
    try {
      updateLabels();
      const cards = [...container.querySelectorAll(".assignment[data-assignment-id]")];

      cards.forEach((card) => {
        const activity = activityMap.get(String(card.dataset.assignmentId || ""));
        if (!activity) return;

        const status = statusOf(activity);
        card.dataset.submissionStatus = status;
        card.dataset.dueTime = String(dueTime(activity));

        const statusPill = card.querySelector(".submission-status-pill");
        if (statusPill && status === "PENDING") {
          const icon = statusPill.querySelector("i")?.outerHTML || "";
          statusPill.innerHTML = `${icon} AWAITING SUBMISSION`;
        }

        const detailButton = card.querySelector(".assignment-detail-btn");
        if (detailButton) {
          detailButton.innerHTML = status === "GRADED"
            ? '<i class="fas fa-circle-info" aria-hidden="true"></i> Full details'
            : '<i class="fas fa-circle-info" aria-hidden="true"></i> Details';
        }

        card.querySelector(".ct-grade-summary")?.remove();
        if (status === "GRADED" && activity.score != null) {
          const meta = card.querySelector(".assignment-meta");
          meta?.before(buildGradeSummary(activity));
          card.classList.add("ct-assignment-graded");
          const title = card.querySelector(".assignment-title")?.textContent?.trim() || "activity";
          card.setAttribute("aria-label", `${title}. Graded ${formatScore(activity.score)}${activity.maxScore != null ? ` out of ${formatScore(activity.maxScore)}` : ""}.`);
        } else {
          card.classList.remove("ct-assignment-graded");
        }
      });

      const sorted = [...cards].sort((a, b) => {
        const activityA = activityMap.get(String(a.dataset.assignmentId || ""));
        const activityB = activityMap.get(String(b.dataset.assignmentId || ""));
        const rankDifference = sortRank(activityA) - sortRank(activityB);
        if (rankDifference) return rankDifference;
        return dueTime(activityA) - dueTime(activityB);
      });
      const current = cards.map((card) => card.dataset.assignmentId).join("|");
      const next = sorted.map((card) => card.dataset.assignmentId).join("|");
      if (current !== next) sorted.forEach((card) => container.appendChild(card));
    } finally {
      isDecorating = false;
    }
  }

  async function refreshActivities() {
    try {
      const response = await window.ApiClient.request(
        `/classrooms/${encodeURIComponent(classroomId)}/activities/student`,
        { method: "GET", headers: { Accept: "application/json" } },
        { redirectOnUnauthorized: false }
      );
      const list = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
      activityMap = new Map(list.map((activity) => [idOf(activity), activity]).filter(([id]) => id));
      decorateCards();
    } catch (_) {
      // The original page continues to handle API errors.
    }
  }

  function scheduleRefresh() {
    if (isDecorating) return;
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      if (activityMap.size) decorateCards();
      else void refreshActivities();
    }, 80);
  }

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(container, { childList: true, subtree: true });
  updateLabels();
  void refreshActivities();

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
  });
})();
