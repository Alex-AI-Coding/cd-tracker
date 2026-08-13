(function () {
  const apiClient = window.ApiClient;

  const submissionModal       = document.getElementById('submissionModal');
  const modalAssignmentDetail = document.getElementById('modalAssignmentDetail');
  const detailsModal          = document.getElementById('activityDetailsModal');
  const detailsContent        = document.getElementById('activityDetailsContent');
  const submissionModeSelect  = document.getElementById('submissionMode');
  const assignmentsList       = document.getElementById('assignmentsList');
  const assignmentCount       = document.getElementById('assignmentCount');
  const pendingCount          = document.getElementById('pendingCount');
  const submitAssignmentBtn   = document.getElementById('submitAssignmentBtn');
  const studentAnnouncementsList = document.getElementById('studentAnnouncementsList');

  const params      = new URLSearchParams(window.location.search);
  const classroomId = params.get('classroomId') || params.get('id') || '';

  const state = {
    allActivities: [],
    unsubmitted: [],
    currentActivity: null,
    filters: { trackedSubmission: 'ALL' },
    currentActivityTab: 'needs-submission',
    isLoading: true,
    announcements: [],
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    return isNaN(d) ? '' : new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(d);
  }

  function formatDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    return isNaN(d) ? '' : d.toLocaleString();
  }

  function formatScoreValue(value) {
    if (value === null || value === undefined || String(value).trim() === '') return 'X';
    const number = Number(value);
    return Number.isFinite(number) ? String(Number(number.toFixed(2))) : String(value);
  }

  function renderPrimaryMetaField(icon, label, value, isLink = false, valueClass = '') {
    const text = String(value ?? '').trim() || 'X';
    const valueHtml = isLink && text !== 'X'
      ? `<a href="${escapeHtml(text)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`
      : escapeHtml(text);
    return `
      <div class="assignment-meta-field">
        <div class="assignment-meta-field-label"><i class="${icon}"></i> ${escapeHtml(label)}</div>
        <div class="assignment-meta-field-value ${valueClass}">${valueHtml}</div>
      </div>`;
  }

  function getDaysLeft(value) {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d)) return null;
    d.setHours(23, 59, 59, 999);
    return Math.ceil((d.getTime() - Date.now()) / 86400000);
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function getActivityId(a) { return a?.activityId || ''; }
  function getActivityTitle(a) { return a?.title || 'Untitled activity'; }
  function getActivityDescription(a) { return a?.description || ''; }
  function getActivityLifecycleStatus(a) {
    return String(a?.activityStatus || a?.status || '').trim().toUpperCase();
  }

  function getStatusBadgeClass(a) {
    const s = getActivityLifecycleStatus(a);
    const d = getDaysLeft(a?.dueDate);
    if (s === 'ARCHIVED' || s === 'CLOSED') return 'expired';
    if (typeof d === 'number' && d <= 7) return 'due-soon';
    return 'due-later';
  }

  function getStatusLabel(a) {
    const s  = getActivityLifecycleStatus(a);
    const d  = getDaysLeft(a?.dueDate);
    const fd = formatDate(a?.dueDate);
    if (s) return s;
    if (d === null) return 'Active';
    if (d < 0) return 'Overdue';
    return fd ? `Due ${fd}` : 'Active';
  }

  function getTrackedSubmissionStatus(a) {
    const s = String(a?.submissionStatus ?? '').trim().toUpperCase();
    return (s === 'SUBMITTED' || s === 'PENDING' || s === 'GRADED') ? s : '';
  }

  function getSubmissionStatusMeta(status) {
    if (status === 'SUBMITTED') return { label: 'SUBMITTED', cls: 'submitted', icon: 'fas fa-paper-plane' };
    if (status === 'GRADED') return { label: 'GRADED', cls: 'graded', icon: 'fas fa-square-check' };
    if (status === 'PENDING') return { label: 'PENDING', cls: 'pending', icon: 'fas fa-hourglass-half' };
    return null;
  }

  function renderEmptyState(msg, desc, icon = 'fas fa-inbox') {
    return `<div class="empty-state"><i class="${icon}"></i><h4>${escapeHtml(msg)}</h4><p>${escapeHtml(desc)}</p></div>`;
  }

  function renderLoadingSkeleton() {
    const c = document.getElementById('activitiesContainer');
    if (!c) return;

    if (state.currentActivityTab === 'tracked') {
      c.innerHTML = `
        <div class="studentclass-loading" aria-live="polite" aria-label="Loading tracked activities">
          <span class="studentclass-loading-spinner" aria-hidden="true"></span>
          <span>Loading tracked activities…</span>
        </div>`;
      return;
    }

    c.innerHTML = Array(3).fill(`
      <div class="assignment">
        <div style="height:16px;width:55%;margin-bottom:10px;" class="skeleton"></div>
        <div style="height:12px;width:35%;margin-bottom:14px;" class="skeleton"></div>
        <div style="height:12px;width:80%;" class="skeleton"></div>
      </div>`).join('');
  }

  function renderCard(activity, needsRepo) {
    const id          = getActivityId(activity);
    const title       = escapeHtml(getActivityTitle(activity));
    const desc        = getActivityDescription(activity);
    const badgeClass  = getStatusBadgeClass(activity);
    const statusLabel = escapeHtml(getStatusLabel(activity));
    const statusIcon  = badgeClass === 'expired' ? 'fas fa-hourglass-end' : 'fas fa-clock';
    const daysLeft    = getDaysLeft(activity?.dueDate);
    const dueDate     = formatDate(activity?.dueDate);
    const daysStr     = daysLeft != null ? (daysLeft > 0 ? `${daysLeft}d left` : 'Overdue') : (dueDate || 'No due date');
    const urgentClass = daysLeft != null && daysLeft <= 7 ? 'urgent' : 'normal';
    const points      = formatScoreValue(activity?.maxScore);
    const score       = formatScoreValue(activity?.score);

    const repoBadge = needsRepo
      ? '<span class="assignment-repo-badge"><i class="fas fa-code-branch"></i> Needs repository</span>'
      : '';

    const trackedSubmissionStatus = getTrackedSubmissionStatus(activity);
    const submissionMeta = getSubmissionStatusMeta(trackedSubmissionStatus);
    const lifecycleStatus = getActivityLifecycleStatus(activity);

    const submitRepoBtn = needsRepo
      ? `<button type="button" class="submit-repo-btn" data-submit-activity-id="${escapeHtml(id)}"><i class="fas fa-paper-plane"></i> Submit repo</button>`
      : '';

    const submittedPill = submissionMeta
      ? `<span class="submission-status-pill ${submissionMeta.cls}"><i class="${submissionMeta.icon}"></i> ${submissionMeta.label}</span>`
      : '';

    const submitActivityBtn = trackedSubmissionStatus === 'PENDING' && !needsRepo
      ? `<button type="button" class="submit-activity-btn" data-submit-pending-activity-id="${escapeHtml(id)}"><i class="fas fa-check"></i> Submit activity</button>`
      : '';
    const viewDetailsBtn = `<button type="button" class="assignment-detail-btn" data-view-activity-id="${escapeHtml(id)}"><i class="fas fa-circle-info"></i> More info</button>`;

    const hideActiveStatusPill = !needsRepo && statusLabel.trim().toUpperCase() === 'ACTIVE';
    const assignmentStatus = hideActiveStatusPill
      ? ''
      : `<div class="assignment-status ${badgeClass}"><i class="${statusIcon}"></i> ${statusLabel}</div>`;

    const leftMetaItems = `
      ${renderPrimaryMetaField('fas fa-calendar-alt', 'Assignment due', daysStr, false, `days-left ${urgentClass}`)}
      ${renderPrimaryMetaField('fas fa-calendar-day', 'Due date', dueDate)}
      ${renderPrimaryMetaField('fas fa-star', 'Points', points === 'X' ? 'X' : `${points} pts`, false, 'points')}
      ${renderPrimaryMetaField('fas fa-chart-line', 'Score', score === 'X' ? 'X' : `${score} pts`)}
      ${renderPrimaryMetaField('fas fa-clock', 'Submitted at', formatDateTime(activity?.submittedAt))}
      ${renderPrimaryMetaField('fab fa-github', 'Repository URL', activity?.repositoryUrl, true)}
    `;

    const rightMetaItems = `
      ${submittedPill}
      ${submitRepoBtn}
      ${submitActivityBtn}
      ${viewDetailsBtn}
    `;

    const subtitleItems = [];
    if (repoBadge) subtitleItems.push(repoBadge);
    if (needsRepo && lifecycleStatus) {
      subtitleItems.push(`<span class="assignment-lifecycle-pill">${escapeHtml(lifecycleStatus)}</span>`);
    }
    const subtitleHtml = subtitleItems.length
      ? `<div class="assignment-subtitle">${subtitleItems.join('')}</div>`
      : '';

    return `
      <div class="assignment ${needsRepo ? 'needs-submission' : ''}" data-assignment-id="${escapeHtml(id)}">
        <div class="assignment-header">
          <div class="assignment-title-wrap">
            <div class="assignment-title"><i class="fas fa-project-diagram"></i> ${title}</div>
            ${subtitleHtml}
          </div>
          ${assignmentStatus}
        </div>
        ${desc ? `<div class="assignment-desc">${escapeHtml(desc)}</div>` : ''}
        <div class="assignment-meta">
          <div class="assignment-meta-primary">${leftMetaItems}</div>
          <div class="assignment-meta-actions">${rightMetaItems}</div>
        </div>
      </div>`;
  }

  function renderDetailsField(icon, label, value, isLink = false) {
    const cleanValue = String(value ?? '').trim();
    if (!cleanValue) return '';
    const valueHtml = isLink
      ? `<a href="${escapeHtml(cleanValue)}" target="_blank" rel="noopener noreferrer">${escapeHtml(cleanValue)}</a>`
      : escapeHtml(cleanValue);
    return `
      <div class="activity-details-item">
        <div class="activity-details-label"><i class="${icon}"></i> ${escapeHtml(label)}</div>
        <div class="activity-details-value">${valueHtml}</div>
      </div>`;
  }

  function openDetailsModal(activityId) {
    const activity = state.allActivities.find(a => getActivityId(a) === activityId)
      || state.unsubmitted.find(a => getActivityId(a) === activityId);
    if (!activity || !detailsModal || !detailsContent) return;

    const submissionStatus = getTrackedSubmissionStatus(activity) || 'NOT SUBMITTED';
    detailsContent.innerHTML = `
      <div class="activity-details-grid">
        ${renderDetailsField('fas fa-id-card', 'Activity ID', activity.activityId)}
        ${renderDetailsField('fas fa-heading', 'Title', getActivityTitle(activity))}
        ${renderDetailsField('fas fa-file-lines', 'Description', getActivityDescription(activity) || 'No description provided')}
        ${renderDetailsField('fas fa-star', 'Max score', activity.maxScore != null ? `${activity.maxScore}` : 'Not set')}
        ${renderDetailsField('fas fa-calendar-alt', 'Due date', formatDate(activity.dueDate) || 'No due date')}
        ${renderDetailsField('fas fa-hourglass-half', 'Activity status', getActivityLifecycleStatus(activity) || 'N/A')}
        ${renderDetailsField('fas fa-flag-checkered', 'Submission status', submissionStatus)}
        ${renderDetailsField('fas fa-fingerprint', 'Student activity ID', activity.studentActivityId || 'N/A')}
        ${renderDetailsField('fas fa-code-branch', 'Repository name', activity.repositoryName || 'N/A')}
        ${renderDetailsField('fab fa-github', 'Repository URL', activity.repositoryUrl || '', true)}
        ${renderDetailsField('fas fa-sliders', 'Repository mode', activity.repositoryMode || 'N/A')}
        ${renderDetailsField('fas fa-clock', 'Submitted at', activity.submittedAt ? new Date(activity.submittedAt).toLocaleString() : 'Not submitted')}
        ${renderDetailsField('fas fa-chart-line', 'Score', activity.score != null ? `${activity.score}` : 'Not graded')}
        ${renderDetailsField('fas fa-comment-dots', 'Feedback', activity.feedback || 'No feedback yet')}
      </div>`;

    detailsModal.style.display = 'block';
  }

  function closeDetailsModal() {
    if (!detailsModal) return;
    detailsModal.style.opacity = '0';
    setTimeout(() => {
      detailsModal.style.display = 'none';
      detailsModal.style.opacity = '';
    }, 180);
  }

  async function submitPendingActivity(activityId, buttonEl) {
    if (!activityId) return;
    const activity = state.allActivities.find(a => getActivityId(a) === activityId);
    const activityTitle = getActivityTitle(activity);
    const approved = await window.AppDialog?.confirm(
      `Submit "${activityTitle}" now? You can still view its status in tracked activities.`,
      {
        title: 'Confirm Submission',
        confirmText: 'Submit Activity',
        cancelText: 'Cancel'
      }
    );
    if (!approved) return;

    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.classList.add('is-disabled');
    }

    try {
      await apiClient.request(
        `/classrooms/${encodeURIComponent(classroomId)}/activities/${encodeURIComponent(activityId)}/submit`,
        { method: 'POST' },
        { redirectOnUnauthorized: false }
      );
      await window.AppDialog?.alert(`${activityTitle} submitted successfully.`, { title: 'Activity Submitted' });
      await loadAll();
    } catch (err) {
      await window.AppDialog?.alert(err?.message || 'Failed to submit activity.', { title: 'Submission Failed' });
    }
  }

  function renderActivities() {
    const container = document.getElementById('activitiesContainer');
    if (!container) return;

    const tracked = state.allActivities.filter(a => getTrackedSubmissionStatus(a));

    if (assignmentCount) assignmentCount.textContent = state.allActivities.length;
    if (pendingCount)    pendingCount.textContent    = state.unsubmitted.length;

    const submittedCountEl = document.getElementById('submittedCount');
    if (submittedCountEl) {
      submittedCountEl.textContent = state.allActivities.filter(a => {
        const s = getTrackedSubmissionStatus(a);
        return s === 'SUBMITTED' || s === 'GRADED';
      }).length;
    }

    const needsBadge   = document.getElementById('tabNeedsCount');
    const trackedBadge = document.getElementById('tabTrackedCount');
    if (needsBadge)   needsBadge.textContent   = state.unsubmitted.length;
    if (trackedBadge) trackedBadge.textContent = tracked.length;

    const trackedFilterGroup = document.getElementById('trackedFilterGroup');
    if (trackedFilterGroup) trackedFilterGroup.style.display = state.currentActivityTab === 'tracked' ? 'flex' : 'none';

    if (state.isLoading) {
      renderLoadingSkeleton();
      return;
    }

    if (state.currentActivityTab === 'needs-submission') {
      container.innerHTML = state.unsubmitted.length === 0
        ? renderEmptyState('All caught up!', 'Every assignment already has a repository attached.', 'fas fa-check-double')
        : state.unsubmitted.map(a => renderCard(a, true)).join('');
    } else {
      const filter = state.filters.trackedSubmission;
      const filtered = tracked.filter(a => {
        const s = getTrackedSubmissionStatus(a);
        if (filter === 'SUBMITTED')     return s === 'SUBMITTED';
        if (filter === 'NOT_SUBMITTED') return s === 'PENDING';
        if (filter === 'GRADED')        return s === 'GRADED';
        return true;
      });
      container.innerHTML = filtered.length === 0
        ? renderEmptyState('No tracked activities yet', 'Activities will appear here once you submit them.', 'fas fa-tasks')
        : filtered.map(a => renderCard(a, false)).join('');
    }
  }

  async function loadAll() {
    state.isLoading = true;
    renderActivities();
    try {
      const profile = await apiClient.request('/users/profile', { method: 'GET' }, { redirectOnUnauthorized: false });
      setStudentProfile(profile);

      const activitiesRes = await apiClient.request(
        `/classrooms/${encodeURIComponent(classroomId)}/activities/student`,
        { method: 'GET' }, { redirectOnUnauthorized: false }
      );
      state.allActivities = Array.isArray(activitiesRes?.data) ? activitiesRes.data
        : Array.isArray(activitiesRes) ? activitiesRes : [];

      const unsubRes = await apiClient.request(
        `/classrooms/${encodeURIComponent(classroomId)}/activities/unsubmitted`,
        { method: 'GET', headers: { 'Cache-Control': 'no-cache' } },
        { redirectOnUnauthorized: false }
      );
      state.unsubmitted = Array.isArray(unsubRes?.data) ? unsubRes.data
        : Array.isArray(unsubRes) ? unsubRes : [];

      console.log('[unsubmitted]', state.unsubmitted);
      await loadAnnouncements();
    } catch (err) {
      console.error('[loadAll error]', err);
    } finally {
      state.isLoading = false;
      renderActivities();
      loadClassroomInfo();
    }
  }

  async function loadAnnouncements() {
    try {
      let res = null;
      if (apiClient?.classroom?.listAnnouncements) {
        res = await apiClient.classroom.listAnnouncements(classroomId);
      } else if (apiClient?.request) {
        res = await apiClient.request(
          `/classroom/${encodeURIComponent(classroomId)}/announcement`,
          { method: 'GET' },
          { redirectOnUnauthorized: false }
        );
      }
      state.announcements = normalizeAnnouncementCollection(res)
        .filter((announcement) => !announcement.classroomId || announcement.classroomId === classroomId);
      if (state.announcements.length) {
        cacheAnnouncements(classroomId, state.announcements);
      }
    } catch (_) {
      state.announcements = readCachedAnnouncements(classroomId);
    }

    if (!state.announcements.length) {
      state.announcements = readCachedAnnouncements(classroomId);
    }

    renderAnnouncements();
  }

  function setStudentProfile(data) {
    const first    = data?.firstName || '';
    const last     = data?.lastName  || '';
    const fullName = `${first} ${last}`.trim() || 'Student';
    const url      = data?.profileUrl || '';
    const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || 'ST';
    const nameEl   = document.getElementById('studentName');
    const avatarEl = document.getElementById('studentAvatar');
    if (nameEl)   nameEl.textContent = fullName;
    if (avatarEl) avatarEl.innerHTML = url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(fullName)}">` : initials;
  }

  function loadClassroomInfo() {
    const p = new URLSearchParams(window.location.search);
    const nameEl = document.getElementById('classroomInfoName');
    const codeEl = document.getElementById('classroomInfoCode');
    if (nameEl) nameEl.textContent = decodeURIComponent(p.get('name') || '—');
    if (codeEl) codeEl.textContent = decodeURIComponent(p.get('code') || '—');
  }

  function renderAnnouncements() {
    if (!studentAnnouncementsList) return;
    if (!state.announcements.length) {
      studentAnnouncementsList.innerHTML = `
        <div class="announcement-empty">
          <i class="fas fa-bullhorn"></i>
          <p>No announcements yet.</p>
        </div>`;
      return;
    }

    studentAnnouncementsList.innerHTML = state.announcements.slice(0, 3).map((announcement) => `
      <article class="announcement-card">
        <div class="announcement-card-head">
          <strong>Announcement</strong>
          <span>${escapeHtml(formatAnnouncementTime(announcement.createdAt))}</span>
        </div>
        <div class="announcement-card-message">${escapeHtml(announcement.message || '')}</div>
        ${announcement.attachments.length ? `
          <div class="announcement-card-attachments">
            ${announcement.attachments.map((attachment) => renderAnnouncementAttachment(attachment)).join('')}
          </div>` : ''}
      </article>
    `).join('');
  }

  function formatAnnouncementTime(value) {
    if (!value) return 'Just now';
    const d = new Date(value);
    return isNaN(d) ? 'Just now' : d.toLocaleString();
  }

  function normalizeAnnouncementCollection(result) {
    if (Array.isArray(result)) return result.map(normalizeAnnouncement).filter(Boolean);
    if (Array.isArray(result?.data)) return result.data.map(normalizeAnnouncement).filter(Boolean);
    if (Array.isArray(result?.content)) return result.content.map(normalizeAnnouncement).filter(Boolean);
    if (Array.isArray(result?.items)) return result.items.map(normalizeAnnouncement).filter(Boolean);
    if (result && typeof result === 'object' && result.announcementId) return [normalizeAnnouncement(result)].filter(Boolean);
    return [];
  }

  function normalizeAnnouncement(item) {
    if (!item || typeof item !== 'object') return null;
    return {
      announcementId: String(item.announcementId || ''),
      classroomId: String(item.classroomId || ''),
      message: String(item.message || ''),
      createdAt: String(item.createdAt || ''),
      attachments: Array.isArray(item.attachments)
        ? item.attachments.map(normalizeAttachment).filter(Boolean)
        : []
    };
  }

  function normalizeAttachment(item) {
    if (!item || typeof item !== 'object') return null;
    return {
      attachmentId: String(item.attachmentId || ''),
      url: String(item.url || ''),
      type: String(item.type || ''),
      resourceType: String(item.resourceType || ''),
    };
  }

  function getAttachmentLabel(attachment) {
    const resourceType = String(attachment?.resourceType || '').trim();
    const type = String(attachment?.type || '').trim();
    const url = String(attachment?.url || '').trim();
    if (resourceType) return resourceType;
    if (type) return type;
    if (url) {
      try {
        const pathname = new URL(url, window.location.origin).pathname;
        const last = pathname.split('/').filter(Boolean).pop();
        if (last) return decodeURIComponent(last);
      } catch (_) {}
    }
    return 'Attachment';
  }

  function getAttachmentKind(attachment) {
    const value = String(attachment?.type || attachment?.resourceType || '').trim().toLowerCase();
    if (value.includes('image')) return 'image';
    if (value.includes('video')) return 'video';
    const url = String(attachment?.url || '').trim().toLowerCase();
    if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/.test(url)) return 'image';
    if (/\.(mp4|webm|mov|avi|mkv)(\?.*)?$/.test(url)) return 'video';
    return 'file';
  }

  function getAttachmentKindLabel(kind) {
    if (kind === 'image') return 'image';
    if (kind === 'video') return 'video';
    return 'attachment';
  }

  function renderAnnouncementAttachment(attachment) {
    const url = String(attachment?.url || '').trim();
    if (!url) return '';
    const label = getAttachmentLabel(attachment);
    const kind = getAttachmentKind(attachment);

    if (kind === 'image') {
      return `
        <a class="announcement-attachment-media" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" download>
          <img class="announcement-attachment-preview" src="${escapeHtml(url)}" alt="${escapeHtml(label)}">
          <span class="announcement-attachment-body">
            <i class="fas fa-image"></i>
            <span>${escapeHtml(getAttachmentKindLabel(kind))}</span>
            <i class="fas fa-download"></i>
          </span>
        </a>`;
    }

    if (kind === 'video') {
      return `
        <div class="announcement-attachment-media">
          <video class="announcement-attachment-preview" controls playsinline preload="metadata" src="${escapeHtml(url)}"></video>
          <a class="announcement-attachment-body" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" download>
            <i class="fas fa-video"></i>
            <span>${escapeHtml(getAttachmentKindLabel(kind))}</span>
            <i class="fas fa-download"></i>
          </a>
        </div>`;
    }

    return `
      <a class="announcement-attachment-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" download>
        <span class="announcement-attachment-body">
          <i class="fas fa-download"></i>
          <span>${escapeHtml(label)}</span>
        </span>
      </a>`;
  }

  function cacheKeyForClassroom(id) { return `ct_announcements_${String(id || '')}`; }
  function readCachedAnnouncements(id) {
    try {
      const raw = localStorage.getItem(cacheKeyForClassroom(id));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(normalizeAnnouncement).filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  }
  function cacheAnnouncements(id, announcements) {
    try { localStorage.setItem(cacheKeyForClassroom(id), JSON.stringify(announcements || [])); } catch (_) {}
  }

  async function loadGithubRepos() {
    const sel = document.getElementById('repoSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Loading repositories... —</option>';
    sel.disabled = true;
    try {
      const res   = await apiClient.request('/github/repositories', { method: 'GET' });
      const repos = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      sel.innerHTML = repos.length === 0
        ? '<option value="">No repositories found</option>'
        : '<option value="">— Select a repository —</option>' + repos.map(r => {
            const name = r.fullName || r.full_name || r.name || '';
            const url  = r.htmlUrl  || r.html_url  || r.url  || '';
            return `<option value="${url}">${name}</option>`;
          }).join('');
    } catch {
      sel.innerHTML = '<option value="">Failed to load repositories</option>';
    } finally {
      sel.disabled = false;
    }
  }

  function setSubmitButtonState(mode) {
    if (!submitAssignmentBtn) return;
    submitAssignmentBtn.classList.remove('is-loading', 'is-success', 'is-error');
    if (mode === 'loading') {
      submitAssignmentBtn.disabled = true;
      submitAssignmentBtn.classList.add('is-loading');
      submitAssignmentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    } else if (mode === 'success') {
      submitAssignmentBtn.disabled = true;
      submitAssignmentBtn.classList.add('is-success');
      submitAssignmentBtn.innerHTML = '<i class="fas fa-check"></i> Submitted!';
    } else if (mode === 'error') {
      submitAssignmentBtn.disabled = false;
      submitAssignmentBtn.classList.add('is-error');
      submitAssignmentBtn.innerHTML = '<i class="fas fa-triangle-exclamation"></i> Try Again';
    } else {
      submitAssignmentBtn.disabled = false;
      submitAssignmentBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Assignment';
    }
  }

  async function submitAssignment() {
    if (submitAssignmentBtn?.disabled) return;
    const activity = state.currentActivity;
    if (!activity) { await window.AppDialog?.alert('Select an activity first.', { title: 'Missing Activity' }); return; }

    const mode = submissionModeSelect?.value === 'new' ? 'new' : 'existing';
    let repositoryUrl = '';

    if (mode === 'existing') {
      repositoryUrl = document.getElementById('repoSelect')?.value.trim() || '';
      if (!repositoryUrl) { await window.AppDialog?.alert('Please select a repository.', { title: 'No Repository Selected' }); return; }
      if (!repositoryUrl.includes('github.com')) { await window.AppDialog?.alert('Please select a valid GitHub repository.', { title: 'Invalid Repository' }); return; }
    } else {
      const name = document.getElementById('repositoryName')?.value.trim() || '';
      if (!name) { await window.AppDialog?.alert('Please enter a repository name.', { title: 'Missing Name' }); return; }
      repositoryUrl = name;
    }

    const approved = await window.AppDialog?.confirm(
      `Are you sure you want to submit "${getActivityTitle(activity)}"?`,
      {
        title: 'Confirm Assignment Submission',
        confirmText: 'Submit Assignment',
        cancelText: 'Review'
      }
    );
    if (!approved) return;

    setSubmitButtonState('loading');
    try {
      const body = mode === 'new' ? { repositoryName: repositoryUrl } : { repositoryUrl };
      await apiClient.request(
        `/classrooms/${encodeURIComponent(classroomId)}/activities/${encodeURIComponent(getActivityId(activity))}/submit/${mode}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        { redirectOnUnauthorized: false }
      );

      const unsubRes = await apiClient.request(
        `/classrooms/${encodeURIComponent(classroomId)}/activities/unsubmitted`,
        { method: 'GET', headers: { 'Cache-Control': 'no-cache' } },
        { redirectOnUnauthorized: false }
      );
      state.unsubmitted = Array.isArray(unsubRes?.data) ? unsubRes.data
        : Array.isArray(unsubRes) ? unsubRes : [];

      renderActivities();
      setSubmitButtonState('success');
      await sleep(700);
      closeSubmissionModal();
      clearSubmissionForm();
      await window.AppDialog?.alert('Assignment submitted successfully.', { title: 'Success' });
    } catch (err) {
      setSubmitButtonState('error');
      await window.AppDialog?.alert(err.message || 'Failed to submit assignment.', { title: 'Submission Failed' });
      await sleep(1200);
      setSubmitButtonState('idle');
    }
  }

  function openSubmissionModal(activityId) {
    const activity = state.unsubmitted.find(a => getActivityId(a) === activityId)
      || state.allActivities.find(a => getActivityId(a) === activityId);
    if (!activity) { window.AppDialog?.alert('Activity not found.', { title: 'Missing Activity' }); return; }
    state.currentActivity = activity;
    if (modalAssignmentDetail) {
      modalAssignmentDetail.innerHTML = `
        <div class="modal-assignment-title"><i class="fas fa-project-diagram"></i> ${escapeHtml(getActivityTitle(activity))}</div>
        <div class="modal-assignment-meta">
          <span><i class="fas fa-calendar-alt"></i> ${formatDate(activity?.dueDate) || 'No due date'}</span>
          <span><i class="fas fa-circle-info"></i> ${escapeHtml(getStatusLabel(activity))}</span>
        </div>
        <p class="modal-assignment-description">${escapeHtml(getActivityDescription(activity) || 'No description provided.')}</p>`;
    }
    if (submissionModeSelect) submissionModeSelect.value = '';
    applySubmissionMode('');
    if (submissionModal) {
      const mc = submissionModal.querySelector('.modal-content');
      if (mc) mc.scrollTop = 0;
      submissionModal.style.display = 'block';
      setTimeout(() => submissionModeSelect?.focus(), 100);
    }
  }

  function closeSubmissionModal() {
    if (!submissionModal) return;
    submissionModal.style.opacity = '0';
    setTimeout(() => { submissionModal.style.display = 'none'; submissionModal.style.opacity = ''; setSubmitButtonState('idle'); }, 200);
  }

  function clearSubmissionForm() {
    const r = document.getElementById('repositoryName');
    if (r) r.value = '';
    if (submissionModeSelect) submissionModeSelect.value = 'existing';
    applySubmissionMode('existing');
  }

  function applySubmissionMode(mode) {
    const isNew = mode === 'new', isExisting = mode === 'existing';
    const eg = document.getElementById('existingRepoGroup');
    const ng = document.getElementById('newRepoGroup');
    const ri = document.getElementById('repositoryName');
    const rs = document.getElementById('repoSelect');
    if (eg) eg.style.display = isExisting ? 'block' : 'none';
    if (ng) ng.style.display = isNew ? 'block' : 'none';
    if (rs) rs.required = isExisting;
    if (ri) { ri.required = isNew; if (!isNew) ri.value = ''; }
    if (isExisting) loadGithubRepos();
  }

  function attachEventHandlers() {
    setSubmitButtonState('idle');

    document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => {
      state.currentActivityTab = btn.dataset.tab;
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === btn.dataset.tab));
      renderActivities();
    }));

    document.getElementById('closeModal')?.addEventListener('click', closeSubmissionModal);
    document.getElementById('cancelSubmitBtn')?.addEventListener('click', closeSubmissionModal);
    document.getElementById('closeActivityDetailsModal')?.addEventListener('click', closeDetailsModal);
    window.addEventListener('click', e => {
      if (e.target === submissionModal) closeSubmissionModal();
      if (e.target === detailsModal) closeDetailsModal();
    });
    window.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      closeSubmissionModal();
      closeDetailsModal();
    });

    document.getElementById('backDashboardBtn')?.addEventListener('click', e => {
      e.preventDefault(); window.location.href = '/dashboard/';
    });

    if (submissionModeSelect) {
      submissionModeSelect.addEventListener('change', e => applySubmissionMode(e.target.value));
      applySubmissionMode(submissionModeSelect.value || '');
    }

    submitAssignmentBtn?.addEventListener('click', submitAssignment);

    assignmentsList?.addEventListener('click', async e => {
      const repoBtn = e.target.closest('[data-submit-activity-id]');
      if (repoBtn) {
        openSubmissionModal(repoBtn.getAttribute('data-submit-activity-id'));
        return;
      }

      const pendingBtn = e.target.closest('[data-submit-pending-activity-id]');
      if (pendingBtn) {
        await submitPendingActivity(
          pendingBtn.getAttribute('data-submit-pending-activity-id'),
          pendingBtn
        );
        return;
      }

      const detailsBtn = e.target.closest('[data-view-activity-id]');
      if (detailsBtn) {
        openDetailsModal(detailsBtn.getAttribute('data-view-activity-id'));
      }
    });

    document.querySelectorAll('[data-tracked-filter]').forEach(btn => btn.addEventListener('click', () => {
      state.filters.trackedSubmission = btn.getAttribute('data-tracked-filter') || 'ALL';
      document.querySelectorAll('[data-tracked-filter]').forEach(b =>
        b.classList.toggle('active', b.getAttribute('data-tracked-filter') === state.filters.trackedSubmission));
      renderActivities();
    }));
  }

  renderLoadingSkeleton();
  attachEventHandlers();
  loadAll();
})();
