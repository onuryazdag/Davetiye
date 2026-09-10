# Hatice & Onur Davetiye Sitesi

Mobil odakli, tek sayfalik dugun davetiyesi. Statik site — **build adimi yok**.
Tek sunucu ucu (`/api/presign`) R2 yuklemesi icin imzali adres uretir; onun
bagimliliklari `package.json` uzerinden Vercel tarafindan kurulur.

## Dosyalar

- `index.html` — davetiye sayfasi
- `styles.css` — tasarim (davetiye + yukleme ekrani)
- `script.js` — geri sayim, muzik, isimli karsilama, WhatsApp RSVP
- `yukle.html` / `yukle.js` — fotograf & video yukleme ekrani (`/yukle`)
- `api/presign.js` — imzali yukleme adresi ureten sunucu ucu
- `api/_r2.js` — R2 imzalama, dogrulama ve ayarlar (endpoint DEGILDIR, `_` ile baslar)
- `link-uretici.html` — misafire ozel davetiye linki ureten ic arac (`/link-uretici`)
- `package.json` — yalnizca AWS SDK bagimliliklari (build script'i YOK)
- `vercel.json` — cache, guvenlik ve `noindex` basliklari
- `assets/` — gorseller ve yazi tipi
- `music.mp3` — arka plan muzigi

---

## Fotograf & video yukleme

### Mimari

Dosyalar **Vercel sunucusundan gecmez**. Sunucu yalnizca kisa omurlu, tek bir
objeye bagli imzali adres uretir; tarayici dosyayi dogrudan Cloudflare R2'ye
gonderir.

```
Tarayici
   |  1) POST /api/presign   { filename, contentType, size }
   v
Vercel Function            dogrular, obje anahtarini URETIR, URL'i imzalar
   |  2) { url, key, contentType, expiresIn }
   v
Tarayici
   |  3) PUT <imzali url>    (dosyanin kendisi, Content-Type = yanittaki deger)
   v
Cloudflare R2
```

Bu sayede Vercel'in istek govdesi siniri (~4.5 MB) devre disi kalir; 500 MB'lik
video bile sorunsuz yuklenir.

### Imzalama: resmi AWS SDK

`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` kullanilir. R2 S3 uyumlu
oldugu icin ayni SDK calisir:

```js
new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",  // <-- KALDIRMAYIN
  credentials: { accessKeyId: ..., secretAccessKey: ... },
});
```

> **`requestChecksumCalculation: "WHEN_REQUIRED"` ayarini kaldirmayin.**
> Varsayilan deger (`WHEN_SUPPORTED`) ile SDK, presigned PUT adresine BOS
> govdenin CRC32'sini gomuyor (`x-amz-checksum-crc32=AAAAAA==`). Tarayici gercek
> dosyayi gonderdiginde bu checksum tutmuyor ve R2 istegi reddedebiliyor.
> Test edilerek dogrulandi. Ayar kaldirilirsa dugun gecesi yuklemeler kirilir.

`signableHeaders: new Set(["content-type", "host"])` ile Content-Type imzaya
dahil edilir: imzali adres baska bir turle kullanilamaz.

### Neden hiz siniri yok

Onceki surumde bellekte tutulan, IP basina bir sayac vardi. **Kaldirildi.**
Vercel Serverless'ta her ornek kendi belleginde sayar; trafik onlarca ornege
dagildigi icin boyle bir sayac gercek bir kota saglamaz - sadece guvenlik
yanilsamasi yaratir. Ayrica dugunde herkes ayni Wi-Fi (tek NAT IP) uzerinden
yukleyecegi icin yanlis pozitif riski yuksekti.

Gercek koruma katmanlari:

- bucket private, hicbir obje public degil
- obje anahtarini yalnizca sunucu uretiyor
- MIME + uzanti whitelist'i ve tehlikeli uzanti reddi
- tek dosya boyut sinirlari
- imza omru 5 dakika, tek objeye bagli
- istek govdesi 8 KB ile sinirli, yalnizca POST

Ileride gercek bir kota gerekirse Vercel'in kendi WAF/rate-limit katmani ya da
harici bir KV store kullanilmali; process bellegi degil.

### Gerekli ortam degiskenleri (Vercel -> Production)

| Degisken | Aciklama |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare hesap kimligi |
| `R2_ACCESS_KEY_ID` | R2 API token - **gizli** |
| `R2_SECRET_ACCESS_KEY` | R2 API token - **gizli** |
| `R2_BUCKET_NAME` | `hatice-onur-wedding` |
| `R2_ENDPOINT` | `https://<hesap>.r2.cloudflarestorage.com` |

Hicbirinde `NEXT_PUBLIC_` gibi bir onek YOKTUR ve olmamalidir. Anahtarlar
yalnizca `api/` altindaki sunucu kodunda okunur; istemciye giden hicbir dosyada
yer almaz.

Eksik degisken varsa uc, anlamsiz bir runtime hatasi yerine hangi degiskenin
eksik oldugunu soyleyen 500 doner (degerleri asla loglamaz).
`R2_ENDPOINT` `https://` degilse de reddedilir.

### Obje anahtari

```
uploads/2026-09-24/<uuid>.<uzanti>
```

- Tarih **bilerek sabittir**. Sunucu saatinden turetilmez: saat dilimi farki ya
  da gece yarisini gecmek klasoru ikiye bolmesin diye.
- UUID `crypto.randomUUID()` ile uretilir.
- Uzanti yalnizca whitelist'ten gelir.
- Orijinal dosya adi anahtara **hic girmez**; istemci klasor, tarih veya
  anahtar belirleyemez. Bu yuzden yol atlama (path traversal) mumkun degildir.

### Bucket private KALMALI

- R2 bucket'i public yapmayin.
- "Public Development URL" acmayin.
- Custom public domain baglamayin.
- Ortak galeri / slideshow yok; dosyalar Cloudflare panelinden indirilir.

### CORS

Bucket tarafinda izin verilen origin:

```
https://haticeveonur.vercel.app
```

`PUT` metodu ve `Content-Type` basligi izinli olmalidir. CORS tamamen bucket
tarafinda yonetilir; kodda `Access-Control-Allow-Origin` kurgusu yoktur ve
eklenmemelidir (yukleme istegi tarayicidan dogrudan R2'ye gider).

> **Preview ortamlari:** Vercel'in `*-git-*.vercel.app` onizleme adresleri farkli
> origin'dir. Oralarda yukleme denemek isterseniz o origin'i de bucket CORS
> listesine eklemek gerekir. Aksi halde preview'da yukleme CORS'a takilir -
> bu beklenen davranistir, kod hatasi degildir.

### Dosya sinirlari

`api/_r2.js` icindeki `CONFIG` tek kaynaktir:

| Ayar | Deger |
| --- | --- |
| Fotograf, tek dosya | 25 MB |
| Video, tek dosya | 500 MB |
| Toplam dosya adedi | **sinir yok** |
| Imzali adres omru | 300 saniye |
| Es zamanli yukleme | 3 |

Ayni sinirlar `yukle.js` icindeki `AYAR` blogunda da vardir (kullaniciya hatayi
ag istegi beklemeden gostermek icin). **Degistirirken ikisini birlikte
guncelleyin.**

Sifir, negatif, ondalikli, `NaN` ve `Infinity` boyutlar reddedilir.

### MIME ve uzanti kurallari

Kabul edilen MIME turleri:

`image/jpeg`, `image/pjpeg`, `image/png`, `image/webp`, `image/gif`,
`image/heic`, `image/heif`, `image/heic-sequence`, `image/heif-sequence`,
`video/mp4`, `video/quicktime`, `video/webm`, `video/3gpp`, `video/x-m4v`,
`video/mpeg`

Kabul edilen uzantilar: `.jpg .jpeg .png .webp .gif .heic .heif .mp4 .mov
.webm .3gp .m4v .mpeg .mpg`

Dogrulama uc asamalidir:

1. **Tehlikeli uzanti reddi.** `.exe .html .js .svg .zip .sh .apk .php` ve
   benzeri uzantilar, bildirilen MIME `image/jpeg` olsa bile reddedilir.
   Gercek bir tarayici bunlari boyle gondermez; boyle bir istek uydurulmustur.
2. **MIME whitelist'i** (ya da asagidaki octet-stream geri donusu).
3. **MIME - uzanti aile tutarliligi.** Uzanti taniniyorsa ailesi (image/video)
   bildirilen turle ayni olmalidir. `v.mp4` + `image/jpeg` reddedilir.
   Uzanti taninmiyorsa bu kontrol atlanir (uzantisiz dosyalar calismaya devam
   etsin diye).

`image/svg+xml` bilerek disaridadir (script tasiyabilir).

`photo.exe.jpg` gibi cift uzantililarda son uzanti (`jpg`) esas alinir; anahtari
zaten sunucu urettigi icin obje `uploads/2026-09-24/<uuid>.jpg` olarak saklanir.

### application/octet-stream geri donusu

Bazi Android galerileri video secildiginde Content-Type'i bos ya da
`application/octet-stream` verir. Bu **kor bir kabul degildir**; yalnizca su uc
kosul birlikte saglanirsa calisir:

1. Bildirilen MIME bos, `application/octet-stream` veya `binary/octet-stream`
2. Dosya adindan normalize edilmis bir uzanti okunabiliyor
3. Bu uzanti whitelist'te

O zaman tur uzantidan turetilir (`.mp4` -> `video/mp4`) ve **imza bu turle
atilir**. Sunucu yanitindaki `contentType` normalize edilmis turdur; istemci PUT
istegini tam olarak o turle yapar. Uzanti whitelist'te degilse istek reddedilir.

### Fotograf kucultme

Tarayicida, `<canvas>` ile:

| | |
| --- | --- |
| Kucultulen turler | **yalnizca JPEG ve WebP** |
| Esik | dosya > 1.5 MB (kucuk fotografa dokunulmaz) |
| Uzun kenar | en fazla 2800 px |
| Kalite | 0.86 |
| Cikti turu | kaynakla ayni (JPEG -> JPEG, WebP -> WebP) |

Guvenli geri donusler - kucultme **asla** yuklemeyi engellemez:

- goruntu cozulemezse (ornegin HEIC) orijinal gonderilir
- sonuc orijinalden buyukse orijinal gonderilir
- canvas/`toBlob` yoksa veya hata verirse orijinal gonderilir

Dokunulmayanlar ve nedenleri:

- **HEIC/HEIF** - cogu tarayici cozemez; cozebilenlerde JPEG'e cevirmek dosyayi
  buyutur (HEIC zaten daha verimli)
- **PNG** - saydamlik kaybolur
- **GIF** - animasyon kaybolur
- **Video** - tarayicida yeniden kodlanmaz, orijinal yuklenir

Yon (EXIF orientation): goruntu `<img>` uzerinden cozulur; modern tarayicilar
EXIF yonunu kendisi uygular, canvas'a dogru yonde cizilir. iPhone fotograflari
yan donmez.

Olculen sonuclar:

| Dosya | Once | Sonra |
| --- | --- | --- |
| 4000x3000 JPEG | 11.9 MB | **3.4 MB** |
| 600x600 JPEG | 292 KB | 292 KB (dokunulmadi) |
| 1200x1200 PNG | 4.8 MB | 4.8 MB (dokunulmadi) |
| HEIC | 3.0 MB | 3.0 MB (dokunulmadi) |
| MP4 | 5.0 MB | 5.0 MB (dokunulmadi) |

### `/yukle` ekrani

- Masalardaki QR kod dogrudan `https://haticeveonur.vercel.app/yukle` adresine gider.
- Ana sayfadaki "Fotograf & Video Yukle" butonu da ayni adrese gider.
- Hesap, giris, e-posta istenmez.
- `noindex` - arama motorlarina dusmez.

Akis: dosya sec -> istemcide dogrula -> fotograflari kucult -> en fazla **3 es
zamanli** yukle -> her dosya icin durum ve yuzde goster -> hepsi bitince
tesekkur ekrani.

Durumlar: Bekliyor / Hazirlaniyor / Yukleniyor %N / Tamamlandi / Hata /
Yuklenemez. Hepsi metinle gosterilir, yalnizca renkle degil.

Bir dosyanin hatasi digerlerini durdurmaz. Basarisizlar icin "Basarisizlari
Tekrar Dene" butonu vardir; **basarili dosya tekrar yuklenmez**. Yukleme
surerken "Sec" ve "Yuklemeyi Baslat" butonlari devre disi kalir (cift gonderim
korumasi) ve sekme kapatilmak istenirse tarayici uyarir.

### Bagimliliklar

```
@aws-sdk/client-s3            3.1129.0
@aws-sdk/s3-request-presigner 3.1129.0
```

Baska bagimlilik yoktur. `package.json` icinde **build script'i yoktur**: site
statik kalir, Vercel yalnizca `api/` altini Serverless Function'a cevirirken bu
paketleri kurar. `node_modules/` depoya girmez.

### Gercek cihazda manuel test edilmesi gerekenler

Yerelde sahte R2 ile test edildi; asagidakiler **gercek R2 ve gercek telefon**
ister:

- [ ] iPhone Safari: HEIC fotograf yukleme
- [ ] iPhone Safari: `.MOV` video yukleme (buyuk dosya, birkac dakika suren)
- [ ] Android Chrome: galeriden video (octet-stream geri donusu calisiyor mu)
- [ ] Ayni anda birden fazla telefondan yukleme
- [ ] Zayif baglantida kopma -> "Tekrar Dene" akisi
- [ ] Bucket CORS'unda `PUT` ve `Content-Type` izinli mi
- [ ] Cloudflare panelinde dosyalarin `uploads/2026-09-24/` altinda gorunmesi

## Misafire ozel davetiye linki

`/link-uretici` — isim listesi yapistirilir, her misafir icin
`?ad=Ayse` iceren link uretilir. Link acildiginda karsilama cumlesi ve WhatsApp
katilim mesaji o isimle gelir. Misafir hicbir sey yazmaz.

Sayfa `noindex`'tir ve ana sayfadan link verilmez.

## Ayarlar

`script.js` en ustteki `INVITE`:

```js
const INVITE = {
  weddingDate: "2026-09-24T19:00:00+03:00",
  whatsappNumber: "905537450744",
  musicUrl: "music.mp3?v=4",
  mapsUrl: "https://www.google.com/maps/...",
};
```

`assets/` ve `music.mp3` bir yillik `immutable` cache alir. Bu dosyalari
degistirirken **yeni bir dosya adi** verin (ya da `music.mp3?v=5` gibi surum ekleyin),
yoksa siteyi daha once acmis ziyaretciler eskisini gormeye devam eder.

## Katilim (RSVP)

Site icinde form yok. Misafir uc butondan birine dokunur, WhatsApp hazir mesajla
acilir, cevap dogrudan telefona gelir.

## Muzik

Kapaktaki "Davetiyeyi Ac" dokunusuyla baslar. Tarayici otomatik oynatmayi reddederse
(iOS dusuk guc modu vb.) sessizce kapali kalir ve calardaki play tusu dikkat cekmek
icin nabiz gibi atar.

## Yukleme (deploy)

Vercel'de bu klasoru yukleyin. `package.json` icinde build script'i olmadigi
icin Vercel build adimini atlar: statik dosyalar kokten servis edilir, `api/`
altindaki dosyalar Node.js Serverless Function'a donusur ve yalnizca onlar icin
bagimliliklar kurulur.
