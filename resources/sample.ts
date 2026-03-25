import feather from "feather-icons";

feather.replace({ width: 16, height: 16 });

// Confirm delete
const delBtn = document.getElementById("delete-btn")!;
const delToolbar = document.getElementById("delete-toolbar")!;
const confirmToolbar = document.getElementById("confirm-toolbar")!;
const confirmNo = document.getElementById("confirm-no")!;
delBtn.addEventListener("click", () => {
    delToolbar.hidden = true;
    confirmToolbar.hidden = false;
});
confirmNo.addEventListener("click", () => {
    confirmToolbar.hidden = true;
    delToolbar.hidden = false;
});

// Toast
const toastEl = document.getElementById("toast")!;
function showToast(msg: string, style = "notify") {
    toastEl.textContent = msg;
    toastEl.className = "toast show " + style;
    setTimeout(() => toastEl.classList.remove("show"), 1500);
}
document.getElementById("save-btn")!.addEventListener("click", () => showToast("Saved", "notify"));

// Confirm delete toast
document.getElementById("confirm-yes")!.addEventListener("click", () => {
    confirmToolbar.hidden = true;
    delToolbar.hidden = false;
    showToast("Note deleted", "alert");
});

// Modal
const modal = document.getElementById("modal") as HTMLElement;
document.getElementById("new-btn")!.addEventListener("click", () => (modal.hidden = false));
document.getElementById("modal-cancel")!.addEventListener("click", () => (modal.hidden = true));
document.getElementById("modal-create")!.addEventListener("click", () => {
    modal.hidden = true;
    showToast("Note created", "notify");
});
modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.hidden = true;
});

// About modal
const aboutModal = document.getElementById("about-modal") as HTMLElement;
const aboutForm = document.getElementById("about-form") as HTMLFormElement;
const aboutActions = document.getElementById("about-actions") as HTMLElement;
const aboutConfirm = document.getElementById("about-confirm") as HTMLElement;

function closeAbout() {
    aboutModal.hidden = true;
    aboutConfirm.hidden = true;
    aboutActions.hidden = false;
}

document.getElementById("about-btn")!.addEventListener("click", () => {
    aboutModal.hidden = false;
    aboutForm.querySelector("input")?.focus();
});
aboutForm.addEventListener("submit", (e) => {
    e.preventDefault();
    closeAbout();
    showToast("Saved", "notify");
});
document.getElementById("about-cancel")!.addEventListener("click", closeAbout);
aboutModal.addEventListener("click", (e) => {
    if (e.target === aboutModal) closeAbout();
});
aboutModal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAbout();
});

// About: inline confirm delete
document.getElementById("about-delete")!.addEventListener("click", () => {
    aboutActions.hidden = true;
    aboutConfirm.hidden = false;
});
document.getElementById("about-confirm-no")!.addEventListener("click", () => {
    aboutConfirm.hidden = true;
    aboutActions.hidden = false;
});
document.getElementById("about-confirm-yes")!.addEventListener("click", () => {
    closeAbout();
    showToast("Note deleted", "alert");
});
