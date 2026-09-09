# Hatice & Onur Davetiye Sitesi

Mobil odaklı, tek sayfalık düğün davetiyesi. Netlify, Vercel veya GitHub Pages'e doğrudan yüklenebilir.

## Dosyalar

- `index.html`: Sayfa içeriği
- `styles.css`: Mobil tasarım
- `script.js`: Geri sayım ve link ayarları
- `assets/floral-frame.svg`: Kapak görseli

## Linkleri ve Müziği Değiştirme

`script.js` icindeki `INVITE` alanini guncelleyin:

```js
const INVITE = {
  weddingDate: "2026-09-24T19:00:00+03:00",
  rsvpUrl: "GOOGLE_FORM_LINKI",
  photoUploadUrl: "FOTOGRAF_YUKLEME_LINKI",
  musicUrl: "assets/music.mp3",
  mapsUrl: "GOOGLE_MAPS_LINKI",
};
```

Google Form linkleri hazır değilse boş bırakılabilir. Butonlar tıklandığında linkin henüz eklenmediğini söyler.

Müzik için seçtiğiniz MP3 dosyasını `assets/music.mp3` olarak ekleyin ve `musicUrl` alanını `"assets/music.mp3"` yapın. Tarayıcılar sesli otomatik çalmayı engellediği için müzik, davetli ilk ekrana dokunduktan sonra başlar.

## Netlify'ye Yükleme

Netlify'de `Upload project files` alanından bu klasörü seçin. Ana dosya `index.html` olduğu için ekstra ayar gerekmez.

## Katılım Formu

Katılım formu site içine gömülü Netlify Forms olarak hazırlandı. Site Netlify'ye yüklendikten sonra cevaplar Netlify panelinde `Forms` bölümünde görünür. Yerelde dosyayı açınca form görsel olarak çalışır, gerçek kayıt alma Netlify deploy sonrası aktif olur.

## Kapak Fotoğrafı

Kapaktaki iki oval çerçeve `assets/cerceve1-clean.png` dosyasını kullanır. Fotoğraflar ekleneceği zaman görselleri `assets/hatice-photo.jpg` ve `assets/onur-photo.jpg` olarak klasöre koyup `index.html` içindeki iki `.photo-crop` alanına ekleyin.
