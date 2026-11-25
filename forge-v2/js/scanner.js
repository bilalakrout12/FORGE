// Scanner de code-barres (EAN-13, EAN-8, UPC).
// 1) API native BarcodeDetector si le navigateur l'a,
// 2) sinon bibliothèque ZXing chargée à la demande (mise en cache par le service worker).
const ZXING_URL = 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js';

let zxingPromise = null;
function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (!zxingPromise) {
    zxingPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = ZXING_URL;
      s.onload = () => (window.ZXing ? resolve(window.ZXing) : reject(new Error('ZXing absent')));
      s.onerror = () => { zxingPromise = null; reject(new Error('Chargement du scanner impossible (connexion ?)')); };
      document.head.appendChild(s);
    });
  }
  return zxingPromise;
}

function validEAN(code) {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const d = code.split('').map(Number);
  const check = d.pop();
  let sum = 0;
  d.reverse().forEach((x, i) => { sum += x * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10 === check;
}

// Ouvre la caméra en plein écran. Résout avec le code lu, ou null si annulé.
export function scanBarcode() {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'scanner';
    ov.innerHTML = `
      <video playsinline muted autoplay></video>
      <div class="scan-frame"><span></span></div>
      <div class="scan-top"><button class="scan-close" aria-label="Fermer">✕</button><div class="scan-msg">Vise le code-barres</div></div>
      <form class="scan-manual">
        <input inputmode="numeric" pattern="[0-9]*" placeholder="…ou tape le code-barres" />
        <button type="submit">OK</button>
      </form>`;
    document.body.appendChild(ov);
    const video = ov.querySelector('video');
    const msg = ov.querySelector('.scan-msg');
    let stream = null, stopped = false, timer = null;
    let lastCode = null, hits = 0;

    function finish(code) {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      ov.remove();
      if (code && navigator.vibrate) navigator.vibrate(80);
      resolve(code || null);
    }
    ov.querySelector('.scan-close').onclick = () => finish(null);
    ov.querySelector('.scan-manual').onsubmit = (e) => {
      e.preventDefault();
      const v = ov.querySelector('.scan-manual input').value.replace(/\D/g, '');
      if (v.length >= 8) finish(v);
    };
    // on exige 2 lectures identiques pour éviter les erreurs (sauf si la somme de contrôle est valide)
    function candidate(code) {
      if (!code) return;
      if (validEAN(code)) return finish(code);
      if (code === lastCode) { if (++hits >= 2) finish(code); } else { lastCode = code; hits = 1; }
    }

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (e) {
        msg.textContent = "Caméra inaccessible : autorise-la dans Réglages > Safari, ou tape le code.";
        return;
      }
      if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
      video.srcObject = stream;
      try { await video.play(); } catch (e) { /* lecture auto déjà en cours */ }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      let detector = null;
      if ('BarcodeDetector' in window) {
        try {
          const formats = await window.BarcodeDetector.getSupportedFormats();
          if (formats.includes('ean_13')) detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        } catch (e) { detector = null; }
      }

      let reader = null, Z = null, hints = null;
      if (!detector) {
        msg.textContent = 'Chargement du scanner…';
        try {
          Z = await loadZXing();
        } catch (e) {
          msg.textContent = e.message + ' — tape le code ci-dessous.';
          return;
        }
        hints = new Map();
        hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
        hints.set(Z.DecodeHintType.TRY_HARDER, true);
        reader = new Z.MultiFormatReader();
        reader.setHints(hints);
        msg.textContent = 'Vise le code-barres';
      }

      const tick = async () => {
        if (stopped) return;
        const vw = video.videoWidth, vh = video.videoHeight;
        if (vw && vh) {
          // zone centrale (bande horizontale) : plus rapide et plus fiable
          const cw = Math.round(vw * 0.85), ch = Math.round(vh * 0.45);
          const sx = Math.round((vw - cw) / 2), sy = Math.round((vh - ch) / 2);
          const scale = Math.min(1, 960 / cw);
          canvas.width = Math.round(cw * scale);
          canvas.height = Math.round(ch * scale);
          ctx.drawImage(video, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
          try {
            if (detector) {
              const codes = await detector.detect(canvas);
              if (codes.length) candidate(codes[0].rawValue);
            } else {
              let source;
              if (Z.HTMLCanvasElementLuminanceSource) {
                source = new Z.HTMLCanvasElementLuminanceSource(canvas);
              } else {
                const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                const lum = new Uint8ClampedArray(canvas.width * canvas.height);
                for (let i = 0, j = 0; i < img.length; i += 4, j++) lum[j] = (img[i] * 77 + img[i + 1] * 150 + img[i + 2] * 29) >> 8;
                source = new Z.RGBLuminanceSource(lum, canvas.width, canvas.height);
              }
              const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(source));
              const res = reader.decode(bitmap, hints);
              if (res) candidate(res.getText());
            }
          } catch (e) { /* rien trouvé sur cette image */ }
        }
        timer = setTimeout(tick, detector ? 150 : 120);
      };
      tick();
    })();
  });
}
