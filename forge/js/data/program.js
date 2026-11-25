// Programme par défaut : mardi / jeudi / vendredi.
// day : jour de la semaine (1 = lundi … 7 = dimanche)
// tag : numéro affiché (A = explosivité, 4a/4b = superset)
// rest: repos en secondes après la série (0 = enchaîner avec l'exercice suivant du superset)

export const DEFAULT_TEMPLATES = {
  mardi: {
    id: 'mardi', code: 'A', name: 'Full body force', day: 2,
    items: [
      { slot: 'ma_explo', tag: 'A', ex: 'box_jump', alts: ['saut_vertical', 'squat_jump', 'saut_longueur'], sets: 3, min: 3, max: 3, rir: '—', rest: 75 },
      { slot: 'ma_squat', tag: '1', ex: 'squat', alts: ['front_squat', 'hack_squat', 'presse', 'squat_smith'], sets: 4, min: 4, max: 6, rir: '2', rest: 180 },
      { slot: 'ma_dc', tag: '2', ex: 'dc_barre', alts: ['dc_halteres', 'dc_smith', 'dc_machine', 'di_barre'], sets: 4, min: 4, max: 6, rir: '1-2', rest: 180 },
      { slot: 'ma_row', tag: '3', ex: 'rowing_barre', alts: ['rowing_appuye', 'rowing_haltere', 'rowing_poulie', 'pendlay'], sets: 3, min: 6, max: 8, rir: '1-2', rest: 120 },
      { slot: 'ma_bi', tag: '4a', ex: 'curl_incline', alts: ['curl_bayesian', 'curl_pupitre', 'curl_ez', 'curl_marteau'], sets: 3, min: 10, max: 12, rir: '0-1', rest: 0, ss: true },
      { slot: 'ma_tri', tag: '4b', ex: 'ext_poulie_tete', alts: ['ext_haltere_tete', 'barre_front', 'pushdown'], sets: 3, min: 10, max: 12, rir: '0-1', rest: 90, ss: true },
    ],
  },
  jeudi: {
    id: 'jeudi', code: 'B', name: 'Haut du corps', day: 4,
    items: [
      { slot: 'je_explo', tag: 'A', ex: 'medball_mur', alts: ['pompes_explo', 'medball_slam'], sets: 3, min: 5, max: 5, rir: '—', rest: 60 },
      { slot: 'je_di', tag: '1', ex: 'di_halteres', alts: ['di_barre', 'di_smith', 'di_machine', 'dc_halteres'], sets: 3, min: 6, max: 10, rir: '1-2', rest: 150 },
      { slot: 'je_trac', tag: '2', ex: 'tractions', alts: ['tirage_large', 'tirage_neutre', 'tractions_assist', 'tirage_uni'], sets: 3, min: 6, max: 10, rir: '1-2', rest: 150 },
      { slot: 'je_row', tag: '3', ex: 'rowing_haltere', alts: ['rowing_appuye', 'rowing_poulie', 'tbar', 'seal_row'], sets: 3, min: 8, max: 12, rir: '1', rest: 90 },
      { slot: 'je_lat', tag: '4', ex: 'elev_lat_poulie', alts: ['elev_lat_halteres', 'elev_lat_machine', 'elev_lat_penche'], sets: 4, min: 12, max: 15, rir: '0-1', rest: 60 },
      { slot: 'je_dips', tag: '5a', ex: 'dips', alts: ['ecarte_poulie', 'pec_deck', 'ecarte_halteres', 'pompes_lestees'], sets: 3, min: 8, max: 12, rir: '1', rest: 0, ss: true },
      { slot: 'je_fp', tag: '5b', ex: 'face_pull', alts: ['oiseau', 'reverse_pec', 'pull_apart'], sets: 3, min: 12, max: 15, rir: '1', rest: 90, ss: true },
    ],
  },
  vendredi: {
    id: 'vendredi', code: 'C', name: 'Bas du corps', day: 5,
    items: [
      { slot: 've_explo', tag: 'A', ex: 'saut_longueur', alts: ['box_jump', 'saut_vertical', 'squat_jump'], sets: 3, min: 3, max: 3, rir: '—', rest: 75 },
      { slot: 've_rdl', tag: '1', ex: 'rdl', alts: ['rdl_halteres', 'good_morning', 'deadlift', 'back_ext'], sets: 4, min: 5, max: 8, rir: '2', rest: 180 },
      { slot: 've_bulg', tag: '2', ex: 'bulgare', alts: ['presse', 'hack_squat', 'fentes_marchees', 'goblet'], sets: 3, min: 8, max: 10, rir: '1-2', rest: 120 },
      { slot: 've_curl', tag: '3', ex: 'leg_curl_assis', alts: ['leg_curl_allonge', 'nordic', 'leg_curl_debout'], sets: 3, min: 10, max: 12, rir: '0-1', rest: 90 },
      { slot: 've_ext', tag: '4', ex: 'leg_ext', alts: ['leg_ext_uni', 'sissy', 'reverse_nordic'], sets: 3, min: 12, max: 15, rir: '0-1', rest: 75 },
      { slot: 've_mol', tag: '5', ex: 'mollets_debout', alts: ['mollets_presse', 'mollets_smith', 'mollets_uni'], sets: 3, min: 10, max: 15, rir: '0-1', rest: 60 },
    ],
  },
};

export const DAY_NAMES = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const DAY_SHORT = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
