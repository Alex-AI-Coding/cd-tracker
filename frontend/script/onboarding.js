const userApi = window.ApiClient?.user;

(async function guardInitializedUsers() {
  try {
    if (!window.ApiClient?.checkSessionState) return;

    const sessionState = await window.ApiClient.checkSessionState();
    if (sessionState.authenticated && sessionState.fullyInitialized) {
      window.location.replace("/dashboard/");
    }
  } catch (error) {
    console.warn("Onboarding auth check failed:", error);
  }
})();

const form = document.getElementById("regForm");
const submitBtn = document.getElementById("submitBtn");
const spinner = document.getElementById("spinner");
const alertEl = document.getElementById("alert");
const fileInput = document.getElementById("profileFile");
const uploadZone = document.getElementById("uploadZone");
const avatar = document.getElementById("avatar");
const uploadTitle = document.getElementById("uploadTitle");
const uploadHint = document.getElementById("uploadHint");
const uploadFname = document.getElementById("uploadFname");

const validators = {
  firstName: (value) => (value.trim() ? null : "First name is required"),
  lastName: (value) => (value.trim() ? null : "Last name is required"),
  gender: (value) => (value ? null : "Gender is required"),
};

function setFieldError(id, message) {
  const input = document.getElementById(id);
  const error = document.getElementById(`${id}Err`);

  input.classList.toggle("err", Boolean(message));
  error.classList.toggle("show", Boolean(message));
  error.textContent = message || "";
  return !message;
}

function validateField(id) {
  const input = document.getElementById(id);
  return setFieldError(id, validators[id](input.value));
}

function validateAll() {
  return Object.keys(validators).every(validateField);
}

Object.keys(validators).forEach((id) => {
  const input = document.getElementById(id);
  input.addEventListener("blur", () => validateField(id));
  input.addEventListener("input", () => validateField(id));
});

function showFileError(message) {
  uploadZone.classList.add("err");
  const error = document.getElementById("profileFileErr");
  error.textContent = message;
  error.classList.add("show");
}

function validateFile() {
  const file = fileInput.files[0];
  if (!file) return true;

  if (!file.type.startsWith("image/")) {
    showFileError("Choose an image file.");
    return false;
  }
  if (file.size > 5 * 1024 * 1024) {
    showFileError("Image must be 5 MB or smaller.");
    return false;
  }

  uploadZone.classList.remove("err");
  document.getElementById("profileFileErr").classList.remove("show");
  return true;
}

function updateFilePreview() {
  const file = fileInput.files[0];
  if (!file || !validateFile()) return;

  uploadFname.textContent = file.name;
  uploadFname.style.display = "block";
  uploadTitle.textContent = "Photo selected";
  uploadHint.style.display = "none";
  uploadZone.classList.add("has-file");

  const reader = new FileReader();
  reader.onload = (event) => {
    avatar.innerHTML = `<img src="${event.target.result}" alt="Profile preview">`;
  };
  reader.readAsDataURL(file);
}

fileInput.addEventListener("change", updateFilePreview);
uploadZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  uploadZone.classList.add("drag");
});
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("drag"));
uploadZone.addEventListener("drop", (event) => {
  event.preventDefault();
  uploadZone.classList.remove("drag");
  const file = event.dataTransfer.files[0];
  if (!file) return;
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
  updateFilePreview();
});

// Guards against a second /users/register firing while the post-success
// redirect timeout is still pending (double-click, Enter key, impatient
// re-click). Once true, it never resets to false unless the attempt
// actually failed.
let hasSubmitted = false;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (hasSubmitted) return;
  if (!validateAll() || !validateFile()) return;

  hasSubmitted = true;
  spinner.style.display = "inline-block";
  submitBtn.disabled = true;
  alertEl.className = "alert";

  try {
    if (!userApi) throw new Error("API client is not initialized.");

    const result = await userApi.register(
      {
        firstName: document.getElementById("firstName").value.trim(),
        lastName: document.getElementById("lastName").value.trim(),
        gender: document.getElementById("gender").value,
      },
      fileInput.files[0],
    );

    if (result) {
      showAlert("success", result.message || "Profile completed!");
      if (result.data) localStorage.setItem("userData", JSON.stringify(result.data));
      setTimeout(() => window.location.replace("/dashboard/"), 1200);
      return;
    }

    hasSubmitted = false;
    spinner.style.display = "none";
    submitBtn.disabled = false;
  } catch (error) {
    hasSubmitted = false; // only allow retry after a genuine failure
    showAlert("error", error.message || "Registration failed. Try again.");
    spinner.style.display = "none";
    submitBtn.disabled = false;
  }
});

function showAlert(type, message) {
  alertEl.textContent = message;
  alertEl.className = `alert ${type} show`;
  if (type === "error") setTimeout(() => alertEl.classList.remove("show"), 5000);
}