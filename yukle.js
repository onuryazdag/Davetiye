/**
 * Fotograf & video yukleme ekrani.
 *
 * Akis:
 *   1. Kullanici native secici ile dosya secer
 *   2. Her dosya istemcide dogrulanir (tur + boyut)
 *   3. Uygun fotograflar tarayicida kucultulur (video'ya dokunulmaz)
 *   4. Sirayla, en fazla 3 es zamanli:
 *        POST /api/presign  ->  imzali URL
 *        PUT  <imzali URL>  ->  dogrudan R2'ye (dosya bizim sunucumuzdan GECMEZ)
 *
 * Bir dosyanin hatasi digerlerini durdurmaz. Basarili dosya tekrar yuklenmez.
 */

(function () {
  "use strict";

  /* ---------------------------------------------------------------- *
   * Ayarlar - sunucudaki api/_r2.js CONFIG ile ayni olmali
   * ---------------------------------------------------------------- */
  const AYAR = {
    MAKS_FOTO_BAYT: 25 * 1024 * 1024,
    MAKS_VIDEO_BAYT: 500 * 1024 * 1024,

    ES_ZAMANLI: 3, // ayni anda kac dosya yuklensin

    // Fotograf kucultme
    UZUN_KENAR: 2800, // px
    KALITE: 0.86,
    KUCULTME_ESIGI: 1.5 * 1024 * 1024, // bundan kucuk fotografa dokunma
    KUCULTULEBILIR: ["image/jpeg", "image/pjpeg", "image/webp"],

    PRESIGN_YOLU: "/api/presign",
  };

  // Sunucudaki YASAKLI_UZANTILAR ile ayni mantik. Sunucu zaten reddediyor;
  // buradaki amac kullaniciya hatayi ag istegi beklemeden gostermek.
  const YASAKLI_UZANTI =
    /^(exe|com|bat|cmd|msi|scr|dll|app|apk|deb|dmg|sh|bash|ps1|vbs|jar|bin|html?|xhtml|m?js|cjs|php|aspx?|jsp|svg|xml|swf|zip|rar|7z|tar|gz|bz2|iso|pdf|docx?|xlsx?|pptx?)$/;

  const DURUM = {
    BEKLIYOR: "Bekliyor",
    HAZIRLANIYOR: "Hazırlanıyor",
    YUKLENIYOR: "Yükleniyor",
    TAMAM: "Tamamlandı",
    HATA: "Hata",
    GECERSIZ: "Yüklenemez",
  };

  /* ---------------------------------------------------------------- *
   * Eleman referanslari
   * ---------------------------------------------------------------- */
  const secici = document.getElementById("dosya-secici");
  const secButonu = document.getElementById("sec-butonu");
  const yukleButonu = document.getElementById("yukle-butonu");
  const tekrarButonu = document.getElementById("tekrar-butonu");
  const eylemler = document.getElementById("eylemler");
  const ozet = document.getElementById("ozet");
  const liste = document.getElementById("liste");
  const anaEkran = document.getElementById("yukle-ana");
  const bittiEkran = document.getElementById("yukle-bitti");
  const bittiOzet = document.getElementById("bitti-ozet");
  const dahaEkle = document.getElementById("daha-ekle");

  if (!secici || !secButonu) return;

  /** @type {Array<Object>} tum secilen dosyalar */
  const kuyruk = [];
  let sonrakiId = 1;
  let calisiyor = false;

  /* ---------------------------------------------------------------- *
   * Yardimcilar
   * ---------------------------------------------------------------- */

  function baytOku(bayt) {
    if (bayt >= 1024 * 1024) return (bayt / (1024 * 1024)).toFixed(1) + " MB";
    return Math.max(1, Math.round(bayt / 1024)) + " KB";
  }

  function videoMu(tur) {
    return String(tur || "").toLowerCase().startsWith("video/");
  }

  /** Gecersiz dosyaya "Fotograf" demeyelim; sadece taniyabildigimize tur adi veriyoruz. */
  function turEtiketi(dosya) {
    const tur = String(dosya.type || "").toLowerCase();
    if (tur.startsWith("video/")) return "Video";
    if (tur.startsWith("image/")) return "Fotoğraf";
    const uzanti = (dosya.name.split(".").pop() || "").toLowerCase();
    if (/^(mp4|mov|webm|3gp|m4v|mpe?g)$/.test(uzanti)) return "Video";
    if (/^(jpe?g|png|webp|gif|heic|heif)$/.test(uzanti)) return "Fotoğraf";
    return "Dosya";
  }

  /** Ekrana yazilan her sey textContent ile yazilir; dosya adi kullanici verisidir. */
  function kisaAd(ad) {
    const temiz = String(ad || "dosya");
    if (temiz.length <= 34) return temiz;
    return temiz.slice(0, 20) + "…" + temiz.slice(-11);
  }

  /**
   * Istemci tarafi on dogrulama. Sunucu ayrica dogruluyor; buradaki amac
   * kullaniciya hatayi ag istegi beklemeden soylemek.
   */
  function dosyayiDogrula(dosya) {
    const tur = String(dosya.type || "").toLowerCase();
    const video = videoMu(tur);
    const resim = tur.startsWith("image/");

    // Bazi Android galerileri turu bos/octet-stream verir; uzantiya bakariz.
    const uzanti = (dosya.name.split(".").pop() || "").toLowerCase();
    const medyaUzantisi = /^(jpe?g|png|webp|gif|heic|heif|mp4|mov|webm|3gp|m4v|mpe?g)$/.test(uzanti);

    // Tehlikeli uzanti: bildirilen tur ne olursa olsun reddedilir.
    if (uzanti && YASAKLI_UZANTI.test(uzanti)) {
      return "Bu dosya türü desteklenmiyor.";
    }
    if (!video && !resim && !medyaUzantisi) {
      return "Sadece fotoğraf ve video yükleyebilirsiniz.";
    }
    if (tur === "image/svg+xml") {
      return "Bu dosya türü desteklenmiyor.";
    }

    const sinir = video || /^(mp4|mov|webm|3gp|m4v|mpe?g)$/.test(uzanti)
      ? AYAR.MAKS_VIDEO_BAYT
      : AYAR.MAKS_FOTO_BAYT;

    if (dosya.size > sinir) {
      return sinir === AYAR.MAKS_VIDEO_BAYT
        ? "Video çok büyük (en fazla 500 MB)."
        : "Fotoğraf çok büyük (en fazla 25 MB).";
    }
    if (dosya.size === 0) {
      return "Dosya boş görünüyor.";
    }
    return null;
  }

  /* ---------------------------------------------------------------- *
   * Fotograf kucultme
   * ---------------------------------------------------------------- *
   * Sadece JPEG/WebP kucultulur. HEIC/HEIF'e DOKUNULMAZ: cogu tarayici
   * cozemez, cozebilenlerde de JPEG'e cevirmek dosyayi buyutur.
   * GIF'e dokunulmaz (animasyon kaybolur). PNG'ye dokunulmaz (saydamlik).
   *
   * Yon (EXIF orientation): <img> elemani modern tarayicilarda EXIF yonunu
   * kendisi uygular, canvas'a o haliyle cizilir. createImageBitmap yerine
   * bilerek <img> kullaniliyor.
   */
  function kucultulebilirMi(dosya) {
    return (
      AYAR.KUCULTULEBILIR.indexOf(String(dosya.type).toLowerCase()) !== -1 &&
      dosya.size > AYAR.KUCULTME_ESIGI &&
      typeof HTMLCanvasElement !== "undefined"
    );
  }

  function gorseliYukle(dosya) {
    return new Promise(function (cozumle, reddet) {
      const url = URL.createObjectURL(dosya);
      const img = new Image();
      img.onload = function () {
        cozumle({ img: img, serbest: function () { URL.revokeObjectURL(url); } });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reddet(new Error("cozulemedi"));
      };
      img.src = url;
    });
  }

  function canvasBlob(canvas, tur, kalite) {
    return new Promise(function (cozumle) {
      if (canvas.toBlob) canvas.toBlob(cozumle, tur, kalite);
      else cozumle(null);
    });
  }

  /**
   * Basarisiz olursa ORIJINALI doner - kucultme asla yuklemeyi engellemez.
   */
  async function fotografiKucult(dosya) {
    if (!kucultulebilirMi(dosya)) return dosya;

    let yuklenen;
    try {
      yuklenen = await gorseliYukle(dosya);
    } catch (e) {
      return dosya; // cozulemedi (ornegin HEIC) -> orijinal
    }

    try {
      const img = yuklenen.img;
      const uzun = Math.max(img.naturalWidth, img.naturalHeight);
      if (!uzun) return dosya;

      const olcek = uzun > AYAR.UZUN_KENAR ? AYAR.UZUN_KENAR / uzun : 1;
      const g = Math.round(img.naturalWidth * olcek);
      const y = Math.round(img.naturalHeight * olcek);
      if (!g || !y) return dosya;

      const canvas = document.createElement("canvas");
      canvas.width = g;
      canvas.height = y;
      const ctx = canvas.getContext("2d");
      if (!ctx) return dosya;
      ctx.drawImage(img, 0, 0, g, y);

      const hedefTur = String(dosya.type).toLowerCase() === "image/webp" ? "image/webp" : "image/jpeg";
      const blob = await canvasBlob(canvas, hedefTur, AYAR.KALITE);

      // Kucultme ise yaramadiysa orijinali gonder.
      if (!blob || blob.size >= dosya.size) return dosya;

      const yeniAd = dosya.name.replace(/\.[^.]+$/, "") + (hedefTur === "image/webp" ? ".webp" : ".jpg");
      return new File([blob], yeniAd, { type: hedefTur, lastModified: dosya.lastModified || Date.now() });
    } catch (e) {
      return dosya;
    } finally {
      yuklenen.serbest();
    }
  }

  /* ---------------------------------------------------------------- *
   * Arayuz
   * ---------------------------------------------------------------- */

  function satirOlustur(kayit) {
    const li = document.createElement("li");
    li.className = "yukle-satir";
    li.dataset.id = String(kayit.id);

    const bilgi = document.createElement("div");
    bilgi.className = "yukle-satir-bilgi";

    const ad = document.createElement("span");
    ad.className = "yukle-ad";
    ad.textContent = kisaAd(kayit.dosya.name);

    const tur = document.createElement("span");
    tur.className = "yukle-tur";
    tur.textContent = turEtiketi(kayit.dosya) + " · " + baytOku(kayit.dosya.size);

    bilgi.append(ad, tur);

    const durum = document.createElement("span");
    durum.className = "yukle-durum";

    const cubuk = document.createElement("span");
    cubuk.className = "yukle-cubuk";
    const dolgu = document.createElement("span");
    dolgu.className = "yukle-dolgu";
    cubuk.appendChild(dolgu);

    li.append(bilgi, durum, cubuk);
    kayit.el = { li: li, durum: durum, dolgu: dolgu, cubuk: cubuk };
    return li;
  }

  function satiriGuncelle(kayit) {
    if (!kayit.el) return;
    const { li, durum, dolgu, cubuk } = kayit.el;

    li.dataset.durum = kayit.durum;
    // Durum yalnizca renkle degil, metinle de anlatiliyor.
    durum.textContent = kayit.hata ? kayit.hata : kayit.durum;

    const yuzdeGoster = kayit.durum === DURUM.YUKLENIYOR;
    cubuk.hidden = !yuzdeGoster;
    dolgu.style.width = (kayit.yuzde || 0) + "%";

    if (yuzdeGoster) {
      li.setAttribute("aria-busy", "true");
      durum.textContent = DURUM.YUKLENIYOR + " %" + Math.round(kayit.yuzde || 0);
    } else {
      li.removeAttribute("aria-busy");
    }
  }

  function ozetiGuncelle() {
    const toplam = kuyruk.length;
    if (!toplam) {
      ozet.textContent = "";
      eylemler.hidden = true;
      return;
    }
    const tamam = kuyruk.filter((k) => k.durum === DURUM.TAMAM).length;
    const hatali = kuyruk.filter((k) => k.durum === DURUM.HATA).length;
    const gecersiz = kuyruk.filter((k) => k.durum === DURUM.GECERSIZ).length;
    const yuklenebilir = kuyruk.filter((k) => k.durum !== DURUM.GECERSIZ).length;

    const parcalar = [toplam + " dosya seçildi"];
    if (gecersiz) parcalar.push(gecersiz + " tanesi yüklenemez");
    if (tamam) parcalar.push(tamam + " tamamlandı");
    if (hatali) parcalar.push(hatali + " hata");
    ozet.textContent = parcalar.join(" · ");

    eylemler.hidden = false;
    // Yukleme surerken buton GORUNUR ama devre disi: kullanici ne oldugunu gorsun.
    yukleButonu.hidden = !calisiyor && (yuklenebilir === 0 || !bekleyenVarMi());
    yukleButonu.disabled = calisiyor;
    yukleButonu.textContent = calisiyor ? "Yükleniyor…" : "Yüklemeyi Başlat";
    tekrarButonu.hidden = calisiyor || hatali === 0;
    secButonu.disabled = calisiyor;
  }

  function bekleyenVarMi() {
    return kuyruk.some((k) => k.durum === DURUM.BEKLIYOR);
  }

  function bittiMi() {
    const yuklenebilir = kuyruk.filter((k) => k.durum !== DURUM.GECERSIZ);
    return (
      yuklenebilir.length > 0 &&
      yuklenebilir.every((k) => k.durum === DURUM.TAMAM)
    );
  }

  function bittiEkraniniGoster() {
    const tamam = kuyruk.filter((k) => k.durum === DURUM.TAMAM).length;
    bittiOzet.textContent = tamam + " dosya yüklendi.";
    anaEkran.hidden = true;
    bittiEkran.hidden = false;
    bittiEkran.focus?.();
  }

  /* ---------------------------------------------------------------- *
   * Yukleme
   * ---------------------------------------------------------------- */

  async function imzaAl(dosya) {
    let yanit;
    try {
      yanit = await fetch(AYAR.PRESIGN_YOLU, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: dosya.name,
          contentType: dosya.type || "",
          size: dosya.size,
        }),
      });
    } catch (e) {
      throw new Error("İnternet bağlantısı kesildi.");
    }

    let govde = null;
    try {
      govde = await yanit.json();
    } catch (e) {
      /* yoksay */
    }

    if (!yanit.ok) {
      throw new Error((govde && govde.hata) || "Yükleme adresi alınamadı.");
    }
    if (!govde || !govde.url) {
      throw new Error("Yükleme adresi alınamadı.");
    }
    return govde;
  }

  /** XHR kullaniliyor cunku fetch yukleme ilerlemesi vermiyor. */
  function r2yeYukle(url, dosya, contentType, ilerleme) {
    return new Promise(function (cozumle, reddet) {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url, true);
      // Imza content-type'i de kapsiyor; birebir ayni gonderilmeli.
      xhr.setRequestHeader("Content-Type", contentType);

      xhr.upload.onprogress = function (olay) {
        if (olay.lengthComputable && ilerleme) {
          ilerleme((olay.loaded / olay.total) * 100);
        }
      };
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) cozumle();
        else if (xhr.status === 403) reddet(new Error("Yükleme izni doldu, tekrar deneyin."));
        else reddet(new Error("Yükleme tamamlanamadı (" + xhr.status + ")."));
      };
      xhr.onerror = function () {
        reddet(new Error("İnternet bağlantısı kesildi."));
      };
      xhr.onabort = function () {
        reddet(new Error("Yükleme durduruldu."));
      };
      xhr.send(dosya);
    });
  }

  async function kaydiYukle(kayit) {
    kayit.hata = "";
    kayit.yuzde = 0;

    try {
      // Kucultme yuklemeden HEMEN once yapilir: imza nihai tur ve boyutla atilir.
      if (!kayit.hazirlandi) {
        kayit.durum = DURUM.HAZIRLANIYOR;
        satiriGuncelle(kayit);
        kayit.gonderilecek = await fotografiKucult(kayit.dosya);
        kayit.hazirlandi = true;
      }

      const gonderilecek = kayit.gonderilecek || kayit.dosya;

      kayit.durum = DURUM.YUKLENIYOR;
      satiriGuncelle(kayit);

      // Imza dosya yuklemeden hemen once alinir; boylece kuyrukta beklerken eskimez.
      const imza = await imzaAl(gonderilecek);

      await r2yeYukle(imza.url, gonderilecek, imza.contentType, function (yuzde) {
        kayit.yuzde = yuzde;
        satiriGuncelle(kayit);
      });

      kayit.durum = DURUM.TAMAM;
      kayit.yuzde = 100;
      kayit.anahtar = imza.key;
    } catch (e) {
      kayit.durum = DURUM.HATA;
      kayit.hata = (e && e.message) || "Bilinmeyen hata.";
    }

    satiriGuncelle(kayit);
    ozetiGuncelle();
  }

  /** Es zamanli en fazla AYAR.ES_ZAMANLI dosya; digerleri sirada bekler. */
  async function kuyrugaBasla() {
    if (calisiyor) return; // cift tiklama korumasi
    calisiyor = true;
    ozetiGuncelle();

    const sira = kuyruk.filter((k) => k.durum === DURUM.BEKLIYOR);
    let indeks = 0;

    async function isci() {
      while (indeks < sira.length) {
        const kayit = sira[indeks++];
        await kaydiYukle(kayit);
      }
    }

    const isciler = [];
    for (let i = 0; i < Math.min(AYAR.ES_ZAMANLI, sira.length); i++) isciler.push(isci());
    await Promise.all(isciler);

    calisiyor = false;
    ozetiGuncelle();
    if (bittiMi()) bittiEkraniniGoster();
  }

  /* ---------------------------------------------------------------- *
   * Olaylar
   * ---------------------------------------------------------------- */

  function dosyalariEkle(dosyalar) {
    const parca = document.createDocumentFragment();

    Array.prototype.forEach.call(dosyalar, function (dosya) {
      const sorun = dosyayiDogrula(dosya);
      const kayit = {
        id: sonrakiId++,
        dosya: dosya,
        durum: sorun ? DURUM.GECERSIZ : DURUM.BEKLIYOR,
        hata: sorun || "",
        yuzde: 0,
        hazirlandi: false,
      };
      kuyruk.push(kayit);
      parca.appendChild(satirOlustur(kayit));
      satiriGuncelle(kayit);
    });

    liste.appendChild(parca);
    ozetiGuncelle();
  }

  secButonu.addEventListener("click", function () {
    if (calisiyor) return;
    secici.click();
  });

  secici.addEventListener("change", function () {
    if (!secici.files || !secici.files.length) return;
    dosyalariEkle(secici.files);
    // Ayni dosya tekrar secilebilsin diye sifirla.
    secici.value = "";
  });

  yukleButonu.addEventListener("click", function () {
    if (calisiyor) return;
    kuyrugaBasla();
  });

  tekrarButonu.addEventListener("click", function () {
    if (calisiyor) return;
    // Sadece hatalilar yeniden kuyruga alinir; tamamlananlara dokunulmaz.
    kuyruk.forEach(function (k) {
      if (k.durum === DURUM.HATA) {
        k.durum = DURUM.BEKLIYOR;
        k.hata = "";
        k.yuzde = 0;
        satiriGuncelle(k);
      }
    });
    ozetiGuncelle();
    kuyrugaBasla();
  });

  dahaEkle.addEventListener("click", function () {
    // Tamamlanan dosyalar listeden temizlenir; tekrar yuklenmezler.
    kuyruk.length = 0;
    liste.textContent = "";
    bittiEkran.hidden = true;
    anaEkran.hidden = false;
    ozetiGuncelle();
    secici.click();
  });

  // Yukleme suruyorken sekmeyi kapatmaya calisirsa uyar.
  window.addEventListener("beforeunload", function (olay) {
    if (!calisiyor) return;
    olay.preventDefault();
    olay.returnValue = "";
  });
})();
