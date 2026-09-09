const INVITE = {
  weddingDate: "2026-09-24T19:00:00+03:00",
  // Katilim mesajlarinin gelecegi WhatsApp numarasi.
  // Ulke kodu ile, bosluksuz ve + isareti olmadan yazin. Ornek: "905321234567"
  whatsappNumber: "905537450744",
  photoUploadUrl:
    "https://drive.google.com/drive/folders/1O6YldP59B-Qid-7puYtfDL4yb4HbZoGg?usp=drive_link",
  // ?v=2: vercel.json bu dosyaya 1 yillik immutable cache veriyor. Dosyayi
  // degistirdigimizde eski ziyaretcinin tarayicisi eskisini sunmasin diye surum eki.
  musicUrl: "music.mp3?v=4",
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
const heroWelcome = document.querySelector(".hero-welcome");
const phoneShell = document.querySelector(".phone-shell");
const quickNav = document.querySelector(".quick-nav");
const countdownDone = document.getElementById("countdown-done");
const countdownLine = document.getElementById("countdown-line");
const countdown = document.querySelector(".countdown");
const countdownIds = {
  days: document.getElementById("count-days"),
  hours: document.getElementById("count-hours"),
  minutes: document.getElementById("count-minutes"),
  seconds: document.getElementById("count-seconds"),
};

// Linkteki ?ad= parametresi. Ornek: /?ad=Ayşe
// Yoksa bos string doner ve site varsayilan haliyle calisir.
function davetliAdi() {
  const ham = new URLSearchParams(window.location.search).get("ad");
  if (!ham) return "";

  // Disaridan gelen veri: sadece harf, bosluk, kesme ve tire birakiliyor.
  // Sayfaya her zaman textContent ile yaziliyor, HTML olarak asla degil.
  return ham
    .replace(/[^\p{L}\p{M}\s'’&.-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
}

const DAVETLI = davetliAdi();

function kisiselKarsilama() {
  if (!DAVETLI || !heroWelcome) return;
  heroWelcome.textContent = `${DAVETLI}, hikâyemizin en güzel gününe hoş geldiniz.`;
}

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
    // Yuzde degil piksel: CSS tarafinda transform ile suruluyor (iOS iz sorunu).
    // clientWidth her seferinde okunuyor, boylece ekran donunce de dogru kalir.
    musicProgress.style.setProperty("--progress-x", `${(ratio * musicProgress.clientWidth).toFixed(1)}px`);
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
  // Bu bir kullanici dokunusu, otomatik oynatma politikasi izin verir.
  // Reddedilirse playMusic sessizce kapali duruma duser; o durumda play
  // tusundaki nabiz atmaya devam eder ve kullaniciyi tusa yonlendirir.
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

// Geri sayim cumlesi. Metinleri degistirmek icin sadece burasi yeterli.
function countdownSentence(days) {
  if (days > 30) return "Geri sayım başladı. Takviminizde bize bir yer ayırın.";
  if (days > 15) return "Bir aydan az kaldı. Heyecan resmen başladı.";
  if (days > 7) return `${days} gün kaldı. Hazırlıklar tamam, eksik olan sizsiniz.`;
  if (days > 3) return "Son hafta. Bundan sonrası sadece beklemek.";
  if (days > 1) return `${days} gün. Çiçekler bile gergin.`;
  if (days === 1) return "Yarın! Bu gece kimse uyuyamayacak.";
  return "Bugün. Sizi kapıda bekliyoruz.";
}

function updateCountdown() {
  const target = new Date(INVITE.weddingDate).getTime();
  const now = Date.now();
  const remaining = Math.max(target - now, 0);

  if (remaining <= 0) {
    if (countdown) countdown.hidden = true;
    if (countdownLine) countdownLine.hidden = true;
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

  if (countdownLine) {
    // Saniyede bir yazmaya gerek yok; sadece cumle degisince dokun.
    const sentence = countdownSentence(days);
    if (countdownLine.textContent !== sentence) countdownLine.textContent = sentence;
  }
}

const KALP_SAYISI = 26;
const azHareket = window.matchMedia("(prefers-reduced-motion: reduce)");

// "Geliyorum"a dokununca ekrani dolduran kalpler. Katman body'ye eklenir:
// .phone-shell'in overflow:hidden'i icinde kalsa kirpilirdi.
function kalpPatlat(kaynak) {
  const katman = document.createElement("div");
  katman.className = "kalp-katmani";

  const kutu = kaynak.getBoundingClientRect();
  const merkezX = kutu.left + kutu.width / 2;
  const merkezY = kutu.top + kutu.height / 2;
  // Butondan ekranin tepesini asana kadar.
  const yol = merkezY + 90;
  const yayilma = Math.min(window.innerWidth * 0.92, 380);

  for (let i = 0; i < KALP_SAYISI; i++) {
    const kalp = document.createElement("span");
    kalp.className = "kalp";
    kalp.textContent = "♥";
    kalp.style.left = `${merkezX}px`;
    kalp.style.top = `${merkezY}px`;
    kalp.style.setProperty("--x", `${((Math.random() - 0.5) * yayilma).toFixed(0)}px`);
    kalp.style.setProperty("--y", `${(-yol * (0.72 + Math.random() * 0.42)).toFixed(0)}px`);
    kalp.style.setProperty("--gecikme", `${Math.round(Math.random() * 420)}ms`);
    kalp.style.setProperty("--olcek", (0.55 + Math.random() * 0.95).toFixed(2));
    kalp.style.setProperty("--donus", `${Math.round((Math.random() - 0.5) * 90)}deg`);
    katman.appendChild(kalp);
  }

  document.body.appendChild(katman);
  // En gec 420ms gecikme + 1.6s animasyon; artigi temizle.
  setTimeout(() => katman.remove(), 2400);
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
    // Mesajlar ": " ile bitiyor; isim varsa dogrudan arkasina ekleniyor.
    const message = (WHATSAPP_MESSAGES[key] || WHATSAPP_MESSAGES.maybe) + DAVETLI;

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

    // Sadece "Geliyorum": once kalpler ucsun, WhatsApp bir saniye sonra acilsin.
    // JS calismazsa link her halukarda normal davranir.
    if (key !== "yes") return;

    let bekleyen = 0;
    button.addEventListener("click", (event) => {
      // Hareket hassasiyeti aciksa animasyon yok, link dogrudan acilir.
      if (azHareket.matches) return;

      // Sabirsiz ikinci dokunus: beklemeyi iptal et, linki normal ac.
      if (bekleyen) {
        clearTimeout(bekleyen);
        bekleyen = 0;
        return;
      }

      event.preventDefault();
      kalpPatlat(button);

      bekleyen = setTimeout(() => {
        bekleyen = 0;
        // Gecikmeli window.open mobilde acilir pencere engeline takilabilir.
        // Engellenirse ayni sekmede aciyoruz; yonlendirme hicbir zaman engellenmez.
        const yeniSekme = window.open(button.href, "_blank");
        if (!yeniSekme) window.location.href = button.href;
      }, 1000);
    });
  });
}

kisiselKarsilama();
setupWhatsappRsvp();
setLink("maps-link", INVITE.mapsUrl, "Harita linki henüz eklenmedi.");
setLink("photo-link", INVITE.photoUploadUrl, "Fotoğraf yükleme linki henüz eklenmedi.");
setLink("photo-link-button", INVITE.photoUploadUrl, "Fotoğraf yükleme linki henüz eklenmedi.");

if (music && INVITE.musicUrl) {
  // Kaynagi burada bagliyoruz ki preload="metadata" isini yapabilsin:
  // sarkiyi indirmeden sadece basligi ceker ve gercek sure hemen gorunur.
  if (!music.getAttribute("src")) music.src = INVITE.musicUrl;

  if (musicToggle) {
    musicToggle.hidden = false;
    // Basilana kadar nabiz atar; dokunulabilir oldugu anlasilsin diye.
    musicToggle.classList.add("is-bekliyor");
  }
  setMusicState(false);
  renderMusicTime();

  // Toplam sure metadata gelince bilinir (audio preload="metadata").
  music.addEventListener("loadedmetadata", renderMusicTime);
  // loop acik oldugu icin sarki basa donunce currentTime sifirlanir; sayac da onunla sifirlanir.
  music.addEventListener("timeupdate", renderMusicTime);
  // Calma durumu baska bir sebeple degisirse de simge dogru kalsin.
  music.addEventListener("play", () => {
    setMusicState(true);
    // Kesfedildi: nabiz bir daha atmasin.
    musicToggle?.classList.remove("is-bekliyor");
  });
  music.addEventListener("pause", () => setMusicState(false));
  // Duraklatilmisken ekran donerse nokta yanlis yerde kalmasin.
  window.addEventListener("resize", renderMusicTime);
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
