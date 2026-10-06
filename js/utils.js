/* ============================================================
   utils.js — UTILITAS UMUM
   escapeHtml, toast, download file, accordion, statistik.
   Tidak bergantung pada modul lain kecuali state (runtime).
   ============================================================ */

function escapeHtml(str) {
  // FIX: coerce to string first. Imported JSON/Excel cells can be numbers
  // (e.g., a numeric "Keterangan" column) — `(123 || '').replace` threw
  // "replace is not a function" and crashed the whole table render.
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.setAttribute('role', 'status');
  const icon = type === 'success' ? '<i class="fas fa-check-circle"></i>' :
               type === 'error' ? '<i class="fas fa-exclamation-circle"></i>' :
               type === 'warning' ? '<i class="fas fa-exclamation-triangle"></i>' :
               '<i class="fas fa-info-circle"></i>';
  // FIX: escape the message — file names and user data flow into toasts,
  // so raw innerHTML injection could break markup (or inject HTML).
  toast.innerHTML = `${icon}<span>${escapeHtml(String(message))}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.4s ease reverse';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // FIX: revoke asynchronously — revoking synchronously right after
  // click() can abort the download in Safari/Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================
// ACCORDION TOGGLE
// ============================================
function toggleAccordion(header) {
  header.classList.toggle('active');
  header.setAttribute('aria-expanded', header.classList.contains('active') ? 'true' : 'false');
  const content = header.nextElementSibling;
  if (content.style.display === 'none') {
    content.style.display = 'block';
    content.style.animation = 'fadeIn 0.3s ease';
  } else {
    content.style.display = 'none';
  }
}

// ============================================
// STATS HELPERS (kept consistent between the "Proses" flow and
// the automatic structured-table import flow — both accumulate).
// ============================================
function addToStats({ accepted = 0, fixed = 0, duplicate = 0, trash = 0 }) {
  const accEl = document.getElementById('statAccepted');
  const fixedEl = document.getElementById('statFixed');
  const dupEl = document.getElementById('statDuplicate');
  const trashEl = document.getElementById('statTrash');
  accEl.textContent = (parseInt(accEl.textContent, 10) || 0) + accepted;
  fixedEl.textContent = (parseInt(fixedEl.textContent, 10) || 0) + fixed;
  dupEl.textContent = (parseInt(dupEl.textContent, 10) || 0) + duplicate;
  trashEl.textContent = (parseInt(trashEl.textContent, 10) || 0) + trash;
}

// ============================================
// RESET STATISTIK
// ============================================
function resetStats() {
  ['statAccepted', 'statFixed', 'statDuplicate', 'statTrash'].forEach(id => {
    document.getElementById(id).textContent = '0';
  });
  showToast('Statistik direset', 'success');
}
