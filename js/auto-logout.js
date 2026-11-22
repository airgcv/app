// ==========================================
// MODULE: AUTO-LOGOUT.JS (IDLE TIMEOUT)
// ==========================================

const IDLE_TIMEOUT_MENIT = 5; // Ubah durasi menit di sini (misal: 10, 15, atau 30)
const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MENIT * 60 * 1000;

let lastActivityTime = Date.now();
let lastThrottleTime = 0;

function isUserLoggedIn() {
  const rawSession = sessionStorage.getItem("user_session");
  if (!rawSession) return false;
  try {
    const parsed = JSON.parse(rawSession);
    return Boolean(parsed && (parsed.username || parsed.nama || parsed.role));
  } catch (e) {
    return false;
  }
}

function resetIdleTimer() {
  const now = Date.now();
  // Throttle 1 detik agar gerakan mouse/scroll tidak membebani browser
  if (now - lastThrottleTime < 1000) return;
  lastThrottleTime = now;
  lastActivityTime = now;
}

function eksekusiAutoLogout() {
  if (!isUserLoggedIn()) return;

  // Hapus sesi login & tandai alasan logout
  sessionStorage.removeItem("user_session");
  sessionStorage.setItem("auto_logout_notice", `Sesi berakhir otomatis karena tidak ada aktivitas selama ${IDLE_TIMEOUT_MENIT} menit.`);

  // Gunakan fungsi logout bawaan jika tersedia, atau reload halaman ke form login
  if (typeof handleLogout === "function") {
    handleLogout();
  } else if (typeof logout === "function") {
    logout();
  } else {
    window.location.reload();
  }
}

function cekIdleTimeout() {
  if (!isUserLoggedIn()) {
    lastActivityTime = Date.now();
    return;
  }

  if (Date.now() - lastActivityTime >= IDLE_TIMEOUT_MS) {
    eksekusiAutoLogout();
  }
}

// Daftarkan event aktivitas pengguna
["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"].forEach((evt) => {
  document.addEventListener(evt, resetIdleTimer, { passive: true });
});

// Cek setiap 5 detik & saat tab kembali dibuka
setInterval(cekIdleTimeout, 5000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) cekIdleTimeout();
});

// Tampilkan notifikasi setelah reload akibat auto logout
window.addEventListener("DOMContentLoaded", () => {
  const notice = sessionStorage.getItem("auto_logout_notice");
  if (notice) {
    sessionStorage.removeItem("auto_logout_notice");
    setTimeout(() => {
      if (typeof showToast === "function") {
        showToast(notice, "info");
      } else {
        alert(notice);
      }
    }, 400);
  }
});
