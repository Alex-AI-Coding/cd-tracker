// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD.JS — Fixed with Proper Refresh Token Handling
// ══════════════════════════════════════════════════════════════════════════════

const apiRequest = window.ApiClient?.request;
const userApi = window.ApiClient?.user;
const classroomApi = window.ApiClient?.classrooms;

// ── DOM Elements ────────────────────────────────────────────────────────────
const createClassBtn       = document.getElementById('createClassBtn');
const joinClassBtn         = document.getElementById('joinClassBtn');
const searchClassBtn       = document.getElementById('searchClassBtn');
const headerSearch         = document.getElementById('headerSearch');
const classSearchInput     = document.getElementById('classSearchInput');
const createModal          = document.getElementById('createModal');
const joinModal            = document.getElementById('joinModal');
const profileModal         = document.getElementById('profileModal');
const confirmCreate        = document.getElementById('confirmCreate');
const confirmJoin          = document.getElementById('confirmJoin');
const cancelCreate         = document.getElementById('cancelCreate');
const cancelJoin           = document.getElementById('cancelJoin');
const manageModal          = document.getElementById('manageModal');
const userIcon             = document.getElementById('userIcon');
const profileDropdown      = document.getElementById('profileDropdown');
const viewProfileBtn       = document.getElementById('viewProfileBtn');
const logoutBtn            = document.getElementById('logoutBtn');
const closeProfileModal    = document.getElementById('closeProfileModal');
const cancelProfileModal   = document.getElementById('cancelProfileModal');
const uploadPictureBtn     = document.getElementById('uploadPictureBtn');
const removePictureBtn     = document.getElementById('removePictureBtn');
const profilePictureInput  = document.getElementById('profilePictureInput');
const saveProfileBtn       = document.getElementById('saveProfileBtn');
const welcomeBanner        = document.getElementById('welcomeBanner');
const hideWelcomeBtn       = document.getElementById('hideWelcomeBtn');

// Form inputs — Create Class
const classNameInput       = document.getElementById('classNameInput');
const classDescInput       = document.getElementById('classDescInput');
const maxStudentsInput     = document.getElementById('maxStudentsInput');
const passcodeToggle       = document.getElementById('passcodeToggle');
const passcodeSection      = document.getElementById('passcodeSection');
const passcodeInput        = document.getElementById('passcodeInput');
const requireApprovalInput = document.getElementById('requireApprovalInput');

// Form inputs — Join Class
const classCodeInput       = document.getElementById('classCodeInput');
const joinPasscodeSection  = document.getElementById('joinPasscodeSection');
const joinPasscodeInput    = document.getElementById('joinPasscodeInput');

let joinRequiresPasscode = false;
let joinPasscodeClassCode = '';

// Tab state
let currentTab = 'created';
let classroomsData = { created: [], joined: [] };
let classLoadState = { created: false, joined: false };
let classroomSearchTerm = '';

// Manage modal state
let currentManageClassId = null;
let currentManageClassroomStatus = 'ACTIVE';

// Current user
let currentUser = null;
const welcomeBannerStoragePrefix = 'codetracker:dashboard:welcome-hidden:';
const normalizeSearchText = (value) => String(value || '').trim().toLowerCase();

// ══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
    if (!apiRequest || !userApi) {
        showNotification('API client is not initialized.', 'error');
        return;
    }

    if (window.ApiClient?.checkSessionState) {
        const sessionState = await window.ApiClient.checkSessionState();
        if (!sessionState.authenticated) {
            window.location.replace('/');
            return;
        }

        if (!sessionState.fullyInitialized) {
            window.location.replace('/onboarding/');
            return;
        }
    }

    await loadUserProfile();
    await loadClasses();
    setupEventListeners();

    // ── Tutorial Modal ─────────────────────────────────────────────
const viewTutorialsBtn = document.getElementById('viewTutorialsBtn');
const tutorialModal = document.getElementById('tutorialModal');
const closeTutorialModal = document.getElementById('closeTutorialModal');
const closeHelpBtn = document.getElementById("closeHelpModal");
const createClassHelpModal = document.getElementById("createClassHelpModal");
const joinClassHelpModal = document.getElementById("joinClassHelpModal");
const preview = document.getElementById("imagePreview");
const previewImg = document.getElementById("previewImg");
const closePreview = document.getElementById("closePreview");
let activeHelpModal = null;
// select ALL tutorial images
document.querySelectorAll(".tutorial-step-img").forEach(img => {
    img.addEventListener("click", () => {
        activeHelpModal = img.closest(".modal");
        preview.style.display = "flex";
        setTimeout(() => preview.classList.add('show'), 10);
        previewImg.src = img.src;
    });
});

// close button
closePreview.addEventListener("click", () => {
    preview.classList.remove('show');
    setTimeout(() => preview.style.display = "none", 250);
    resetHelpModal(); // ✅ Always reset after closing preview
});

preview.addEventListener("click", (e) => {
    if (e.target === preview) {
        preview.classList.remove('show');
        setTimeout(() => preview.style.display = "none", 250);
        resetHelpModal(); // ✅ Reset here too
    }
});

// ✅ Universal reset function that works for all 3 modals
function resetHelpModal(modal = null) {
    // Use the passed modal first, fall back for backwards compatibility
    const targetModal = modal || activeHelpModal || window.helpModal;
    
    if (!targetModal) return;
    
    const scrollableContent = targetModal.querySelector(".modal-content");
    if (scrollableContent) {
        scrollableContent.scrollTop = 0;
    }

    // Clear the active modal reference properly
    activeHelpModal = null;
}

closeHelpBtn.addEventListener("click", () => {
    resetHelpModal();
    closeModal(helpModal);
});
// Open Tutorial Modal
viewTutorialsBtn.addEventListener('click', () => {
    openModal(tutorialModal);
    resetHelpModal();
});

// Close Tutorial Modal
closeTutorialModal.addEventListener('click', () => {
    closeModal(tutorialModal);
});

helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) {
        resetHelpModal();
        closeModal(helpModal);
    }
});
// Optional: close if clicking outside the modal content
window.addEventListener('click', (e) => {
    if (e.target === tutorialModal) {
        closeModal(tutorialModal);
    }
});

// Add these after your other modal handlers
createClassHelpModal.addEventListener("click", (e) => {
    if (e.target === createClassHelpModal) {
        resetHelpModal(createClassHelpModal);
        closeModal(createClassHelpModal);
    }
});

joinClassHelpModal.addEventListener("click", (e) => {
    if (e.target === joinClassHelpModal) {
        resetHelpModal(joinClassHelpModal);
        closeModal(joinClassHelpModal);
    }
});
// ✅ Fixed open handlers
document.getElementById("gitTutorialCard").onclick = () => {
    resetHelpModal(helpModal); // Reset first
    openModal(helpModal);
};

document.getElementById("createClassTutorialCard").onclick = () => {
    const modal = document.getElementById("createClassHelpModal");
    resetHelpModal(modal); // ✅ Reset scroll BEFORE opening
    openModal(modal);
};

document.getElementById("joinClassTutorialCard").onclick = () => {
    const modal = document.getElementById("joinClassHelpModal");
    resetHelpModal(modal); // ✅ Reset first
    openModal(modal);
};

// CLOSE
document.getElementById("closeHelpModal").onclick = () => {
    closeModal(helpModal);
};

document.getElementById("closeCreateClassHelp").onclick = () => {
    resetHelpModal(document.getElementById("createClassHelpModal"));
    closeModal(document.getElementById("createClassHelpModal"));
};

document.getElementById("closeJoinClassHelp").onclick = () => {
    resetHelpModal(document.getElementById("joinClassHelpModal"));
    closeModal(document.getElementById("joinClassHelpModal"));
};

});

document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function () {
        const input = document.getElementById(this.dataset.target);
        const icon = this.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════


function unwrap(val) {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
        return val.value ?? val.number ?? val.date ?? val.name ?? '';
    }
    return String(val);
}

function resolveClassroomId(classroom) {
    if (!classroom || typeof classroom !== 'object') return '';

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const looksLikeClassroomId = (value) => UUID_RE.test(value);
    const looksLikeUserId = (value) => /^usr-/i.test(value) || /^@t-/i.test(value);
    const normalize = (candidate, requireClassPrefix = true) => {
        const value = String(unwrap(candidate) || '').trim();
        if (!value || value === '[object Object]') return '';
        if (looksLikeUserId(value)) return '';
        if (requireClassPrefix && !looksLikeClassroomId(value)) return '';
        return value;
    };

    const topCandidates = [
        classroom.classroomId,
        classroom.classroomID,
        classroom.classId,
        classroom.classroomUid,
        classroom.classroomUUID,
        classroom.classroomUuid
    ];

    for (const candidate of topCandidates) {
        const value = normalize(candidate, true);
        if (value) return value;
    }

    if (classroom.classroom && typeof classroom.classroom === 'object') {
        const nestedId = resolveClassroomId(classroom.classroom);
        if (nestedId) return nestedId;
    }

    const fallbackCandidates = [classroom.id, classroom._id, classroom.uuid];
    for (const candidate of fallbackCandidates) {
        const value = normalize(candidate, true);
        if (value) return value;
    }

    return '';
}

function capitalise(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function resolveClassroomStatus(classroom) {
    if (!classroom || typeof classroom !== 'object') return '';

    const candidates = [
        classroom.status,
        classroom.classroomStatus,
        classroom.classStatus,
        classroom.state,
        classroom.settings?.status,
        classroom.settings?.classroomStatus,
        classroom.classroomSettings?.status,
        classroom.classroomSettings?.classroomStatus
    ];

    for (const candidate of candidates) {
        const value = String(unwrap(candidate) || '').trim().toUpperCase();
        if (value) return value;
    }

    const nestedContainers = [
        classroom.classroom,
        classroom.data,
        classroom.classroomData,
        classroom.settings,
        classroom.classroomSettings
    ];

    for (const nested of nestedContainers) {
        if (nested && typeof nested === 'object') {
            const nestedStatus = resolveClassroomStatus(nested);
            if (nestedStatus) return nestedStatus;
        }
    }

    return '';
}

function normalizeClassroomPayload(item) {
    const source = item && typeof item === 'object' ? item : {};
    const classroom = source.classroom && typeof source.classroom === 'object'
        ? source.classroom
        : source.classroomData && typeof source.classroomData === 'object'
            ? source.classroomData
            : source;

    // Prefer top-level values (e.g., join payload fields like studentCount/maxStudent)
    // over nested classroom defaults.
    const normalized = {
        ...classroom,
        ...source
    };

    const resolvedStatus = resolveClassroomStatus(source) || resolveClassroomStatus(classroom);
    if (resolvedStatus) {
        normalized.status = resolvedStatus;
        normalized.classroomStatus = resolvedStatus;
    }

    // Always resolve maxStudent for both created and joined classrooms
    const resolvedMax = resolveMaxStudents({
        ...normalized,
        maxStudent: source.maxStudent ?? classroom.maxStudent ?? source.maxStudents ?? classroom.maxStudents,
        maxStudents: source.maxStudents ?? classroom.maxStudents ?? source.maxStudent ?? classroom.maxStudent
    }, 50);
    normalized.maxStudent = resolvedMax;
    normalized.maxStudents = resolvedMax;

    return normalized;
}

function resolveMaxStudents(classroom, fallback = 50) {
    const rawValue =
        classroom?.maxStudent ??
        classroom?.maxStudents ??
        classroom?.max_student ??
        classroom?.capacity;

    const value = unwrap(rawValue);
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function updateCurrentStatusBadge(status) {
    const badge = document.getElementById('manageCurrentStatusBadge');
    if (!badge) return;

    const normalized = String(status || 'UNKNOWN').toUpperCase();
    badge.textContent = normalized;
    badge.classList.remove('active', 'closed', 'archived');

    if (normalized === 'ACTIVE') badge.classList.add('active');
    if (normalized === 'CLOSED') badge.classList.add('closed');
    if (normalized === 'ARCHIVED') badge.classList.add('archived');
}

function updateCloseStatusWarning(status) {
    const warning = document.getElementById('manageCloseStatusWarning');
    if (!warning) return;

    const normalized = String(status || '').toUpperCase();
    warning.classList.toggle('show', normalized !== 'CLOSED');
}

function syncCloseStatusAction(status) {
    const normalized = String(status || '').toUpperCase();
    const button = document.getElementById('updateStatusBtn');
    if (!button) return;

    if (normalized === 'CLOSED' || normalized === 'ARCHIVED') {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-lock"></i> Classroom Closed';
    } else {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-lock"></i> Close Classroom';
    }
}

function getInitials(name) {
    const parts = name.trim().split(/\s+/); // split by spaces
    const firstInitial = parts[0] ? parts[0][0].toUpperCase() : '';
    const lastInitial = parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : '';
    return (firstInitial + lastInitial) || 'U';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    document.querySelector('.notification')?.remove();

    const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b' };
    const n = document.createElement('div');
    n.className = `notification notification-${type}`;
    n.textContent = message;
    n.style.cssText = `
        position:fixed;top:20px;right:20px;padding:15px 20px;border-radius:8px;
        color:#fff;font-weight:500;z-index:10000;animation:slideIn .3s ease-out;
        box-shadow:0 4px 12px rgba(0,0,0,.15);max-width:400px;
        background-color:${colors[type] || colors.info};
    `;
    document.body.appendChild(n);
    setTimeout(() => {
        n.style.animation = 'slideOut .3s ease-in';
        setTimeout(() => n.remove(), 300);
    }, 3000);
}

async function copyTextToClipboard(text) {
    const value = String(text || '');
    if (!value) return false;

    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
    }

    const tempInput = document.createElement('input');
    tempInput.value = value;
    tempInput.setAttribute('readonly', '');
    tempInput.style.position = 'absolute';
    tempInput.style.left = '-9999px';
    document.body.appendChild(tempInput);
    tempInput.select();

    const copied = document.execCommand('copy');
    document.body.removeChild(tempInput);
    return copied;
}

function normalizeClassCodeForJoin(value) {
    return String(value || '').trim().toUpperCase();
}

function setJoinPasscodeRequirement(required, forCode = '') {
    joinRequiresPasscode = Boolean(required);
    joinPasscodeClassCode = normalizeClassCodeForJoin(forCode);

    if (joinPasscodeSection) {
        joinPasscodeSection.style.display = joinRequiresPasscode ? 'block' : 'none';
    }

    if (joinPasscodeInput) {
        joinPasscodeInput.required = joinRequiresPasscode;
        if (!joinRequiresPasscode) {
            joinPasscodeInput.value = '';
        }
    }
}

function resetJoinPasscodeRequirement() {
    setJoinPasscodeRequirement(false, '');
}

function isPasscodeRequiredError(message) {
    const normalized = String(message || '').toLowerCase();
    return normalized.includes('requires a passcode') ||
        normalized.includes('passcode required') ||
        normalized.includes('passcode is required');
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function openModal(modal) {
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    }
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 250);
    
    if (modal === createModal) {
        classNameInput.value       = '';
        classDescInput.value       = '';
        maxStudentsInput.value     = '50';
        passcodeToggle.checked     = false;
        passcodeSection.style.display = 'none';
        passcodeInput.value        = '';
        passcodeInput.required     = false;
        if (requireApprovalInput) {
            requireApprovalInput.checked = false;
        }
    } else if (modal === joinModal) {
        classCodeInput.value = '';
        resetJoinPasscodeRequirement();
    } else if (modal === manageModal) {
        const box   = document.getElementById('deleteConfirmBox');
        const input = document.getElementById('deleteConfirmInput');
        if (box)   box.classList.remove('visible');
        if (input) { input.value = ''; input.classList.remove('match'); }
        document.getElementById('confirmDeleteBtn')?.setAttribute('disabled', 'true');
    }
}

function closeProfileDropdown() {
    if (profileDropdown) {
        profileDropdown.classList.remove('show');
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS SETUP
// ══════════════════════════════════════════════════════════════════════════════

function setupEventListeners() {
    // Modal triggers
    createClassBtn?.addEventListener('click', () => openModal(createModal));
    joinClassBtn?.addEventListener('click', () => openModal(joinModal));
    cancelCreate?.addEventListener('click', () => closeModal(createModal));
    cancelJoin?.addEventListener('click', () => closeModal(joinModal));

    // Form submissions
    confirmCreate?.addEventListener('click', handleCreateClass);
    confirmJoin?.addEventListener('click', handleJoinClass);
    saveProfileBtn?.addEventListener('click', handleSaveProfile);

    // Header search
    searchClassBtn?.addEventListener('click', () => toggleHeaderSearch(true));
    classSearchInput?.addEventListener('input', (e) => {
        classroomSearchTerm = normalizeSearchText(e.target.value);
        syncHeaderSearchVisibility();
        renderClasses();
    });
    classSearchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!normalizeSearchText(classSearchInput?.value)) {
                toggleHeaderSearch(false);
            }
        }
    });

    // Profile menu
    userIcon?.addEventListener('click', toggleProfileDropdown);
    viewProfileBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeProfileDropdown();
        openProfileModal();
    });
    logoutBtn?.addEventListener('click', handleLogout);
    hideWelcomeBtn?.addEventListener('click', handleHideWelcomeBanner);

    // Profile modal
    closeProfileModal?.addEventListener('click', () => closeModal(profileModal));
    cancelProfileModal?.addEventListener('click', () => closeModal(profileModal));
    uploadPictureBtn?.addEventListener('click', () => profilePictureInput?.click());
    document.getElementById('profilePictureOverlay')?.addEventListener('click', () => profilePictureInput?.click());
    profilePictureInput?.addEventListener('change', handleProfilePictureUpload);
    removePictureBtn?.addEventListener('click', handleRemoveProfilePicture);

    // Create class passcode toggle
    passcodeToggle?.addEventListener('change', (e) => {
        if (e.target.checked) {
            passcodeSection.style.display = 'block';
            passcodeInput.required = true;
        } else {
            passcodeSection.style.display = 'none';
            passcodeInput.required = false;
            passcodeInput.value = '';
        }
    });

    classCodeInput?.addEventListener('input', () => {
        const normalizedCode = normalizeClassCodeForJoin(classCodeInput.value);
        if (!normalizedCode) {
            resetJoinPasscodeRequirement();
            return;
        }

        if (joinPasscodeClassCode && normalizedCode !== joinPasscodeClassCode) {
            resetJoinPasscodeRequirement();
        }
    });

    // Manage modal
    document.getElementById('closeManageModal')?.addEventListener('click', () => closeModal(manageModal));
    document.getElementById('cancelManage')?.addEventListener('click',      () => closeModal(manageModal));
    document.getElementById('saveManageBtn')?.addEventListener('click',     handleUpdateClassroom);
    document.getElementById('updateStatusBtn')?.addEventListener('click',    handleUpdateStatus);
    // Delete — show typed-confirmation box
    document.getElementById('deleteClassBtn')?.addEventListener('click', () => {
        const box = document.getElementById('deleteConfirmBox');
        const input = document.getElementById('deleteConfirmInput');
        const target = document.getElementById('deleteConfirmTarget');
        const classroom = classroomsData.created.find(c => String(resolveClassroomId(c)) === String(currentManageClassId));
        if (target) target.textContent = classroom?.className || classroom?.name || 'the classroom name';
        if (input)  {
            input.value = '';
            input.classList.remove('match', 'drop-target');
        }
        document.getElementById('confirmDeleteBtn')?.setAttribute('disabled', 'true');
        if (box) box.classList.add('visible');
        setTimeout(() => input?.focus(), 50);
    });

    document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => {
        const box = document.getElementById('deleteConfirmBox');
        const input = document.getElementById('deleteConfirmInput');
        if (box)   box.classList.remove('visible');
        if (input) {
            input.value = '';
            input.classList.remove('match', 'drop-target');
        }
        document.getElementById('confirmDeleteBtn')?.setAttribute('disabled', 'true');
    });

    document.getElementById('deleteConfirmInput')?.addEventListener('input', (e) => {
        validateDeleteConfirmationValue(e.target);
    });

    const deleteConfirmTarget = document.getElementById('deleteConfirmTarget');
    const deleteConfirmInput = document.getElementById('deleteConfirmInput');
    deleteConfirmTarget?.addEventListener('dragstart', (event) => {
        const dragName = (deleteConfirmTarget.textContent || '').trim();
        event.dataTransfer?.setData('text/plain', dragName);
        event.dataTransfer.effectAllowed = 'copy';
    });

    deleteConfirmInput?.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        deleteConfirmInput.classList.add('drop-target');
    });

    deleteConfirmInput?.addEventListener('dragleave', () => {
        deleteConfirmInput.classList.remove('drop-target');
    });

    deleteConfirmInput?.addEventListener('drop', (event) => {
        event.preventDefault();
        const droppedText = event.dataTransfer?.getData('text/plain') || '';
        deleteConfirmInput.value = droppedText;
        deleteConfirmInput.classList.remove('drop-target');
        validateDeleteConfirmationValue(deleteConfirmInput);
    });

    document.getElementById('confirmDeleteBtn')?.addEventListener('click', handleDeleteClassroom);

    // Tab switching
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-button')) {
            switchTab(e.target.dataset.tab);
        }
    });

    // Modal close on background click
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal') && e.target.style.display === 'flex') {
            closeModal(e.target);
        }
    });

    // Profile dropdown close on outside click
    document.addEventListener('click', (e) => {
        const isUserIconClick = userIcon && userIcon.contains(e.target);
        const isDropdownClick = profileDropdown && profileDropdown.contains(e.target);
        const isSearchClick = headerSearch && headerSearch.contains(e.target);
        const isSearchButtonClick = searchClassBtn && searchClassBtn.contains(e.target);
        const hasSearchText = Boolean(normalizeSearchText(classSearchInput?.value));
        
        if (!isUserIconClick && !isDropdownClick && !isSearchClick && !isSearchButtonClick && !hasSearchText) {
            closeProfileDropdown();
            toggleHeaderSearch(false);
        }
    });
}

function toggleHeaderSearch(forceOpen = null) {
    if (!headerSearch || !searchClassBtn) return;

    const hasSearchText = Boolean(normalizeSearchText(classSearchInput?.value));
    const shouldOpen = forceOpen === null ? !headerSearch.classList.contains('is-open') : forceOpen;
    const canClose = !hasSearchText;

    if (!shouldOpen && !canClose) {
        headerSearch.classList.add('is-open');
        searchClassBtn.setAttribute('aria-expanded', 'true');
        return;
    }

    headerSearch.classList.toggle('is-open', shouldOpen);
    searchClassBtn.setAttribute('aria-expanded', String(shouldOpen));

    if (shouldOpen) {
        requestAnimationFrame(() => classSearchInput?.focus());
    } else if (document.activeElement === classSearchInput) {
        classSearchInput.blur();
    }
}

function clearClassSearch() {
    classroomSearchTerm = '';
    if (classSearchInput) classSearchInput.value = '';
    syncHeaderSearchVisibility();
    renderClasses();
}

function syncHeaderSearchVisibility() {
    if (!headerSearch || !searchClassBtn) return;
    const hasSearchText = Boolean(normalizeSearchText(classSearchInput?.value));
    const shouldBeOpen = hasSearchText || headerSearch.classList.contains('is-open');
    headerSearch.classList.toggle('is-open', shouldBeOpen);
    searchClassBtn.setAttribute('aria-expanded', String(shouldBeOpen));
}

function getFilteredClasses(classes = []) {
    if (!classroomSearchTerm) return classes;

    return classes.filter((classroom) => {
        const className = normalizeSearchText(classroom?.className || classroom?.name || classroom?.title);
        const classCode = normalizeSearchText(classroom?.classCode || classroom?.code || classroom?.inviteCode || classroom?.id);
        return className.includes(classroomSearchTerm) || classCode.includes(classroomSearchTerm);
    });
}

function validateDeleteConfirmationValue(inputEl) {
    const classroom = classroomsData.created.find(c => String(resolveClassroomId(c)) === String(currentManageClassId));
    const expected = classroom?.className || classroom?.name || '';
    const matches = inputEl.value === expected;
    const btn = document.getElementById('confirmDeleteBtn');
    inputEl.classList.toggle('match', matches);
    if (btn) matches ? btn.removeAttribute('disabled') : btn.setAttribute('disabled', 'true');
}

    document.getElementById("gitTutorialCard").onclick = function () {
    document.getElementById("helpModal").style.display = "flex";
};

// ══════════════════════════════════════════════════════════════════════════════

// PROFILE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Loads the current user's profile and updates the UI.
 */
async function loadUserProfile() {
    try {
        if (!userApi) {
            showNotification('API client is not initialized.', 'error');
            return null;
        }
        const data = await userApi.getProfile();
        currentUser = data;
        applyProfileToUI(data);
        return data;
    } catch (error) {
        console.error('Failed to load user profile:', error);
        showNotification('Failed to load user profile', 'error');
        return null;
    }
}

function isProfileInitialized(profile) {
    if (!profile || typeof profile !== 'object') return false;

    const hasName = Boolean(String(profile.firstName || '').trim()) || Boolean(String(profile.lastName || '').trim());
    const hasGender = Boolean(String(unwrap(profile.gender) || '').trim());

    return hasName || hasGender;
}

function applyProfileToUI(data) {
    const firstName  = data.firstName || '';
    const lastName   = data.lastName  || '';
    const fullName   = `${firstName} ${lastName}`.trim() || 'User';
    const profileUrl = data.profileUrl || '';
    const email      = data.email || '';

    const welcomeUserEl = document.getElementById('welcomeUser');
    if (welcomeUserEl) welcomeUserEl.textContent = firstName || fullName;
    updateWelcomeBannerVisibility(data);

    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = fullName;
    
    const fullNameEl = document.getElementById('fullName');
    if (fullNameEl) fullNameEl.textContent = fullName;
    
    const usernameEl = document.getElementById('username');
    if (usernameEl) usernameEl.textContent = email;

    const iconEl = document.getElementById('userIcon');
    if (iconEl) {
        if (profileUrl) {
            iconEl.innerHTML = `<img src="${escapeHtml(profileUrl)}" alt="${escapeHtml(fullName)}">`;
        } else {
            iconEl.textContent = getInitials(fullName);
        }
    }
}

function getUserStorageId(user) {
    if (!user || typeof user !== 'object') return '';
    return String(
        user.userId ||
        user.id ||
        user.uid ||
        user.uuid ||
        user.email ||
        ''
    ).trim().toLowerCase();
}

function getWelcomeBannerStorageKey(user) {
    const userStorageId = getUserStorageId(user);
    return userStorageId ? `${welcomeBannerStoragePrefix}${userStorageId}` : '';
}

function isWelcomeBannerHiddenForUser(user) {
    const key = getWelcomeBannerStorageKey(user);
    if (!key) return false;
    return localStorage.getItem(key) === '1';
}

function setWelcomeBannerHiddenForUser(user, isHidden) {
    const key = getWelcomeBannerStorageKey(user);
    if (!key) return;
    localStorage.setItem(key, isHidden ? '1' : '0');
}

function updateWelcomeBannerVisibility(user = currentUser) {
    if (!welcomeBanner) return;
    const isHidden = isWelcomeBannerHiddenForUser(user);
    welcomeBanner.classList.toggle('is-hidden', isHidden);
}

function handleHideWelcomeBanner() {
    if (!currentUser) return;
    setWelcomeBannerHiddenForUser(currentUser, true);
    updateWelcomeBannerVisibility(currentUser);
}

function toggleProfileDropdown(e) {
    e.stopPropagation();
    if (profileDropdown) {
        profileDropdown.classList.toggle('show');
    }
}

async function openProfileModal() {
    openModal(profileModal); // 👈 OPEN IMMEDIATELY

    try {
        if (!userApi) throw new Error('API client not ready');

        const data = await userApi.getProfile();

        populateProfilePicture(data);


        const firstNameEl = document.getElementById('editFirstNameInput');
        const lastNameEl  = document.getElementById('editLastNameInput');
        const genderEl    = document.getElementById('editGenderInput');

        if (firstNameEl) firstNameEl.value = data.firstName || '';
        if (lastNameEl)  lastNameEl.value  = data.lastName || '';
        if (genderEl)    genderEl.value    = unwrap(data.gender) || '';

    } catch (error) {
        console.error('Error opening profile:', error);
        if (!error.message.includes('403') && !error.message.includes('401')) {
            showNotification('Failed to load profile data', 'error');
        }

    }
}

function populateProfilePicture(data) {
    const firstName  = data.firstName || '';
    const lastName   = data.lastName  || '';
    const fullName   = `${firstName} ${lastName}`.trim() || 'User';
    const profileUrl = data.profileUrl || '';

    const picEl = document.getElementById('profilePictureLarge');
    if (picEl) {
        if (profileUrl) {
            picEl.innerHTML = `<img src="${escapeHtml(profileUrl)}" alt="${escapeHtml(fullName)}">`;
            picEl.style.background = 'none';
        } else {
            picEl.innerHTML = `<span id="profileInitialsLarge">${getInitials(fullName)}</span>`;
            picEl.style.background = 'white';
picEl.style.color = '#000';
        }
    }

    const removeBtnEl = document.getElementById('removePictureBtn');
    if (removeBtnEl) {
        removeBtnEl.style.display = profileUrl ? 'flex' : 'none';
    }
}

async function handleSaveProfile() {
    const firstNameEl = document.getElementById('editFirstNameInput');
    const lastNameEl  = document.getElementById('editLastNameInput');
    const genderEl    = document.getElementById('editGenderInput');

    const firstName   = firstNameEl?.value.trim() || '';
    const lastName    = lastNameEl?.value.trim() || '';
    const gender      = genderEl?.value.trim() || '';

    if (!firstName || !lastName || !gender) {
        showNotification('Please fill all required fields', 'error');
        return;
    }

    if (saveProfileBtn) {
        saveProfileBtn.disabled    = true;
        saveProfileBtn.innerHTML   = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
        if (!userApi) {
            throw new Error('API client is not initialized.');
        }

        await userApi.updateProfile({ firstName, lastName, gender });

        showNotification('Profile updated successfully!', 'success');
        closeModal(profileModal);
        await loadUserProfile();

    } catch (error) {
        console.error(error);
        showNotification(error.message || 'Update failed', 'error');
    } finally {
        if (saveProfileBtn) {
            saveProfileBtn.disabled    = false;
            saveProfileBtn.innerHTML   = '<i class="fas fa-check"></i> Save Changes';
        }
    }
}

async function handleLogout() {
    const confirmed = await window.AppDialog.confirm('Are you sure you want to log out?', {
        title: 'Log Out',
        confirmText: 'Log Out',
        danger: true
    });

    if (!confirmed) return;

    if (!window.ApiClient?.logout) {
        window.location.href = '/';
        return;
    }


    window.ApiClient.logout().finally(() => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/';
    });
}
// ══════════════════════════════════════════════════════════════════════════════
// PROFILE PICTURE UPLOAD / REMOVE
// ══════════════════════════════════════════════════════════════════════════════

async function handleProfilePictureUpload() {
    const file = profilePictureInput?.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        showNotification('File is too large. Maximum size is 5MB.', 'error');
        profilePictureInput.value = '';
        return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showNotification('Invalid file type. Use JPEG, PNG, GIF or WebP.', 'error');
        profilePictureInput.value = '';
        return;
    }

    if (uploadPictureBtn) {
        uploadPictureBtn.disabled = true;
        uploadPictureBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    }

    try {
        if (!userApi) {
            throw new Error('API client is not initialized.');
        }

        await userApi.updateProfilePicture(file);

        showNotification('Profile picture updated!', 'success');

        await loadUserProfile();
        if (currentUser) populateProfilePicture(currentUser);

    } catch (error) {
        console.error('Error uploading profile picture:', error);
        showNotification('Failed to upload profile picture', 'error');
    } finally {
        if (uploadPictureBtn) {
            uploadPictureBtn.disabled = false;
            uploadPictureBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Photo';
        }
        if (profilePictureInput) profilePictureInput.value = '';
    }
}

async function handleRemoveProfilePicture() {
    const confirmed = await window.AppDialog.confirm('Remove your profile picture?', {
        title: 'Remove Profile Picture',
        confirmText: 'Remove',
        danger: true
    });

    if (!confirmed) return;

    if (removePictureBtn) {
        removePictureBtn.disabled = true;
        removePictureBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removing...';
    }

    try {
        if (!userApi) {
            throw new Error('API client is not initialized.');
        }

        await userApi.removeProfilePicture();

        showNotification('Profile picture removed!', 'success');

        await loadUserProfile();
        if (currentUser) populateProfilePicture(currentUser);

    } catch (error) {
        console.error('Error removing profile picture:', error);
        showNotification('Failed to remove profile picture', 'error');
    } finally {
        if (removePictureBtn) {
            removePictureBtn.disabled = false;
            removePictureBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Remove';
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// CLASSROOM MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

async function handleCreateClass() {
    const name            = classNameInput?.value.trim() || '';
    const description     = classDescInput?.value.trim() || '';
    const maxStudents     = parseInt(maxStudentsInput?.value || '50');

    const requireApproval = false;

    const passcode        = passcodeToggle?.checked ? passcodeInput?.value.trim() : null;

    if (!name) {
        return showNotification('Please enter a class name', 'error');
    }
    if (name.length < 3 || name.length > 100) {
        return showNotification('Class name must be 3–100 characters', 'error');
    }
    if (description && description.length > 500) {
        return showNotification('Description cannot exceed 500 characters', 'error');
    }
    if (!maxStudents || maxStudents < 1 || maxStudents > 100) {
        return showNotification('Max students must be 1–100', 'error');
    }
    if (passcode && passcode.length < 4) {
        return showNotification('Passcode must be at least 4 characters', 'error');
    }

    if (confirmCreate) {
        confirmCreate.disabled    = true;
        confirmCreate.textContent = 'Creating...';
    }

    try {
        await apiRequest('/classrooms/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                description: description || null,
                maxStudents,
                requireApproval: false,
                passcode: passcode || null
            })
        });

        showNotification('Classroom created successfully!', 'success');
        closeModal(createModal);
        await loadClasses();

    } catch (error) {
        console.error('Error creating classroom:', error);
        showNotification(error.message || 'Failed to create classroom. Please try again.', 'error');
    } finally {
        if (confirmCreate) {
            confirmCreate.disabled    = false;
            confirmCreate.textContent = 'Create Class';
        }
    }
}

async function handleJoinClass() {
    const code = classCodeInput?.value.trim() || '';
    const normalizedCode = normalizeClassCodeForJoin(code);
    const passcode = joinPasscodeInput?.value.trim() || '';

    if (!code) {
        return showNotification('Please enter a class code', 'error');
    }

    if (joinRequiresPasscode && !passcode) {
        joinPasscodeInput?.focus();
        return showNotification('Please enter the class passcode', 'error');
    }

    if (confirmJoin) {
        confirmJoin.disabled    = true;
        confirmJoin.textContent = 'Joining...';
    }

    try {
        const payload = { code };

        if (joinRequiresPasscode && passcode) {
            payload.passcode = passcode;
        }

        const response = await apiRequest('/classrooms/join', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const hasPassword = Boolean(response?.data?.hasPassword ?? response?.hasPassword);
        setJoinPasscodeRequirement(hasPassword, normalizedCode);

        showNotification('Successfully joined classroom!', 'success');
        closeModal(joinModal);
        await loadClasses();

    } catch (error) {
        console.error('Error joining classroom:', error);

        const message = error?.message || '';
        if (isPasscodeRequiredError(message)) {
            setJoinPasscodeRequirement(true, normalizedCode);
            joinPasscodeInput?.focus();
            showNotification('This class requires a passcode. Enter it to continue.', 'info');
            return;
        }

        showNotification(message || 'Failed to join classroom. Please try again.', 'error');
    } finally {
        if (confirmJoin) {
            confirmJoin.disabled    = false;
            confirmJoin.textContent = 'Join Class';
        }
    }
}

async function loadClasses() {
    const container = document.getElementById('classroomGrid');
    if (!container) return;

    classLoadState.created = true;
    classLoadState.joined = true;
    updateTabCounts();
    renderClasses();

    const createdRequest = apiRequest('/classrooms/me', { method: 'GET' })
        .then((createdResult) => {
            const createdRaw = Array.isArray(createdResult) ? createdResult : createdResult?.data || [];
            classroomsData.created = Array.isArray(createdRaw)
                ? createdRaw.map(item => normalizeClassroomPayload(item))
                : [];
        })
        .catch((error) => {
            console.warn('Failed to load created classrooms:', error);
            classroomsData.created = [];
        })
        .finally(() => {
            classLoadState.created = false;
            updateTabCounts();
            renderClasses();
        });

    const joinedRequest = apiRequest('/classrooms/join', { method: 'GET' }, { redirectOnUnauthorized: false })
        .then((joinedData) => {
            const joinedRaw = Array.isArray(joinedData) ? joinedData : joinedData?.data || [];
            classroomsData.joined = Array.isArray(joinedRaw)
                ? joinedRaw.map(item => {
                    const normalized = normalizeClassroomPayload(item);
                    const resolvedMax = resolveMaxStudents({
                        ...normalized,
                        maxStudent:
                            item?.maxStudent ??
                            item?.classroom?.maxStudent ??
                            item?.classroomData?.maxStudent ??
                            item?.maxStudents ??
                            item?.classroom?.maxStudents ??
                            item?.classroomData?.maxStudents ??
                            normalized.maxStudent ??
                            normalized.maxStudents,
                        maxStudents:
                            item?.maxStudents ??
                            item?.classroom?.maxStudents ??
                            item?.classroomData?.maxStudents ??
                            item?.maxStudent ??
                            item?.classroom?.maxStudent ??
                            item?.classroomData?.maxStudent ??
                            normalized.maxStudents ??
                            normalized.maxStudent
                    }, 50);

                    return {
                        ...normalized,
                        studentCount:
                            item?.studentCount ??
                            item?.classroom?.studentCount ??
                            item?.classroomData?.studentCount ??
                            normalized.studentCount ??
                            0,
                        maxStudent: resolvedMax,
                        maxStudents: resolvedMax
                    };
                })
                : [];
        })
        .catch((error) => {
            console.warn('Failed to load joined classrooms:', error);
            classroomsData.joined = [];
        })
        .finally(() => {
            classLoadState.joined = false;
            updateTabCounts();
            renderClasses();
        });

    await Promise.allSettled([createdRequest, joinedRequest]);
}

function switchTab(tab) {
    if (!tab) return;
    currentTab = tab;
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    renderClasses();
}

function updateTabCounts() {
    const createdTab = document.querySelector('[data-tab="created"]');
    const joinedTab  = document.querySelector('[data-tab="joined"]');
    const createdCount = classLoadState.created ? '…' : classroomsData.created.length;
    const joinedCount = classLoadState.joined ? '…' : classroomsData.joined.length;
    if (createdTab) createdTab.innerHTML = `My Classes <span class="tab-count">${createdCount}</span>`;
    if (joinedTab)  joinedTab.innerHTML  = `Joined Classes <span class="tab-count">${joinedCount}</span>`;
}

function renderClasses() {
    const container = document.getElementById('classroomGrid');
    if (!container) return;

    if (classLoadState[currentTab]) {
        container.innerHTML = `
            <div class="loading-message loading-state" aria-live="polite" aria-label="Loading classes">
                <span class="loading-spinner" aria-hidden="true"></span>
            </div>
        `;
        return;
    }

    const classes   = getFilteredClasses(classroomsData[currentTab] || []);
    const isCreated = currentTab === 'created';

    if (classes.length === 0) {
        const hasSearch = Boolean(classroomSearchTerm);
        const msg = hasSearch
            ? `No classes match "${classSearchInput?.value || ''}".`
            : isCreated
            ? 'No classes created yet. Create your first class to get started!'
            : "You haven't joined any classes yet.";
        container.innerHTML = `<p class="empty-message">${msg}</p>`;
        return;
    }

    container.innerHTML = classes.map(c => createClassCard(c, isCreated)).join('');
    attachClassCardHandlers();
}

function createClassCard(classroom, isCreated) {
    const studentCount    = classroom.studentCount  || classroom.students?.length || classroom.enrolledCount || classroom.memberCount || 0;
    const maxStudents     = resolveMaxStudents(classroom, 50);
    const classCode       = classroom.classCode     || classroom.code || classroom.inviteCode || classroom.id || 'N/A';
    const description     = classroom.description   || classroom.desc || 'No description provided';
    const hasPasscode     = !!(classroom.hasPasscode || classroom.requiresPasscode || classroom.passcode || classroom.isPasswordProtected);
    const requireApproval = !!(classroom.requireApproval || classroom.requiresApproval || classroom.needsApproval || classroom.manualApproval);
    const classId         = resolveClassroomId(classroom) || 'unknown';
    const className       = classroom.className || classroom.name || classroom.title || 'Unnamed Class';

    return `
        <div class="class-card" data-class-id="${escapeHtml(classId)}">
            <div class="class-card-header">
                <h4 class="class-name">${escapeHtml(className)}</h4>
                ${isCreated
                    ? '<span class="badge badge-owner">Owner</span>'
                    : '<span class="badge badge-member">Member</span>'}
            </div>
            <p class="class-description">${escapeHtml(description)}</p>
            <div class="class-info">
                <div class="info-item">
                    <i class="fas fa-users"></i>
                    <span>${studentCount} / ${maxStudents} students</span>
                </div>
                <div class="info-item">
                    <i class="fas fa-code"></i>
                    <span class="info-code-row">
                        <span>Code: <strong>${escapeHtml(String(classCode))}</strong></span>
                        <button
                            type="button"
                            class="copy-code-btn"
                            data-class-code="${escapeHtml(String(classCode))}"
                            aria-label="Copy class code"
                            title="Copy class code"
                        >
                            <i class="fas fa-copy"></i>
                        </button>
                    </span>
                </div>
            </div>
            ${hasPasscode || requireApproval ? `
                <div class="class-settings">
                    ${hasPasscode     ? '<span class="setting-badge"><i class="fas fa-lock"></i> Passcode</span>'        : ''}
                    ${requireApproval ? '<span class="setting-badge"><i class="fas fa-user-check"></i> Approval</span>' : ''}
                </div>` : ''}
            <div class="class-actions">
                <button class="btn btn-primary view-class" data-class-id="${escapeHtml(classId)}" data-role="${isCreated ? 'prof' : 'student'}" data-class-name="${escapeHtml(className)}" data-class-code="${escapeHtml(String(classCode))}">${isCreated ? '<i class="fa-solid fa-door-open"></i>Enter Class' : '<i class="fa-solid fa-door-open"></i>Enter Class'}</button>
                ${isCreated ? `<button class="btn btn-secondary manage-class" data-class-id="${escapeHtml(classId)}"><i class="fas fa-cog"></i>Manage</button>` : `<button class="btn btn-secondary leave-room" data-class-id="${escapeHtml(classId)}" data-class-name="${escapeHtml(className)}"><i class="fas fa-right-from-bracket"></i> Leave</button>`}
            </div>
        </div>
    `;
}

function attachClassCardHandlers() {
    document.querySelectorAll('.view-class').forEach(btn => {
        btn.addEventListener('click', e => {
            const classId   = e.currentTarget.dataset.classId;
            const role      = e.currentTarget.dataset.role;
            const className = e.currentTarget.dataset.className;
            const classCode = e.currentTarget.dataset.classCode;
            if (classId) viewClassroom(classId, role, className, classCode);
        });
    });
    document.querySelectorAll('.manage-class').forEach(btn => {
        btn.addEventListener('click', e => {
            const classId = e.currentTarget.dataset.classId;
            if (classId) manageClassroom(classId);
        });
    });
    document.querySelectorAll('.copy-code-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
            const classCode = e.currentTarget.dataset.classCode || '';
            try {
                const copied = await copyTextToClipboard(classCode);
                if (!copied) throw new Error('Copy failed');
                showNotification(`Class code copied: ${classCode}`, 'success');
            } catch {
                showNotification('Unable to copy class code.', 'error');
            }
        });
    });
    document.querySelectorAll('.leave-room').forEach(btn => {
        btn.addEventListener('click', e => {
            const classId   = e.currentTarget.dataset.classId;
            const className = e.currentTarget.dataset.className;
            if (classId) leaveJoinedClassroom(classId, className);
        });
    });
}


// ══════════════════════════════════════════════════════════════════════════════
// FIXED NAVIGATION TO PROFESSOR DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

function viewClassroom(classId, role, className, classCode) {
    if (classId && classId !== 'unknown') {
        const page = role === 'student' ? '/studentclass/' : '/profclass/';
        const nameParam = className ? `&name=${encodeURIComponent(className)}` : '';
        const codeParam = classCode ? `&code=${encodeURIComponent(classCode)}` : '';
        window.location.href = `${page}?id=${encodeURIComponent(classId)}${nameParam}${codeParam}`;

    } else {
        showNotification('Invalid classroom ID', 'error');
    }
}

function manageClassroom(classId) {
    if (classId && classId !== 'unknown') {
        openManageModal(classId);
    } else {
        showNotification('Invalid classroom ID', 'error');
    }
}

async function leaveJoinedClassroom(classId, className) {
    if (!classId || classId === 'unknown') {
        showNotification('Invalid classroom ID', 'error');
        return;
    }

    const roomName = className || 'this classroom';
    const confirmed = await window.AppDialog.confirm(
        `Leave ${roomName}? You will lose access to this room until you join again.`,
        {
            title: 'Leave Room',
            confirmText: 'Leave Room',
            danger: true
        }
    );

    if (!confirmed) return;

    try {
        const response = await apiRequest(`/classrooms/${encodeURIComponent(classId)}/leave`, {
            method: 'PUT',
            headers: {
                Accept: 'application/json'
            }
        }, {
            redirectOnUnauthorized: false
        });

        await window.AppDialog.alert('You have left the classroom.', {
            title: 'Room Left'
        });

        // Reload the dashboard to refresh the classes list
        await loadClasses();
        renderClasses();
    } catch (error) {
        console.error('Error leaving classroom:', error);
        await window.AppDialog.alert(error?.message || 'Failed to leave the classroom.', {
            title: 'Leave Failed',
            danger: true
        });
    }
}

async function openManageModal(classId) {
    currentManageClassId = classId;
    currentManageClassroomStatus = 'ACTIVE';
    updateCurrentStatusBadge('UNKNOWN');
    updateCloseStatusWarning('UNKNOWN');
    syncCloseStatusAction('UNKNOWN');

    const classroom = classroomsData.created.find(c => {
        const id = resolveClassroomId(c);
        return String(id) === String(classId);
    });

    const classNameEl = document.getElementById('manageClassName');
    if (classNameEl) classNameEl.textContent = classroom?.className || classroom?.name || 'Classroom';

    const nameEl    = document.getElementById('manageNameInput');
    const descEl    = document.getElementById('manageDescInput');
    const maxEl     = document.getElementById('manageMaxInput');

    if (classroom) {
        if (nameEl)  nameEl.value  = classroom.className   || classroom.name || '';
        if (descEl)  descEl.value  = classroom.description || '';
        if (maxEl)   maxEl.value   = resolveMaxStudents(classroom, 50);
    }

    if (classroom) {
        const classroomStatus = resolveClassroomStatus(classroom) || 'ACTIVE';
        currentManageClassroomStatus = classroomStatus;

        updateCurrentStatusBadge(classroomStatus);
        updateCloseStatusWarning(classroomStatus);
        syncCloseStatusAction(classroomStatus);
    }

    ['statTotalStudents', 'statTotalActivities', 'statActiveActivities'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:11px;color:#484f58"></i>';
    });

    openModal(manageModal);
    await fetchClassroomStats(classId);
}

async function fetchClassroomStats(classId) {
    try {
        if (!classId || classId === 'unknown') {
            throw new Error('Missing classroom ID for stats request');
        }
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!UUID_RE.test(classId)) {
            throw new Error(`Invalid classroom ID received: ${classId}`);
        }

        const encodedClassId = encodeURIComponent(classId);
        const statsUrl = `/classrooms/${encodedClassId}/stats`;
        console.debug('[stats] request', { classroomId: classId, url: statsUrl });

        const data = await apiRequest(statsUrl, { method: 'GET' });
        const stats = data?.data ?? data;

        const studentsEl   = document.getElementById('statTotalStudents');
        const activitiesEl = document.getElementById('statTotalActivities');
        const activeEl     = document.getElementById('statActiveActivities');

        if (studentsEl)   studentsEl.textContent   = stats?.totalStudents         ?? '0';
        if (activitiesEl) activitiesEl.textContent = stats?.totalActivities       ?? '0';
        if (activeEl)     activeEl.textContent     = stats?.totalActiveActivities ?? stats?.activeActivities ?? '0';

    } catch (error) {
        console.error('Error fetching classroom stats:', error);
        showNotification(error.message || 'Failed to load classroom stats', 'error');
        ['statTotalStudents', 'statTotalActivities', 'statActiveActivities'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '—';
        });
    }
}

async function handleUpdateClassroom() {
    const name        = document.getElementById('manageNameInput')?.value.trim()  || '';
    const description = document.getElementById('manageDescInput')?.value.trim()  || '';
    const maxStudents = parseInt(document.getElementById('manageMaxInput')?.value || '50');

    if (!name) return showNotification('Please enter a class name', 'error');
    if (name.length < 3 || name.length > 100) return showNotification('Class name must be 3–100 characters', 'error');
    if (!maxStudents || maxStudents < 1 || maxStudents > 100) return showNotification('Max students must be 1–100', 'error');

    const saveBtn = document.getElementById('saveManageBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }

    try {
        await apiRequest(`/classrooms/${encodeURIComponent(currentManageClassId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                description: description || null,
                maxStudents,
                status: (currentManageClassroomStatus || 'ACTIVE').toUpperCase()
            })
        });

        showNotification('Classroom updated!', 'success');
        closeModal(manageModal);
        await loadClasses();

    } catch (error) {
        console.error('Update classroom error:', error);
        showNotification(error.message || 'Update failed', 'error');
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-check"></i> Save Changes'; }
    }
}

async function handleUpdateStatus() {
    const sourceStatus = (currentManageClassroomStatus || 'ACTIVE').toUpperCase();

    if (sourceStatus === 'CLOSED' || sourceStatus === 'ARCHIVED') {
        return showNotification('Classroom is already closed.', 'info');
    }

    const confirmed = await window.AppDialog.confirm('Close this classroom? This is irreversible from the dashboard.', {
        title: 'Close Classroom',
        confirmText: 'Close Classroom',
        danger: true
    });
    if (!confirmed) return;

    const btn = document.getElementById('updateStatusBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; }

    try {
        const response = await apiRequest(`/classrooms/${encodeURIComponent(currentManageClassId)}/close`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });

        showNotification('Classroom closed successfully!', 'success');
        currentManageClassroomStatus = 'CLOSED';
        updateCurrentStatusBadge('CLOSED');
        updateCloseStatusWarning('CLOSED');
        syncCloseStatusAction('CLOSED');
        closeModal(manageModal);
        await loadClasses();

    } catch (error) {
        console.error('Close classroom error:', error);
        showNotification(error.message || 'Failed to close classroom', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-lock"></i> Close Classroom'; }
    }
}

async function handleDeleteClassroom() {
    if (!currentManageClassId || currentManageClassId === 'unknown') {
        showNotification('Invalid classroom ID', 'error');
        return;
    }

    const box = document.getElementById('deleteConfirmBox');
    if (box) box.classList.remove('visible');

    const deleteBtn = document.getElementById('confirmDeleteBtn');
    if (deleteBtn) { deleteBtn.disabled = true; deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...'; }

    try {
        if (classroomApi?.deleteClassroom) {
            await classroomApi.deleteClassroom(currentManageClassId);
        } else {
            await apiRequest(`/classrooms/${encodeURIComponent(currentManageClassId)}`, { method: 'DELETE' });
        }

        showNotification('Classroom deleted.', 'success');
        closeModal(manageModal);
        await loadClasses();

    } catch (error) {
        console.error('Delete classroom error:', error);
        showNotification(error.message || 'Delete failed', 'error');
    } finally {
        if (deleteBtn) { deleteBtn.disabled = false; deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Yes, delete permanently'; }
        const input = document.getElementById('deleteConfirmInput');
        if (input) { input.value = ''; input.classList.remove('match'); }
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn  { from { transform:translateX(400px);opacity:0 } to { transform:translateX(0);opacity:1 } }
    @keyframes slideOut { from { transform:translateX(0);opacity:1 } to { transform:translateX(400px);opacity:0 } }
`;
document.head.appendChild(style);