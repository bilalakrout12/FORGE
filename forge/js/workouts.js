// Création des séances et planning de la semaine (déplacements, retraits).
import { state, save, uid, today, mondayOf, addDays } from './store.js';
import { isDeloadWeek } from './calc.js';
import { go, toast } from './ui.js';

export function inProgress() {
  return state.workouts.find((w) => !w.done) || null;
}

export function templatesSorted() {
  return Object.values(state.templates).sort((a, b) => a.day - b.day);
}

export function startWorkout(tplId, date = today()) {
  const cur = inProgress();
  if (cur) {
    if (confirm(`La séance ${cur.name} est en cours. La reprendre ?\n\nAnnuler pour l’abandonner et commencer celle-ci.`)) {
      go('#/session/' + cur.id);
      return;
    }
    if (!confirm('Supprimer la séance en cours et ses séries ?')) return;
    state.workouts = state.workouts.filter((w) => w !== cur);
  }
  const tpl = state.templates[tplId];
  const deload = isDeloadWeek(date);
  const w = {
    id: uid(),
    tpl: tplId,
    name: tpl.name,
    date,
    start: Date.now(),
    end: null,
    done: false,
    deload,
    items: tpl.items.map((it) => {
      const n = deload ? Math.max(1, Math.ceil(it.sets / 2)) : it.sets;
      return {
        slot: it.slot,
        tag: it.tag,
        ex: it.ex,
        target: { sets: n, min: it.min, max: it.max, rir: deload && it.rir !== '—' ? '3-4' : it.rir, rest: it.rest, ss: !!it.ss },
        sets: Array.from({ length: n }, () => ({ kg: '', reps: '', rir: '', ok: false })),
      };
    }),
  };
  state.workouts.push(w);
  save();
  if (deload) toast('Semaine de décharge : séries divisées par deux');
  go('#/session/' + w.id);
}

// ---------- Planning ----------
// Date prévue d'une séance pour la semaine commençant le lundi `mon` (null = retirée cette semaine)
export function plannedDate(tplId, mon) {
  const week = state.plan[mon];
  if (week && tplId in week) return week[tplId];
  const t = state.templates[tplId];
  return t ? addDays(mon, t.day - 1) : null;
}
export function setPlanned(tplId, mon, date) {
  (state.plan[mon] ||= {})[tplId] = date;
  // inutile de garder un « déplacement » vers le jour habituel
  if (date && date === addDays(mon, state.templates[tplId].day - 1)) delete state.plan[mon][tplId];
  if (!Object.keys(state.plan[mon]).length) delete state.plan[mon];
  save();
}
export function snapshotPlan(mon) {
  return state.plan[mon] ? { ...state.plan[mon] } : null;
}
export function restorePlan(mon, snap) {
  if (snap) state.plan[mon] = snap; else delete state.plan[mon];
  save();
}

// Séance faite pendant la semaine de `date`
export function doneInWeek(tplId, date) {
  const mon = mondayOf(date), sun = addDays(mon, 6);
  return state.workouts.find((w) => w.done && w.tpl === tplId && w.date >= mon && w.date <= sun) || null;
}

// Séances encore à faire cette semaine : [{tpl, date}]
export function pendingInWeek(mon) {
  const sun = addDays(mon, 6);
  const cur = inProgress();
  return templatesSorted()
    .map((t) => ({ tpl: t, date: plannedDate(t.id, mon) }))
    .filter(({ tpl, date }) => date && !doneInWeek(tpl.id, mon) && !(cur && cur.tpl === tpl.id && cur.date >= mon && cur.date <= sun));
}
export function plannedCount(mon) {
  return templatesSorted().filter((t) => plannedDate(t.id, mon) || doneInWeek(t.id, mon)).length;
}
