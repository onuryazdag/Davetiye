const INVITE = {
  weddingDate: "2026-09-24T19:00:00+03:00",
  // Katilim mesajlarinin gelecegi WhatsApp numarasi.
  // Ulke kodu ile, bosluksuz ve + isareti olmadan yazin. Ornek: "905321234567"
  whatsappNumber: "905537450744",
  // Hatice'nin numarasini ulke koduyla, bosluksuz ve + isareti olmadan buraya yazin.
  // Ornek: "905321234567"
  brideWhatsappNumber: "905541387152",
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
const ilerleme = document.getElementById("ilerleme");
const ilerlemeNotBaslik = document.querySelector(".ilerleme-not strong");
const ilerlemeNotMetin = document.querySelector(".ilerleme-not > span");
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
  // Kapak kalkmadan once konumu tepeye sabitle. Kullanici siteye daha once
  // girip asagi inmisse tarayici o yeri hatirliyor ve davetiye ortasindan
  // aciliyordu.
  basaSar();
  startScreen?.classList.add("is-hidden");
  setBackgroundInert(false);
  seridiBaslat();
  // Bu bir kullanici dokunusu, otomatik oynatma politikasi izin verir.
  // Reddedilirse playMusic sessizce kapali duruma duser; o durumda play
  // tusundaki nabiz atmaya devam eder ve kullaniciyi tusa yonlendirir.
  await playMusic();
}

// Tarayici sayfa yenilenince kaldigin yeri geri yukler (scrollRestoration).
// Davetiye her acilista kapak ekraniyla basladigi icin bu, "Davetiyeyi Ac"a
// basar basmaz sayfanin ortasindan baslamak demek oluyordu. Konumu biz
// yonetiyoruz.
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

function basaSar() {
  const kok = document.documentElement;
  const eskiDavranis = kok.style.scrollBehavior;
  // html'de scroll-behavior: smooth var; burada suzulme degil aninda tepe gerek.
  kok.style.scrollBehavior = "auto";
  window.scrollTo(0, 0);
  kok.style.scrollBehavior = eskiDavranis;
}

// --- Sag kenardaki ilerleme seridi --------------------------------------

// Kapak kalktiktan 2 saniye sonra, kaydirmayi acikca tarif eden ilk cagri gelir.
const CAGRI_GECIKMESI = 2000;
// Kullanici hala tepede ise iki saniye sonra bir kez daha yinelenir.
const CAGRI_TEKRAR_ARALIGI = 2000;
const CAGRI_SAYISI = 2;
// Her not, bir sonraki tekrardan once sakin sekilde kaybolur.
const CAGRI_SURESI = 1600;
// Ikinci cagridan bir saniye sonra turu kendimiz devam ettiririz.
const TUR_ANONSU_GECIKMESI =
  CAGRI_GECIKMESI + CAGRI_TEKRAR_ARALIGI + 1000;
const TUR_ANONSU_SURESI = 1000;
// "Bizimle olun" bolumunde bir kez daha yol gosterilir; sonra tarih bolumune gecilir.
const IKINCI_TUR_CAGRI_GECIKMESI = 4000;
const IKINCI_TUR_GECIS_GECIKMESI = 4000;
// Tarih ve sonraki bolumlerde sayfa kendi hareket etmez, yalnizca hatirlatir.
const DURAKLAMA_HATIRLATMA_GECIKMESI = 5000;
const OTOMATIK_GECIS_OTURMA_SURESI = 900;

let ilerlemeBekleyen = false;
let cagriZamanlayicilari = [];
let duraklamaHatirlatmaZamanlayicisi = 0;
let turAsamasi = "hero";
let otomatikGecisAktif = false;

function zamanlayiciEkle(islem, gecikme) {
  const zamanlayici = window.setTimeout(islem, gecikme);
  cagriZamanlayicilari.push(zamanlayici);
  return zamanlayici;
}

function duraklamaHatirlatmasiniKapat() {
  if (duraklamaHatirlatmaZamanlayicisi) {
    window.clearTimeout(duraklamaHatirlatmaZamanlayicisi);
    duraklamaHatirlatmaZamanlayicisi = 0;
  }
}

function cagrilariKapat() {
  cagriZamanlayicilari.forEach((zamanlayici) => window.clearTimeout(zamanlayici));
  cagriZamanlayicilari = [];
  duraklamaHatirlatmasiniKapat();
  ilerleme?.classList.remove("is-cagiriyor", "is-tur-anonsu");
}

function ilerlemeNotunuYaz(baslik, metin) {
  if (ilerlemeNotBaslik) ilerlemeNotBaslik.textContent = baslik;
  if (ilerlemeNotMetin) ilerlemeNotMetin.textContent = metin;
}

function kalpHatirlatmasiniGoster() {
  if (!ilerleme) return;
  ilerlemeNotunuYaz("Aşağı kaydır ↓", "Davetiyenin devamı aşağıda");
  // Sinif yeniden eklendiginde kalp animasyonunun her cagrida bastan oynamasi gerekir.
  ilerleme.classList.remove("is-cagiriyor", "is-tur-anonsu");
  void ilerleme.offsetWidth;
  ilerleme.classList.add("is-cagiriyor");
  zamanlayiciEkle(() => ilerleme.classList.remove("is-cagiriyor"), CAGRI_SURESI);
}

function cagriyiGoster() {
  if (turAsamasi !== "hero" || window.scrollY > 40) return;
  kalpHatirlatmasiniGoster();
}

function tarihVeyaSonrasindaMi() {
  const tarih = document.getElementById("tarih");
  return !!tarih && window.scrollY >= tarih.offsetTop - 80;
}

function duraklamaHatirlatmasiniPlanla() {
  duraklamaHatirlatmasiniKapat();
  if (turAsamasi !== "date") return;

  duraklamaHatirlatmaZamanlayicisi = window.setTimeout(() => {
    duraklamaHatirlatmaZamanlayicisi = 0;
    if (turAsamasi !== "date") return;

    kalpHatirlatmasiniGoster();
    // Kullanici hala ayni yerdeyse bes saniye sonra sadece bir kez daha hatirlat.
    duraklamaHatirlatmasiniPlanla();
  }, DURAKLAMA_HATIRLATMA_GECIKMESI);
}

function bolumeGec(id, sonrakiAsama) {
  if (!document.getElementById(id)) return;

  cagrilariKapat();
  turAsamasi = sonrakiAsama;
  otomatikGecisAktif = true;
  document.getElementById(id).scrollIntoView({ behavior: "smooth", block: "start" });

  zamanlayiciEkle(() => {
    otomatikGecisAktif = false;
    if (turAsamasi !== sonrakiAsama) return;

    if (sonrakiAsama === "intro") {
      zamanlayiciEkle(() => {
        if (turAsamasi === "intro" && !otomatikGecisAktif) kalpHatirlatmasiniGoster();
      }, IKINCI_TUR_CAGRI_GECIKMESI);
      zamanlayiciEkle(() => {
        if (turAsamasi === "intro" && !otomatikGecisAktif) bolumeGec("tarih", "date");
      }, IKINCI_TUR_CAGRI_GECIKMESI + IKINCI_TUR_GECIS_GECIKMESI);
    } else if (sonrakiAsama === "date") {
      duraklamaHatirlatmasiniPlanla();
    }
  }, OTOMATIK_GECIS_OTURMA_SURESI);
}

function davetiyeTuruneDevamEt() {
  if (turAsamasi !== "hero" || window.scrollY > 40 || !ilerleme) return;

  ilerlemeNotunuYaz("Biz sizin için", "davetiye turumuza devam ediyoruz");
  ilerleme.classList.remove("is-cagiriyor");
  void ilerleme.offsetWidth;
  ilerleme.classList.add("is-tur-anonsu");

  zamanlayiciEkle(() => {
    if (turAsamasi === "hero" && window.scrollY <= 40) bolumeGec("davet", "intro");
  }, TUR_ANONSU_SURESI);
}

function ilerlemeGuncelle() {
  ilerlemeBekleyen = false;
  if (!ilerleme) return;

  const en = document.documentElement.scrollHeight - window.innerHeight;
  const oran = en > 0 ? Math.min(Math.max(window.scrollY / en, 0), 1) : 0;
  ilerleme.style.setProperty("--oran", `${(oran * 100).toFixed(2)}%`);
}

function ilerlemeTetikle() {
  // Kullanici turu kendi kaydirarak devralirsa otomatik gecisler iptal edilir.
  if (!otomatikGecisAktif && window.scrollY > 40 && turAsamasi !== "date") {
    turAsamasi = tarihVeyaSonrasindaMi() ? "date" : "manuel";
    cagrilariKapat();
  }

  // Tarihe gelindikten sonra kaydirma sadece bes saniyelik hatirlatma saatini yeniler;
  // sayfa bir daha kendiliginden hareket etmez.
  if (turAsamasi === "date") {
    duraklamaHatirlatmasiniPlanla();
  }

  if (!ilerlemeBekleyen) {
    ilerlemeBekleyen = true;
    // Kare basina tek hesap: kaydirmanin akiciligi bozulmasin.
    requestAnimationFrame(ilerlemeGuncelle);
  }
}

function seridiBaslat() {
  if (!ilerleme) return;

  ilerlemeGuncelle();
  ilerleme.classList.add("is-acik");
  window.addEventListener("scroll", ilerlemeTetikle, { passive: true });
  window.addEventListener("resize", ilerlemeTetikle);

  for (let sira = 0; sira < CAGRI_SAYISI; sira++) {
    zamanlayiciEkle(cagriyiGoster, CAGRI_GECIKMESI + sira * CAGRI_TEKRAR_ARALIGI);
  }
  zamanlayiciEkle(davetiyeTuruneDevamEt, TUR_ANONSU_GECIKMESI);
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

const KALP_SAYISI = 48;
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
  const dialog = document.getElementById("recipient-dialog");
  const brideButton = document.getElementById("message-bride");
  const groomButton = document.getElementById("message-groom");
  const dialogNote = document.getElementById("recipient-dialog-note");
  if (!buttons.length || !dialog || !brideButton || !groomButton) return;

  const numarayiHazirla = (numara) => String(numara || "").replace(/\D/g, "");
  const damatNumarasi = numarayiHazirla(INVITE.whatsappNumber);
  const gelinNumarasi = numarayiHazirla(INVITE.brideWhatsappNumber);
  const numaraAyarliMi = (numara, kaynak) => numara && !String(kaynak || "").includes("X");
  const damatAyarli = numaraAyarliMi(damatNumarasi, INVITE.whatsappNumber);
  const gelinAyarli = numaraAyarliMi(gelinNumarasi, INVITE.brideWhatsappNumber);
  let seciliCevap = null;
  let kaynakButon = null;

  function whatsappAc(numara) {
    if (!seciliCevap || !numara) return;

    const url = `https://wa.me/${numara}?text=${encodeURIComponent(seciliCevap.mesaj)}`;
    const yonlendir = () => {
      const yeniSekme = window.open(url, "_blank");
      if (!yeniSekme) window.location.href = url;
    };

    dialog.close();
    if (seciliCevap.anahtar === "yes" && !azHareket.matches && kaynakButon) {
      kalpPatlat(kaynakButon);
      // Kalpler gorunsun; gecikmeli pencere engellenirse ayni sekmede acilir.
      window.setTimeout(yonlendir, 1000);
    } else {
      yonlendir();
    }
  }

  brideButton.addEventListener("click", () => whatsappAc(gelinNumarasi));
  groomButton.addEventListener("click", () => whatsappAc(damatNumarasi));

  buttons.forEach((button) => {
    const key = button.dataset.wa;
    // Mesajlar ": " ile bitiyor; isim varsa dogrudan arkasina ekleniyor.
    const message = (WHATSAPP_MESSAGES[key] || WHATSAPP_MESSAGES.maybe) + DAVETLI;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      seciliCevap = { anahtar: key, mesaj: message };
      kaynakButon = button;
      brideButton.disabled = !gelinAyarli;
      groomButton.disabled = !damatAyarli;
      if (dialogNote) {
        dialogNote.hidden = gelinAyarli;
        dialogNote.textContent = gelinAyarli ? "" : "Gelin için WhatsApp numarası henüz eklenmedi.";
      }
      dialog.showModal();
    });
  });
}

kisiselKarsilama();
setupWhatsappRsvp();
setLink("maps-link", INVITE.mapsUrl, "Harita linki henüz eklenmedi.");

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

  // Adres cubugunda onceki ziyaretten kalan #mekan gibi bir capa varsa
  // temizle: kalirsa alt menude ayni baglantiya dokunmak hicbir sey yapmaz
  // (hash zaten o). ?ad= parametresi korunuyor.
  if (window.location.hash) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  basaSar();

  // Gorseller yuklendikce tarayici konumu bir kez daha oynatabiliyor, o yuzden
  // load'da bir kez daha sabitliyoruz. Ama SADECE kapak hala ustteyse: yavas
  // baglantida kullanici davetiyeyi acip kaydirmaya baslamis olabilir ve gec
  // gelen load onu tepeye geri firlatmamali.
  window.addEventListener(
    "load",
    () => {
      if (!startScreen.classList.contains("is-hidden")) basaSar();
    },
    { once: true }
  );
}

setupScrollReveal();
updateCountdown();
setInterval(updateCountdown, 1000);
