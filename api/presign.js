"use strict";

/**
 * POST /api/presign
 *
 * Tarayiciya, R2'ye DOGRUDAN yukleme yapabilmesi icin kisa omurlu, tek bir
 * objeye bagli imzali PUT URL'i uretir. Dosyanin kendisi bu sunucudan gecmez.
 *
 * Istek govdesi:  { filename: string, contentType: string, size: number }
 * Yanit:          { url, key, contentType, expiresIn }
 *
 * Yanittaki contentType, sunucunun NORMALIZE ETTIGI turdur. Istemci PUT'u tam
 * olarak bu turle yapmak zorundadir; content-type imzaya dahildir.
 *
 * Hiz siniri YOKTUR - neden README'de ("Neden hiz siniri yok") aciklandi:
 * Serverless'ta ornek basina tutulan bir sayac gercek bir kota saglamaz, sadece
 * guvenlik yanilsamasi yaratirdi. Gercek koruma katmanlari: private bucket,
 * sunucu ureten obje anahtari, MIME/boyut dogrulama ve kisa omurlu imza.
 */

const {
  CONFIG,
  ortamiDogrula,
  istegiDogrula,
  objeAnahtariUret,
  presignedPutUrlUret,
} = require("./_r2.js");

const MAKS_GOVDE_BAYT = 8 * 1024; // Govde kucuk bir JSON; fazlasi kotu niyetlidir.

function govdeOku(req) {
  // Vercel Node runtime JSON govdeyi cogu zaman kendisi ayristirir.
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);

  return new Promise((cozumle, reddet) => {
    let ham = "";
    let bayt = 0;
    let bitti = false;
    req.on("data", (parca) => {
      if (bitti) return;
      bayt += parca.length;
      if (bayt > MAKS_GOVDE_BAYT) {
        // Baglantiyi burada KOPARMIYORUZ: kopartirsak istemci 413 yerine
        // anlamsiz bir ag hatasi goruyor. Okumayi birakip duzgun yanit veriyoruz.
        bitti = true;
        req.pause();
        reddet(Object.assign(new Error("Govde cok buyuk"), { kod: "GOVDE_BUYUK" }));
        return;
      }
      ham += parca;
    });
    req.on("end", () => {
      if (bitti) return;
      if (!ham) return cozumle(null);
      try {
        cozumle(JSON.parse(ham));
      } catch (e) {
        reddet(Object.assign(new Error("Govde JSON degil"), { kod: "GOVDE_JSON_DEGIL" }));
      }
    });
    req.on("error", reddet);
  });
}

function yanitla(res, durum, govde) {
  res.statusCode = durum;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  // Imzali URL'ler asla onbellege alinmamali.
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(govde));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return yanitla(res, 405, { hata: "Bu adres yalnızca POST kabul eder." });
  }

  // Env eksikse anlamsiz bir runtime hatasi yerine acik mesaj.
  let ortam;
  try {
    ortam = ortamiDogrula();
  } catch (e) {
    console.error("[presign] ortam hatasi:", e.message);
    return yanitla(res, 500, {
      hata: "Yükleme servisi şu anda yapılandırılmamış. Lütfen bize haber verin.",
      kod: e.code || "ENV",
    });
  }

  let govde;
  try {
    govde = await govdeOku(req);
  } catch (e) {
    const buyuk = e.kod === "GOVDE_BUYUK";
    return yanitla(res, buyuk ? 413 : 400, {
      hata: buyuk ? "İstek gövdesi çok büyük." : "İstek gövdesi okunamadı.",
      kod: e.kod || "GOVDE",
    });
  }

  const sonuc = istegiDogrula(govde);
  if (sonuc.hata) {
    return yanitla(res, 400, { hata: sonuc.hata.mesaj, kod: sonuc.hata.kod });
  }

  // Anahtari SUNUCU uretir; istemci hangi objeye yazacagini secemez.
  const key = objeAnahtariUret(sonuc.uzanti);

  let url;
  try {
    url = await presignedPutUrlUret({ ortam, key, contentType: sonuc.contentType });
  } catch (e) {
    console.error("[presign] imzalama hatasi:", e.message);
    return yanitla(res, 500, { hata: "Yükleme adresi oluşturulamadı.", kod: "IMZA" });
  }

  return yanitla(res, 200, {
    url,
    key,
    contentType: sonuc.contentType,
    expiresIn: CONFIG.PRESIGN_TTL_SECONDS,
  });
};
