# Hatice & Onur Davetiye Sitesi

Mobil odakli, tek sayfalik dugun davetiyesi. Statik site — Vercel'e dogrudan yuklenir.

## Dosyalar

- `index.html` — sayfa icerigi
- `styles.css` — tasarim
- `script.js` — geri sayim, muzik ve link ayarlari
- `vercel.json` — Vercel cache ve guvenlik basliklari
- `assets/` — gorseller, font, paylasim gorseli
- `music.mp3` — arka plan muzigi

## YAPILACAK: WhatsApp numarasini gir

`script.js` en ustteki `INVITE` icinde:

```js
whatsappNumber: "905XXXXXXXXX",
```

Ulke kodu ile, bosluksuz, + isareti olmadan yazin. Ornek: `"905321234567"`.
Numara girilene kadar katilim butonlari uyari verir, WhatsApp acilmaz.

## YAPILACAK: Domain adresini gir

`index.html` icindeki `REPLACE-WITH-YOUR-DOMAIN` yazan 4 yeri Vercel'deki
gercek adresinizle degistirin (ornek: `hatice-onur.vercel.app`).
Bu adres WhatsApp/Instagram paylasim onizlemesi icin gerekli.

## Diger ayarlar

`script.js` icindeki `INVITE` alani:

```js
const INVITE = {
  weddingDate: "2026-09-24T19:00:00+03:00",
  whatsappNumber: "905XXXXXXXXX",
  photoUploadUrl: "GOOGLE_DRIVE_LINKI",
  musicUrl: "music.mp3",
  mapsUrl: "GOOGLE_MAPS_LINKI",
};
```

Geri sayim dugun tarihine gelince kutular gizlenir, yerine kutlama mesaji cikar.

## Katilim (RSVP)

Site icinde form yok. Misafir uc butondan birine dokunur, WhatsApp hazir
mesajla acilir, cevap dogrudan telefonunuza gelir.

Not: Onceki surumde Netlify Forms kullaniliyordu. Site Vercel'de oldugu icin
o form calismiyordu ve gonderilen cevaplar hicbir yere kaydedilmiyordu.

## Muzik

Tarayicilar sesli otomatik calmayi engeller. Misafir kapaktaki butona
dokunduktan sonra muzik calarindaki play tusuna basmalidir.

## Yukleme

Vercel'de projeye bu klasoru yukleyin. Ana dosya `index.html`, ekstra ayar gerekmez.
