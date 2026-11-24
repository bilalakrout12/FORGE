// Minuteur de repos (basé sur l'heure réelle : continue même si l'écran se verrouille)
// + maintien de l'écran allumé pendant la séance.
import { state } from './store.js';
import { toast } from './ui.js';

let endAt = 0, total = 0, iv = null, label = '';
let audioCtx = null;

export function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* pas d'audio */ }
}

function beep(times = 3) {
  if (!state.settings.sound || !audioCtx) return;
  for (let i = 0; i < times; i++) {
    const t = audioCtx.currentTime + i * 0.28;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = i === times - 1 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(audioCtx.destination);
    o.start(t);
    o.stop(t + 0.25);
  }
}

const el = () => document.getElementById('rest');
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function draw() {
  const box = el();
  const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
  const pct = total ? (left / total) * 100 : 0;
  box.querySelector('.rest-time').textContent = mmss(left);
  box.querySelector('.rest-bar span').style.width = pct + '%';
  if (left <= 0) {
    beep();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    toast('Repos terminé : série suivante !');
    stopRest();
  }
}

export function startRest(sec, what = 'Repos') {
  if (!sec) return;
  total = sec;
  endAt = Date.now() + sec * 1000;
  label = what;
  const box = el();
  box.hidden = false;
  box.innerHTML = `<div class="rest-row">
      <div class="rest-info"><div class="rest-label">${label}</div><div class="rest-time">${mmss(sec)}</div></div>
      <button data-r="-15">−15</button><button data-r="15">+15</button><button data-r="stop" aria-label="Arrêter">✕</button>
    </div><div class="rest-bar"><span></span></div>`;
  clearInterval(iv);
  iv = setInterval(draw, 250);
  draw();
  document.body.classList.add('has-rest');
}
export function stopRest() {
  clearInterval(iv);
  iv = null;
  const box = el();
  if (box) { box.hidden = true; box.innerHTML = ''; }
  document.body.classList.remove('has-rest');
}
export function restRunning() { return !!iv; }

document.addEventListener('click', (e) => {
  const b = e.target.closest('#rest [data-r]');
  if (!b) return;
  const r = b.dataset.r;
  if (r === 'stop') return stopRest();
  const d = Number(r);
  endAt += d * 1000;
  total = Math.max(total + d, 1);
  draw();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && iv) draw(); });

// ---------- Écran allumé ----------
let lock = null, wantLock = false;
export async function keepAwake(on) {
  wantLock = on && state.settings.wakeLock;
  try {
    if (wantLock && !lock && 'wakeLock' in navigator) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!wantLock && lock) {
      await lock.release();
      lock = null;
    }
  } catch (e) { lock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && wantLock && !lock) keepAwake(true);
});
