// Briques d'interface : toast, feuilles modales, navigation.
import { esc } from './store.js';

let refresher = () => {};
export function setRefresher(fn) { refresher = fn; }
// Re-dessine la vue courante en gardant la position de défilement
export function refresh() {
  const y = window.scrollY;
  refresher();
  window.scrollTo(0, y);
}
export function go(hash) {
  if (location.hash === hash) refresh();
  else location.hash = hash;
}

let toastTimer;
export function toast(msg, ms = 2400) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// Feuille modale qui monte du bas de l'écran.
// onAction(act, target, event, sheet) reçoit les clics sur [data-act]
// onInput(target, event, sheet) reçoit les saisies
export function openSheet({ title = '', html = '', onAction, onInput, onClose, tall = false }) {
  const back = document.createElement('div');
  back.className = 'sheet-back';
  back.innerHTML = `<div class="sheet ${tall ? 'tall' : ''}" role="dialog" aria-modal="true">
      <div class="sheet-head"><div class="sheet-title">${esc(title)}</div><button class="icon-btn" data-act="__close" aria-label="Fermer">✕</button></div>
      <div class="sheet-body"></div>
    </div>`;
  const body = back.querySelector('.sheet-body');
  body.innerHTML = html;
  document.body.appendChild(back);
  document.body.classList.add('noscroll');
  requestAnimationFrame(() => back.classList.add('open'));

  const sheet = {
    el: back,
    body,
    setBody(h) { body.innerHTML = h; body.scrollTop = 0; },
    setTitle(t) { back.querySelector('.sheet-title').textContent = t; },
    close() {
      back.classList.remove('open');
      document.body.classList.remove('noscroll');
      setTimeout(() => back.remove(), 220);
      onClose && onClose();
    },
  };
  back.addEventListener('click', (e) => {
    if (e.target === back) return sheet.close();
    const t = e.target.closest('[data-act]');
    if (!t) return;
    if (t.dataset.act === '__close') return sheet.close();
    onAction && onAction(t.dataset.act, t, e, sheet);
  });
  if (onInput) {
    back.addEventListener('input', (e) => onInput(e.target, e, sheet));
    back.addEventListener('change', (e) => onInput(e.target, e, sheet));
  }
  return sheet;
}

export function icon(name) {
  const p = {
    back: '<path d="M15 18l-6-6 6-6"/>',
    next: '<path d="M9 18l6-6-6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    swap: '<path d="M7 4l-3 3 3 3"/><path d="M4 7h13"/><path d="M17 20l3-3-3-3"/><path d="M20 17H7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    scan: '<path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3"/><path d="M7 9v6M10 9v6M13 9v6M16 9v6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    minus: '<path d="M5 12h14"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    drop: '<path d="M12 3.5c3.5 4.4 6 7.6 6 10.5a6 6 0 01-12 0c0-2.9 2.5-6.1 6-10.5z"/>',
  }[name] || '';
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}
