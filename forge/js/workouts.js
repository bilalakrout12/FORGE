// Création / gestion des séances.
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
    if (!confirm(`Une séance est déjà en cours (${cur.name}). La reprendre ?\n\nAnnuler = l'abandonner et commencer la nouvelle.`)) {
      if (!confirm('Supprimer la séance en cours et ses séries ?')) return;
      state.workouts = state.workouts.filter((w) => w !== cur);
    } else {
      go('#/session/' + cur.id);
      return;
    }
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

// La séance prévue `tplId` a-t-elle été faite pendant la semaine de `date` ?
export function doneInWeek(tplId, date) {
  const mon = mondayOf(date), sun = addDays(mon, 6);
  return state.workouts.find((w) => w.done && w.tpl === tplId && w.date >= mon && w.date <= sun) || null;
}
