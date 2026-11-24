// Point d'entrée : navigation entre les écrans + service worker.
import { state } from './store.js';
import { setRefresher, toast } from './ui.js';
import * as week from './views/week.js';
import * as session from './views/session.js';
import * as progress from './views/progress.js';
import * as nutrition from './views/nutrition.js';
import * as body from './views/body.js';
import * as profile from './views/profile.js';

const main = document.getElementById('app');
const tabs = document.getElementById('tabs');
let current = null;

const ROUTES = {
  week: { view: week, tab: 'week' },
  session: { view: session, tab: 'week' },
  progress: { view: progress, tab: 'progress' },
  nutrition: { view: nutrition, tab: 'nutrition' },
  body: { view: body, tab: 'body' },
  profile: { view: profile, tab: 'profile' },
};

function render() {
  const [, name = 'week', param] = (location.hash || '#/week').split('/');
  const route = ROUTES[name] || ROUTES.week;
  if (current && current !== route.view && current.leave) current.leave();
  current = route.view;
  main.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'view view-' + name;
  main.appendChild(root);

  if (!state.profile) {
    tabs.hidden = true;
    profile.renderOnboarding(root);
    return;
  }
  tabs.hidden = name === 'session';
  document.body.classList.toggle('in-session', name === 'session');
  tabs.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.tab === route.tab));
  route.view.render(root, param ? decodeURIComponent(param) : undefined);
}

setRefresher(render);
window.addEventListener('hashchange', () => {
  // ferme les feuilles restées ouvertes quand on change d'écran
  document.querySelectorAll('.sheet-back').forEach((s) => s.remove());
  document.body.classList.remove('noscroll');
  render();
  window.scrollTo(0, 0);
});
render();

// ---------- Service worker (mode hors-ligne + mises à jour) ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Nouvelle version installée : elle sera active au prochain lancement', 4000);
        }
      });
    });
  }).catch(() => {});
}

// Empêche le zoom par double-tap sur iOS dans les zones de saisie rapide
let lastTouch = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouch < 300 && e.target.closest('button, .chk')) e.preventDefault();
  lastTouch = now;
}, { passive: false });
