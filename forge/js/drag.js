// Glisser-déposer des séances : appui long au doigt (ou clic-glisser à la souris),
// dépôt sur un jour pour déplacer, sur la poubelle pour retirer.
let suppressClickUntil = 0;
export function clickSuppressed() { return Date.now() < suppressClickUntil; }

let cfg = null;      // { root, onDrop, onStart } de l'écran affiché
let bound = false;
let src = null, ghost = null, trash = null, over = null;
let sx = 0, sy = 0, ox = 0, oy = 0, timer = null, dragging = false, lastY = 0, raf = 0;

export function enableDrag(root, opts) {
  cfg = { root, ...opts };
  if (!bound) { bind(); bound = true; }
}
export function disableDrag() { cancel(); cfg = null; }

const TRASH_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.9 12.2a1 1 0 001 .8h7.2a1 1 0 001-.8L17.5 7M9.5 7V4.8a.8.8 0 01.8-.8h3.4a.8.8 0 01.8.8V7"/></svg>';

function begin(x, y) {
  dragging = true;
  const r = src.getBoundingClientRect();
  ox = x - r.left; oy = y - r.top;
  ghost = src.cloneNode(true);
  ghost.classList.add('drag-ghost');
  ghost.style.width = r.width + 'px';
  document.body.appendChild(ghost);
  src.classList.add('drag-src');
  trash = document.createElement('div');
  trash.className = 'trash';
  trash.innerHTML = `${TRASH_ICON}<span>Retirer de la semaine</span>`;
  document.body.appendChild(trash);
  document.body.classList.add('is-dragging');
  requestAnimationFrame(() => trash && trash.classList.add('show'));
  if (navigator.vibrate) navigator.vibrate(12);
  cfg?.onStart && cfg.onStart(src);
  move(x, y);
  autoscroll();
}
function move(x, y) {
  lastY = y;
  ghost.style.transform = `translate(${x - ox}px, ${y - oy}px)`;
  const el = document.elementFromPoint(x, y);
  const target = el && (el.closest('.trash') || el.closest('[data-drop]'));
  if (target !== over) {
    over && over.classList.remove('drop-over');
    over = target;
    over && over.classList.add('drop-over');
  }
}
function autoscroll() {
  cancelAnimationFrame(raf);
  const step = () => {
    if (!dragging) return;
    const h = window.innerHeight;
    if (lastY < 90) window.scrollBy(0, -9);
    else if (lastY > h - 170) window.scrollBy(0, 9);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
function cleanup() {
  cancelAnimationFrame(raf);
  over && over.classList.remove('drop-over');
  ghost && ghost.remove();
  trash && trash.remove();
  src && src.classList.remove('drag-src');
  document.body.classList.remove('is-dragging');
}
function cancel() {
  clearTimeout(timer); timer = null;
  if (dragging) { dragging = false; cleanup(); }
  src = ghost = trash = over = null;
}
function end() {
  clearTimeout(timer); timer = null;
  if (!dragging) { src = null; return; }
  dragging = false;
  suppressClickUntil = Date.now() + 450;
  const target = over, el = src;
  cleanup();
  src = ghost = trash = over = null;
  if (target && cfg) {
    cfg.onDrop({ el, tpl: el.dataset.tpl, from: el.dataset.date, to: target.classList.contains('trash') ? 'trash' : target.dataset.drop });
  }
}
function draggableFrom(target) {
  if (!cfg || !cfg.root.isConnected) return null;
  const el = target.closest && target.closest('[data-drag]');
  return el && cfg.root.contains(el) ? el : null;
}

function bind() {
  // ---- Tactile : appui long ----
  document.addEventListener('touchstart', (e) => {
    const el = draggableFrom(e.target);
    if (!el || e.touches.length > 1) return;
    src = el;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    timer = setTimeout(() => { timer = null; if (src) begin(sx, sy); }, 320);
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!src) return;
    const t = e.touches[0];
    if (!dragging) {
      if (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8) { clearTimeout(timer); timer = null; src = null; }
      return;
    }
    e.preventDefault();
    move(t.clientX, t.clientY);
  }, { passive: false });
  document.addEventListener('touchend', end);
  document.addEventListener('touchcancel', cancel);

  // ---- Souris ----
  document.addEventListener('mousedown', (e) => {
    const el = draggableFrom(e.target);
    if (!el || e.button !== 0) return;
    src = el; sx = e.clientX; sy = e.clientY;
  });
  document.addEventListener('mousemove', (e) => {
    if (!src) return;
    if (!dragging) {
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 6) begin(e.clientX, e.clientY);
      return;
    }
    move(e.clientX, e.clientY);
  });
  document.addEventListener('mouseup', () => { if (src) end(); });

  // pas de menu contextuel iOS pendant l'appui long
  document.addEventListener('contextmenu', (e) => { if (draggableFrom(e.target)) e.preventDefault(); });
}
