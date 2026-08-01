(() => {
  "use strict";

  const assignmentsList = document.getElementById("assignmentsList");
  if (!assignmentsList) return;

  let renderQueued = false;

  function safeState() {
    try {
      return typeof state !== "undefined" ? state : null;
    } catch (_) {
      return null;
    }
  }

  function activityIdOf(activity) {
    return String(activity?.activityId || activity?.id || "").trim();
  }

  function activityTitle(activity) {
    return String(activity?.title || "Untitled activity").trim();
  }

  function submissionStatus(entry) {
    const explicit = String(entry?.submissionStatus || entry?.status || "").trim().toUpperCase();
    if (["SUBMITTED", "PENDING", "GRADED"].includes(explicit)) return explicit;
    if (entry?.score != null) return "GRADED";
    return entry?.repositoryUrl ? "PENDING" : "NONE";
  }

  function getQueue() {
    const current = safeState();
    if (!current) return [];
    return (current.activities || []).map((activity) => {
      const activityId = activityIdOf(activity);
      const entries = Object.values(current.submittedByActivity?.[activityId] || {});
      const awaitingGrade = entries.filter((entry) => submissionStatus(entry) === "SUBMITTED");
      return { activityId, title: activityTitle(activity), count: awaitingGrade.length };
    }).filter((item) => item.count > 0).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  }

  function ensurePanel() {
    let panel = document.getElementById("ctNeedsGradingPanel");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = "ctNeedsGradingPanel";
    panel.className = "ct-needs-grading";
    panel.setAttribute("aria-labelledby", "ctNeedsGradingTitle");
    assignmentsList.before(panel);
    return panel;
  }

  function openAwaitingGrades(activityId) {
    try {
      if (typeof openSubmissionsModal !== "function") return;
      void openSubmissionsModal(activityId);
      window.setTimeout(() => {
        const filter = document.getElementById("submissionFilter");
        if (!filter) return;
        filter.value = "SUBMITTED";
        filter.dispatchEvent(new Event("change", { bubbles: true }));
      }, 20);
    } catch (_) {
      // Keep the base professor page functional if its API changes.
    }
  }

  function renderPanel() {
    const panel = ensurePanel();
    const queue = getQueue();
    const total = queue.reduce((sum, item) => sum + item.count, 0);

    if (!queue.length) {
      panel.className = "ct-needs-grading is-clear";
      panel.innerHTML = `
        <div class="ct-needs-grading__summary">
          <span class="ct-needs-grading__icon"><i class="fas fa-check" aria-hidden="true"></i></span>
          <div><h3 id="ctNeedsGradingTitle">All caught up</h3><p>No submitted work is waiting for a grade.</p></div>
        </div>
      `;
      return;
    }

    panel.className = "ct-needs-grading";
    panel.innerHTML = `
      <div class="ct-needs-grading__header">
        <div class="ct-needs-grading__summary">
          <span class="ct-needs-grading__icon"><i class="fas fa-clipboard-check" aria-hidden="true"></i></span>
          <div><h3 id="ctNeedsGradingTitle">Needs grading</h3><p><strong>${total}</strong> submission${total === 1 ? "" : "s"} can be opened from here.</p></div>
        </div>
        <span class="ct-needs-grading__count" aria-label="${total} submissions awaiting a grade">${total}</span>
      </div>
      <div class="ct-needs-grading__list"></div>
    `;

    const list = panel.querySelector(".ct-needs-grading__list");
    queue.slice(0, 5).forEach((item) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "ct-needs-grading__row";
      row.innerHTML = `
        <span><strong></strong><small>${item.count} awaiting grade</small></span>
        <span class="ct-needs-grading__action">Grade now <i class="fas fa-arrow-right" aria-hidden="true"></i></span>
      `;
      row.querySelector("strong").textContent = item.title;
      row.addEventListener("click", () => openAwaitingGrades(item.activityId));
      list.appendChild(row);
    });
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    window.requestAnimationFrame(() => {
      renderQueued = false;
      renderPanel();
    });
  }

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
  });
  document.querySelectorAll(".close-btn").forEach((button) => {
    if (!button.getAttribute("aria-label")) button.setAttribute("aria-label", "Close dialog");
  });

  const observer = new MutationObserver(queueRender);
  observer.observe(assignmentsList, { childList: true, subtree: true });
  document.getElementById("saveGradeBtn")?.addEventListener("click", () => window.setTimeout(queueRender, 800));

  queueRender();
  window.setTimeout(queueRender, 500);
  window.setTimeout(queueRender, 1400);
})();
