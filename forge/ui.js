// Briques d'interface : navigation, toast, feuilles, icônes.
import { esc } from './store.js';

let refresher = () => {};
export function setRefresher(fn) { refresher = fn; }
export function refresh() {
  const y = window.scrollY;
  refresher();
  window.scrollTo(0, y);
}
export function go(hash) {
  if (location.hash === hash) refresh();
  else location.hash = hash;
}

// Message bref en bas d'écran, avec action facultative (ex. « Annuler »)
let toastTimer;
export function toast(msg, opts = {}) {
  const el = document.getElementById('toast');
  const ms = typeof opts === 'number' ? opts : opts.ms || (opts.action ? 5000 : 2600);
  el.innerHTML = `<span>${esc(msg)}</span>${opts.action ? `<button type="button">${esc(opts.action)}</button>` : ''}`;
  if (opts.action) {
    el.querySelector('button').onclick = () => { el.classList.remove('show'); opts.onAction && opts.onAction(); };
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// Feuille qui monte du bas de l'écran
export function openSheet({ title = '', html = '', onAction, onInput, onClose, tall = false }) {
  const back = document.createElement('div');
  back.className = 'sheet-back';
  back.innerHTML = `<div class="sheet ${tall ? 'tall' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="grabber" aria-hidden="true"></div>
      <div class="sheet-head"><h2 class="sheet-title">${esc(title)}</h2><button class="link" data-act="__close">Fermer</button></div>
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
      setTimeout(() => back.remove(), 240);
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

// En-tête de page : grand titre, ligne d'info, actions à droite
export function header({ title, sub = '', actions = '' }) {
  return `<header class="hd">
    <div class="hd-row"><h1>${esc(title)}</h1>${actions ? `<div class="hd-actions">${actions}</div>` : ''}</div>
    ${sub ? `<p class="hd-sub">${sub}</p>` : ''}
  </header>`;
}

export function icon(name) {
  const p = {
    back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    prev: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    next: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    plus: '<path d="M12 5.5v13M5.5 12h13"/>',
    minus: '<path d="M5.5 12h13"/>',
    more: '<circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
    check: '<path d="M5.5 12.5l4 4 9-9.5"/>',
    scan: '<path d="M4.5 8.5v-3a1 1 0 011-1h3M15.5 4.5h3a1 1 0 011 1v3M19.5 15.5v3a1 1 0 01-1 1h-3M8.5 19.5h-3a1 1 0 01-1-1v-3"/><path d="M8 9v6M11 9v6M14 9v6M16.5 9v6"/>',
    search: '<circle cx="10.8" cy="10.8" r="6"/><path d="M15.3 15.3L20 20"/>',
    grip: '<circle cx="9" cy="7" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="7" r="1.1" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="9" cy="17" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="1.1" fill="currentColor" stroke="none"/>',
    swap: '<path d="M7.5 4.5L4.5 7.5l3 3M4.5 7.5h12M16.5 13.5l3 3-3 3M19.5 16.5h-12"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/>',
    edit: '<path d="M4.5 19.5h4l10-10-4-4-10 10z"/>',
    trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.9 12.2a1 1 0 001 .8h7.2a1 1 0 001-.8L17.5 7M9.5 7V4.8a.8.8 0 01.8-.8h3.4a.8.8 0 01.8.8V7"/>',
    star: '<path d="M12 4l2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 18.9l1-5.4-4-3.8 5.4-.7z"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 8.5V5.5a1 1 0 00-1-1h-9a1 1 0 00-1 1v9a1 1 0 001 1h3"/>',
    camera: '<path d="M4.5 8.5h3l1.8-2.5h5.4l1.8 2.5h3v10h-15z"/><circle cx="12" cy="13.3" r="3.2"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    calendar: '<rect x="4.5" y="5.5" width="15" height="14" rx="1.5"/><path d="M4.5 10h15M9 3.5v4M15 3.5v4"/>',
  }[name] || '';
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
