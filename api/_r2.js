"use strict";

/**
 * R2 (S3 uyumlu) presigned PUT URL uretimi + paylasilan dogrulama.
 *
 * Bu dosya "_" ile basladigi icin Vercel onu bir endpoint olarak yayinlamaz;
 * sadece api/presign.js tarafindan import edilir.
 *
 * Imzalama resmi AWS SDK ile yapilir (@aws-sdk/client-s3 + s3-request-presigner).
 * Onceki surumde elle yazilmis SigV4 vardi; bakim yuku ve denetlenmesi gereken
 * ozel kripto tasimamak icin bilerek kaldirildi.
 */

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");

/* ------------------------------------------------------------------ *
 * Yapilandirma - degistirmek istediginizde tek yer burasi
 * ------------------------------------------------------------------ */

const CONFIG = {
  // Tek dosya basina ust sinirlar (bayt). Toplam dosya ADEDI icin sinir yok.
  MAX_IMAGE_BYTES: 25 * 1024 * 1024, //  25 MB
  MAX_VIDEO_BYTES: 500 * 1024 * 1024, // 500 MB

  // Presigned URL omru (saniye). Imza yukleme BASLARKEN dogrulanir; baslamis
  // buyuk bir video yuklemesi bu sureyi asabilir, sorun olmaz.
  PRESIGN_TTL_SECONDS: 300,

  // Obje anahtari sabit: bu site tek bir dugun icin. Tarih BILEREK sabit,
  // sunucu saatinden turetilmiyor (saat dilimi / gece yarisi surprizi olmasin).
  KEY_PREFIX: "uploads",
  KEY_DATE: "2026-09-24",
};

/* ------------------------------------------------------------------ *
 * Izin verilen medya turleri
 * ------------------------------------------------------------------ *
 * Istemcinin bildirdigi Content-Type bu listeye karsi dogrulanir ve imzaya
 * DAHIL edilir (X-Amz-SignedHeaders=content-type;host): imzali adres baska bir
 * Content-Type ile kullanilamaz.
 *
 * image/svg+xml bilerek YOK (script tasiyabilir).
 */
const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/heic-sequence": "heic",
  "image/heif-sequence": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/3gpp": "3gp",
  "video/x-m4v": "m4v",
  "video/mpeg": "mpeg",
};

/** Uzanti -> kanonik MIME. octet-stream geri donusu ve tutarlilik kontrolu icin. */
const EXTENSION_TO_TYPE = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  "3gp": "video/3gpp",
  m4v: "video/x-m4v",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
};

/**
 * Bildirilen MIME whitelist'te olsa bile bu uzantilar reddedilir.
 * Gercek bir tarayici bunlari image/jpeg olarak gondermez; boyle bir istek
 * elle uydurulmustur. Derinlemesine savunma.
 */
const YASAKLI_UZANTILAR = new Set([
  "exe", "com", "bat", "cmd", "msi", "scr", "dll", "app", "apk", "deb", "dmg",
  "sh", "bash", "ps1", "vbs", "jar", "bin",
  "html", "htm", "xhtml", "js", "mjs", "cjs", "php", "asp", "aspx", "jsp",
  "svg", "xml", "swf",
  "zip", "rar", "7z", "tar", "gz", "bz2", "iso",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
]);

/** Content-Type'in bos ya da genel oldugu durumlar - uzantidan turetilir. */
const BELIRSIZ_TURLER = new Set(["", "application/octet-stream", "binary/octet-stream"]);

/* ------------------------------------------------------------------ *
 * Ortam degiskenleri
 * ------------------------------------------------------------------ */

const ZORUNLU_ENV = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_ENDPOINT",
];

let onbellektekiIstemci = null;

/**
 * Eksik env'leri tek seferde, anlasilir sekilde bildirir.
 * Hangi degiskenin eksik oldugunu yazar; DEGERLERI asla loglamaz.
 */
function ortamiDogrula() {
  const eksik = ZORUNLU_ENV.filter((ad) => !process.env[ad] || !String(process.env[ad]).trim());
  if (eksik.length) {
    const hata = new Error(
      "Sunucu yapilandirmasi eksik. Tanimlanmamis ortam degiskenleri: " + eksik.join(", ")
    );
    hata.code = "ENV_EKSIK";
    throw hata;
  }

  let endpoint;
  try {
    endpoint = new URL(String(process.env.R2_ENDPOINT).trim());
  } catch (e) {
    const hata = new Error("R2_ENDPOINT gecerli bir URL degil.");
    hata.code = "ENV_GECERSIZ";
    throw hata;
  }
  if (endpoint.protocol !== "https:") {
    const hata = new Error("R2_ENDPOINT https:// olmali.");
    hata.code = "ENV_GECERSIZ";
    throw hata;
  }

  return {
    accessKeyId: String(process.env.R2_ACCESS_KEY_ID).trim(),
    secretAccessKey: String(process.env.R2_SECRET_ACCESS_KEY).trim(),
    bucket: String(process.env.R2_BUCKET_NAME).trim(),
    endpoint: endpoint.origin,
  };
}

/**
 * S3 istemcisi (ornek basina onbelleklenir; her istekte yeniden kurulmaz).
 *
 * requestChecksumCalculation: "WHEN_REQUIRED" AYARINI KALDIRMAYIN.
 * Varsayilan deger ("WHEN_SUPPORTED") ile SDK, presigned PUT adresine BOS
 * govdenin CRC32'sini gomuyor (x-amz-checksum-crc32=AAAAAA==). Tarayici gercek
 * dosyayi gonderdiginde bu checksum tutmuyor ve R2 istegi reddedebiliyor.
 * Bu davranis test edilerek dogrulandi; ayar kaldirilirsa yuklemeler kirilir.
 */
function istemciAl(ortam) {
  const anahtar = ortam.accessKeyId + "|" + ortam.endpoint;
  if (onbellektekiIstemci && onbellektekiIstemci.anahtar === anahtar) {
    return onbellektekiIstemci.istemci;
  }
  const istemci = new S3Client({
    region: "auto", // R2
    endpoint: ortam.endpoint,
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: ortam.accessKeyId,
      secretAccessKey: ortam.secretAccessKey,
    },
  });
  onbellektekiIstemci = { anahtar, istemci };
  return istemci;
}

/* ------------------------------------------------------------------ *
 * Girdi dogrulama
 * ------------------------------------------------------------------ */

/**
 * Dosya adindan uzantiyi normalize ederek okur.
 * Yol ayraclari once temizlenir ki "../../x.jpg" gibi girdilerde de son parca
 * dogru okunsun. Sadece son noktadan sonrasi, kucuk harf, harf/rakam disi atilir.
 */
function uzantiAl(dosyaAdi) {
  const ad = String(dosyaAdi || "")
    .replace(/\\/g, "/")
    .split("/")
    .pop();
  const nokta = ad.lastIndexOf(".");
  if (nokta < 0) return "";
  return ad
    .slice(nokta + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10);
}

function turAilesi(mime) {
  if (String(mime).startsWith("image/")) return "image";
  if (String(mime).startsWith("video/")) return "video";
  return "";
}

/**
 * Istegi dogrular; gecerliyse yuklemede kullanilacak kanonik degerleri doner.
 * Hata durumunda { hata: { kod, mesaj } } doner - HTTP katmani bunu 400'e cevirir.
 */
function istegiDogrula(govde) {
  if (!govde || typeof govde !== "object" || Array.isArray(govde)) {
    return { hata: { kod: "GECERSIZ_GOVDE", mesaj: "İstek gövdesi okunamadı." } };
  }

  const { filename, contentType, size } = govde;

  if (typeof filename !== "string" || !filename.trim()) {
    return { hata: { kod: "DOSYA_ADI_YOK", mesaj: "Dosya adı eksik." } };
  }
  if (filename.length > 400) {
    return { hata: { kod: "DOSYA_ADI_UZUN", mesaj: "Dosya adı çok uzun." } };
  }

  if (
    typeof size !== "number" ||
    !Number.isFinite(size) ||
    !Number.isInteger(size) ||
    size <= 0
  ) {
    return { hata: { kod: "BOYUT_GECERSIZ", mesaj: "Dosya boyutu geçersiz." } };
  }

  const bildirilen = typeof contentType === "string" ? contentType.trim().toLowerCase() : "";
  const uzanti = uzantiAl(filename);

  // 1) Tehlikeli uzanti: bildirilen MIME ne olursa olsun reddedilir.
  if (uzanti && YASAKLI_UZANTILAR.has(uzanti)) {
    return {
      hata: {
        kod: "TUR_DESTEKLENMIYOR",
        mesaj: "Bu dosya türü desteklenmiyor. Sadece fotoğraf ve video yükleyebilirsiniz.",
      },
    };
  }

  // 2) Turu belirle.
  let tur = "";
  if (ALLOWED_TYPES[bildirilen]) {
    tur = bildirilen;
  } else if (BELIRSIZ_TURLER.has(bildirilen) && EXTENSION_TO_TYPE[uzanti]) {
    // octet-stream geri donusu: SADECE uzanti whitelist'te ise.
    tur = EXTENSION_TO_TYPE[uzanti];
  } else {
    return {
      hata: {
        kod: "TUR_DESTEKLENMIYOR",
        mesaj: "Bu dosya türü desteklenmiyor. Sadece fotoğraf ve video yükleyebilirsiniz.",
      },
    };
  }

  // 3) MIME ile uzanti ayni ailede mi? (jpg <-> image, mp4 <-> video)
  //    Uzanti taninmiyorsa sinyal yok, bu kontrol atlanir.
  const uzantininTuru = EXTENSION_TO_TYPE[uzanti];
  if (uzantininTuru && turAilesi(uzantininTuru) !== turAilesi(tur)) {
    return {
      hata: { kod: "TUR_UYUSMAZLIGI", mesaj: "Dosya türü ile uzantısı uyuşmuyor." },
    };
  }

  // 4) Boyut.
  const video = turAilesi(tur) === "video";
  const sinir = video ? CONFIG.MAX_VIDEO_BYTES : CONFIG.MAX_IMAGE_BYTES;
  if (size > sinir) {
    const mb = Math.round(sinir / (1024 * 1024));
    return {
      hata: {
        kod: "DOSYA_COK_BUYUK",
        mesaj: video
          ? `Video çok büyük. Tek video en fazla ${mb} MB olabilir.`
          : `Fotoğraf çok büyük. Tek fotoğraf en fazla ${mb} MB olabilir.`,
      },
    };
  }

  return { contentType: tur, uzanti: ALLOWED_TYPES[tur], size };
}

/**
 * Obje anahtarini HER ZAMAN sunucu uretir.
 * Istemciden gelen hicbir sey anahtara girmez; klasor ve tarih sabittir.
 * Bu yuzden yol atlama (path traversal) mumkun degildir.
 */
function objeAnahtariUret(uzanti) {
  const id =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString("hex");
  const guvenli =
    String(uzanti || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8) || "bin";
  return `${CONFIG.KEY_PREFIX}/${CONFIG.KEY_DATE}/${id}.${guvenli}`;
}

/**
 * Presigned PUT URL uretir.
 * Bucket env'den, key sunucudan gelir; ikisini de istemci belirleyemez.
 */
async function presignedPutUrlUret({ ortam, key, contentType }) {
  const komut = new PutObjectCommand({
    Bucket: ortam.bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(istemciAl(ortam), komut, {
    expiresIn: CONFIG.PRESIGN_TTL_SECONDS,
    // content-type imzaya dahil: imzali adres baska bir turle kullanilamaz.
    signableHeaders: new Set(["content-type", "host"]),
  });
}

module.exports = {
  CONFIG,
  ALLOWED_TYPES,
  EXTENSION_TO_TYPE,
  YASAKLI_UZANTILAR,
  ortamiDogrula,
  istegiDogrula,
  objeAnahtariUret,
  presignedPutUrlUret,
  _test: { uzantiAl, turAilesi },
};
