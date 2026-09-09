const INVITE = {
  weddingDate: "2026-09-24T19:00:00+03:00",
  rsvpUrl: "",
  photoUploadUrl:
    "https://drive.google.com/drive/folders/1O6YldP59B-Qid-7puYtfDL4yb4HbZoGg?usp=drive_link",
  musicUrl: "music.mp3",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Atosev%20Sosyal%20Tesisleri",
};

const startScreen = document.getElementById("start-screen");
const startButton = document.getElementById("start-button");
const music = document.getElementById("bg-music");
const musicToggle = document.getElementById("music-toggle");
const musicToggleText = document.getElementById("music-toggle-text");
const musicPlaySymbol = document.querySelector(".play-symbol");
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

function openInvitation() {
  startScreen?.classList.add("is-hidden");
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

  const seconds = Math.floor(remaining / 1000) % 60;
  const minutes = Math.floor(remaining / (1000 * 60)) % 60;
  const hours = Math.floor(remaining / (1000 * 60 * 60)) % 24;
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));

  countdownIds.days.textContent = days;
  countdownIds.hours.textContent = hours;
  countdownIds.minutes.textContent = minutes;
  countdownIds.seconds.textContent = seconds;
}

setLink("maps-link", INVITE.mapsUrl, "Harita linki henüz eklenmedi.");
setLink("photo-link", INVITE.photoUploadUrl, "Fotoğraf yükleme linki henüz eklenmedi.");
setLink("photo-link-button", INVITE.photoUploadUrl, "Fotoğraf yükleme linki henüz eklenmedi.");

if (music && INVITE.musicUrl) {
  musicToggle.hidden = false;
  setMusicState(false);
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

music?.addEventListener("ended", () => setMusicState(false));

setupScrollReveal();
updateCountdown();
setInterval(updateCountdown, 1000);
