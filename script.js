const INVITE = {
  weddingDate: "2026-09-24T19:00:00+03:00",
  // Katilim mesajlarinin gelecegi WhatsApp numarasi.
  // Ulke kodu ile, bosluksuz ve + isareti olmadan yazin. Ornek: "905321234567"
  whatsappNumber: "905537450744",
  photoUploadUrl:
    "https://drive.google.com/drive/folders/1O6YldP59B-Qid-7puYtfDL4yb4HbZoGg?usp=drive_link",
  // ?v=2: vercel.json bu dosyaya 1 yillik immutable cache veriyor. Dosyayi
  // degistirdigimizde eski ziyaretcinin tarayicisi eskisini sunmasin diye surum eki.
  musicUrl: "music.mp3?v=2",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Atosev%20Sosyal%20Tesisleri",
};

const startScreen = document.getElementById("start-screen");
const startButton = document.getElementById("start-button");
const music = document.getElementById("bg-music");
const musicToggle = document.getElementById("music-toggle");
const musicToggleText = document.getElementById("music-toggle-text");
const musicPlaySymbol = document.querySelector(".play-symbol");
const musicProgress = document.getElementById("music-progress");
const musicElapsed = document.getElementById("music-elapsed");
const musicDuration = document.getElementById("music-duration");
const phoneShell = document.querySelector(".phone-shell");
const quickNav = document.querySelector(".quick-nav");
const countdownDone = document.getElementById("countdown-done");
const countdown = document.querySelector(".countdown");
const countdownIds = {
  days: document.getElementById("count-days"),
  hours: document.getElementById("count-hours"),
  minutes: document.getElementById("count-minutes"),
  seconds: document.getElementById("count-seconds"),
};

function setLink(id, url, fallbackText) {
  const link = document.getElementById(id);
  if (!link) return;

  if (url) {
    link.href = url;
    link.removeAttribute("aria-disabled");
    return;
  }

  link.href = "#";
  link.setAttribute("aria-disabled", "true");
  link.addEventListener("click", (event) => {
    event.preventDefault();
    alert(fallbackText);
  });
}

function setMusicState(isPlaying) {
  if (!musicToggle || !musicToggleText) return;

  musicToggle.setAttribute("aria-pressed", String(isPlaying));
  musicToggle.setAttribute("aria-label", isPlaying ? "Müziği kapat" : "Müziği aç");
  musicToggleText.textContent = isPlaying ? "Açık" : "Kapalı";
  if (musicPlaySymbol) {
    musicPlaySymbol.textContent = isPlaying ? "Ⅱ" : "▶";
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const total = Math.floor(seconds);
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const rest = String(total % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

let lastProgressRatio = 0;

// Gecen sure, toplam sure ve ilerleme noktasini sarkinin gercek durumuna gore ciz.
function renderMusicTime() {
  if (!music) return;

  const current = music.currentTime || 0;
  const total = music.duration;
  const hasTotal = Number.isFinite(total) && total > 0;

  if (musicElapsed) musicElapsed.textContent = formatTime(current);
  if (musicDuration) musicDuration.textContent = formatTime(total);
  if (musicProgress) {
    const ratio = hasTotal ? Math.min(current / total, 1) : 0;
    // Geriye sicrama (loop) yumusatilmaz, yoksa nokta bar boyunca geri suzulur.
    musicProgress.style.setProperty("--progress-ease", ratio < lastProgressRatio ? "0s" : "240ms");
    musicProgress.style.setProperty("--progress", `${(ratio * 100).toFixed(2)}%`);
    lastProgressRatio = ratio;
  }
}

// Kapak ekrani ustteyken arkadaki icerik Tab ile gezilmesin, ekran okuyucuya gitmesin.
function setBackgroundInert(isInert) {
  [phoneShell, quickNav].forEach((element) => {
    if (!element) return;
    if (isInert) element.setAttribute("inert", "");
    else element.removeAttribute("inert");
  });
}

async function playMusic() {
  if (!music || !INVITE.musicUrl) return false;

  try {
    if (!music.getAttribute("src")) {
      music.src = INVITE.musicUrl;
    }
    await music.play();
    setMusicState(true);
    return true;
  } catch (error) {
    setMusicState(false);
    return false;
  }
}

async function openInvitation() {
  startScreen?.classList.add("is-hidden");
  setBackgroundInert(false);
  // Bu bir kullanici dokunusu, o yuzden otomatik oynatma politikasi izin verir.
  // Yine de reddedilebilir (iOS dusuk guc modu vb.); playMusic sessizce kapali duruma duser.
  await playMusic();
}

function setupScrollReveal() {
  const revealElements = document.querySelectorAll(".reveal-section, .reveal-item");

  if (!("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.14,
    }
  );

  revealElements.forEach((element) => observer.observe(element));
}

function updateCountdown() {
  const target = new Date(INVITE.weddingDate).getTime();
  const now = Date.now();
  const remaining = Math.max(target - now, 0);

  if (remaining <= 0) {
    if (countdown) countdown.hidden = true;
    if (countdownDone) countdownDone.hidden = false;
    Object.values(countdownIds).forEach((node) => {
      if (node) node.textContent = "0";
    });
    return;
  }

  const seconds = Math.floor(remaining / 1000) % 60;
  const minutes = Math.floor(remaining / (1000 * 60)) % 60;
  const hours = Math.floor(remaining / (1000 * 60 * 60)) % 24;
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));

  countdownIds.days.textContent = days;
  countdownIds.hours.textContent = hours;
  countdownIds.minutes.textContent = minutes;
  countdownIds.seconds.textContent = seconds;
}

const WHATSAPP_MESSAGES = {
  yes: "Merhaba! 24 Eylül'e başka plan yapmadık, geliyoruz. Gelenler: ",
  no: "Merhaba! Ne yazık ki o gün aranızda olamayacağım ama kalbim sizinle, en güzel gününüz olsun. Adım: ",
  maybe: "Merhaba! Henüz takvimle pazarlık halindeyim, netleşir netleşmez haber vereceğim. Adım: ",
};

function setupWhatsappRsvp() {
  const buttons = document.querySelectorAll(".rsvp-choice");
  if (!buttons.length) return;

  const number = (INVITE.whatsappNumber || "").replace(/\D/g, "");
  const isConfigured = number && !INVITE.whatsappNumber.includes("X");

  buttons.forEach((button) => {
    const key = button.dataset.wa;
    const message = WHATSAPP_MESSAGES[key] || WHATSAPP_MESSAGES.maybe;

    if (!isConfigured) {
      button.href = "#";
      button.setAttribute("aria-disabled", "true");
      button.addEventListener("click", (event) => {
        event.preventDefault();
        alert("WhatsApp numarası henüz eklenmedi.");
      });
      return;
    }

    button.href = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
    button.target = "_blank";
    button.rel = "noreferrer";
  });
}

setupWhatsappRsvp();
setLink("maps-link", INVITE.mapsUrl, "Harita linki henüz eklenmedi.");
setLink("photo-link", INVITE.photoUploadUrl, "Fotoğraf yükleme linki henüz eklenmedi.");
setLink("photo-link-button", INVITE.photoUploadUrl, "Fotoğraf yükleme linki henüz eklenmedi.");

if (music && INVITE.musicUrl) {
  if (musicToggle) musicToggle.hidden = false;
  setMusicState(false);
  renderMusicTime();

  // Toplam sure ancak metadata yuklenince bilinir (preload="none").
  music.addEventListener("loadedmetadata", renderMusicTime);
  // loop acik oldugu icin sarki basa donunce currentTime sifirlanir; sayac da onunla sifirlanir.
  music.addEventListener("timeupdate", renderMusicTime);
  // Calma durumu baska bir sebeple degisirse de simge dogru kalsin.
  music.addEventListener("play", () => setMusicState(true));
  music.addEventListener("pause", () => setMusicState(false));
}

startButton?.addEventListener("click", openInvitation);

musicToggle?.addEventListener("click", async () => {
  if (!music || !INVITE.musicUrl) return;

  if (music.paused) {
    await playMusic();
  } else {
    music.pause();
    setMusicState(false);
  }
});

if (startScreen && !startScreen.classList.contains("is-hidden")) {
  setBackgroundInert(true);
}

setupScrollReveal();
updateCountdown();
setInterval(updateCountdown, 1000);
