// Point d'entrée : navigation, barre « séance en cours », service worker.
import { state, esc } from './store.js';
import { setRefresher, go, toast } from './ui.js';
import { inProgress } from './workouts.js';
import { disableDrag } from './drag.js';
import * as week from './views/week.js';
import * as session from './views/session.js';
import * as progress from './views/progress.js';
import * as nutrition from './views/nutrition.js';
import * as body from './views/body.js';
import * as profile from './views/profile.js';

const main = document.getElementById('app');
const tabs = document.getElementById('tabs');
const mini = document.getElementById('mini');
let current = null;
let miniTimer = null;

const ROUTES = {
  week: { view: week, tab: 'week' },
  session: { view: session, tab: 'week' },
  progress: { view: progress, tab: 'progress' },
  nutrition: { view: nutrition, tab: 'nutrition' },
  body: { view: body, tab: 'body' },
  profile: { view: profile, tab: 'profile' },
};

function renderMini(name) {
  const cur = inProgress();
  clearInterval(miniTimer);
  if (!cur || name === 'session' || !state.profile) {
    mini.hidden = true;
    document.body.classList.remove('has-mini');
    return;
  }
  const upd = () => {
    const done = cur.items.reduce((s, it) => s + it.sets.filter((x) => x.ok).length, 0);
    const total = cur.items.reduce((s, it) => s + it.sets.length, 0);
    mini.querySelector('.mini-sub').textContent = `${Math.round((Date.now() - cur.start) / 60000)} min, ${done} séries sur ${total}`;
  };
  mini.innerHTML = `<div class="mini-main"><div class="mini-title">${esc(cur.name)}</div><div class="mini-sub"></div></div><span class="mini-go">Reprendre</span>`;
  mini.onclick = () => go('#/session/' + cur.id);
  upd();
  miniTimer = setInterval(upd, 30000);
  mini.hidden = false;
  document.body.classList.add('has-mini');
}

function render() {
  const [, name = 'week', param] = (location.hash || '#/week').split('/');
  const route = ROUTES[name] || ROUTES.week;
  if (current && current.leave) current.leave();
  disableDrag();
  current = route.view;
  main.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'view view-' + name;
  main.appendChild(root);

  if (!state.profile) {
    tabs.hidden = true;
    mini.hidden = true;
    profile.renderOnboarding(root);
    return;
  }
  tabs.hidden = name === 'session';
  document.body.classList.toggle('in-session', name === 'session');
  tabs.querySelectorAll('a').forEach((a) => {
    const on = a.dataset.tab === route.tab;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  route.view.render(root, param ? decodeURIComponent(param) : undefined);
  renderMini(name);
}

setRefresher(render);
window.addEventListener('hashchange', () => {
  document.querySelectorAll('.sheet-back').forEach((s) => s.remove());
  document.body.classList.remove('noscroll');
  render();
  window.scrollTo(0, 0);
});
render();

// ---------- Service worker : hors-ligne et mises à jour ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // une nouvelle version vient de prendre la main : on recharge une fois pour l'afficher
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    if (!document.querySelector('.sheet-back') && !inProgress()) location.reload();
    else toast('Nouvelle version prête : elle s’affichera au prochain lancement');
  });
}
