# Forge – Muscu & Nutrition (V2)

Web-app installable sur iPhone (PWA). Une fois installée, elle s'ouvre comme une vraie app, fonctionne hors-ligne et garde toutes les données **sur le téléphone** (rien n'est envoyé sur un serveur).

## Fonctionnalités

**Semaine**
- Calendrier semaine par semaine avec les séances prévues (mardi, jeudi, vendredi), faites ou non faites, plus les calories et le poids de chaque jour.
- Maintiens une séance prévue pour la faire glisser sur un autre jour, ou vers la poubelle qui apparaît en bas pour la retirer de la semaine. Un bouton « Annuler » permet de revenir en arrière. Le changement ne vaut que pour la semaine affichée ; les jours habituels se règlent dans Profil.
- Une séance en cours reste accessible depuis tous les écrans, dans la barre sombre au-dessus des onglets.
- Semaine de décharge automatique (toutes les 7 semaines par défaut) ou manuelle : séries divisées par deux, RIR 3-4.

**Séance**
- Saisie charge / répétitions / RIR série par série, valeurs préremplies d'après la dernière séance.
- Suggestion de charge automatique (double progression) : quand le haut de la fourchette est atteint sur toutes les séries, l'app propose +2,5 kg (ou l'incrément adapté à l'exercice).
- Minuteur de repos qui démarre seul quand tu coches une série (bip, vibration si dispo, ±15 s). Gère les supersets.
- Menu ⋯ de chaque exercice : 3 à 4 exercices équivalents proposés, pour la séance seulement ou définitivement, plus tous les autres exercices du même muscle.
- Fiche conseils par exercice, séries d'échauffement calculées, calculateur de disques par côté.
- Modification des objectifs (séries, fourchette, RIR, repos), ajout/retrait d'exercices.
- Validation de fin de séance : durée, tonnage, records battus, ressenti, notes.
- Écran maintenu allumé pendant la séance.

**Suivi**
- Courbe de progression par exercice (1RM estimé, ou cm pour les sauts).
- Séries par muscle et par semaine comparées à la zone efficace (10-20).
- Records, régularité, tonnage, historique complet (séances modifiables).

**Nutrition**
- Scan de code-barres → fiche produit Open Food Facts (avec Nutri-Score).
- Recherche dans une base locale (~170 aliments courants dont une trentaine de fromages) et en ligne sur Open Food Facts.
- Création d'aliments perso (reconnus au prochain scan), favoris, récents, ajout rapide en kcal, copie des repas d'hier, suivi de l'eau.
- Idées de repas végétariens pour le prochain repas, calculées sur les calories et les protéines qu'il reste dans la journée : la portion est ajustée (de 0,5 à 1,75) et les plats riches en protéines passent devant quand il en manque. Les idées changent chaque jour et évitent ce que tu as mangé ces derniers jours.
- 70 recettes végétariennes (œufs et laitages inclus) avec ingrédients, quantités ajustées à la portion et étapes. Valeurs calculées à partir des ingrédients. Filtres : rapide, riche en protéines, à préparer à l'avance.
- Mes plats : enregistre un plat que tu prépares souvent (ingrédients, nombre de portions, étapes), ou transforme en un geste les aliments notés pour un repas (« En faire un plat »). Une recette peut aussi être copiée dans tes plats pour l'adapter.
- Cible calorique et macros calculées depuis ton profil (Mifflin-St Jeor × activité, puis déficit selon l'objectif). La cible suit ta moyenne de poids, et s'ajuste sur ta dépense réelle mesurée dès que tu as 14 jours de repas notés + 6 pesées sur 2 semaines.

**Corps**
- Poids quotidien avec moyenne glissante sur 7 jours, rythme en kg et %/semaine comparé à l'objectif.
- Mensurations (bras, avant-bras, épaules, poitrine, taille, hanches, cuisse, mollet, cou, % de gras de la balance) avec courbes et bilan.
- Estimation du taux de masse grasse (formule US Navy), masse maigre, FFMI, lecture « la recomposition fonctionne ou pas ».
- Photos de progression (face, profil, dos) avec comparaison côte à côte.

**Profil**
- Infos perso, objectif (recomposition, sèche, maintien, prise de masse), protéines g/kg, ajustement manuel.
- Jours d'entraînement modifiables, fréquence de décharge, poids de la barre, son.
- Export / import d'une sauvegarde JSON.

## Mettre l'app en ligne sur GitHub Pages (5 minutes, sans ligne de commande)

1. Crée un compte sur [github.com](https://github.com) si tu n'en as pas.
2. Bouton **New repository** → nom : `forge` (ou ce que tu veux) → **Public** → **Create repository**.
3. Sur la page du dépôt vide, clique **uploading an existing file**.
4. Dézippe l'archive sur ton ordinateur, puis glisse **le contenu** du dossier (index.html, sw.js, manifest.webmanifest, et les dossiers css, js, icons) dans la page. Attention : glisse les fichiers et dossiers, pas le dossier parent.
5. **Commit changes**.
6. **Settings** → **Pages** → Source : **Deploy from a branch** → Branch : **main** / **(root)** → **Save**.
7. Attends 1 à 2 minutes : l'adresse s'affiche en haut de la page Pages, du type `https://ton-pseudo.github.io/forge/`.

Le dépôt doit être public pour GitHub Pages en compte gratuit. Le code est visible, mais **tes données ne le sont pas** : elles restent dans ton iPhone.

## Installer sur l'iPhone

1. Ouvre l'adresse dans **Safari** (obligatoire, pas Chrome).
2. Bouton **Partager** → **Sur l'écran d'accueil** → **Ajouter**.
3. Lance l'app depuis l'icône Forge. Elle s'ouvre en plein écran et marche sans réseau (sauf scan et recherche en ligne).

## Mettre à jour une installation existante

1. Sur GitHub, ouvre le dossier qui contient l'app (chez toi : `forge`).
2. **Add file** › **Upload files**, puis glisse tout le contenu du zip : index.html, sw.js, manifest.webmanifest, README.md et les dossiers css, js, icons, fonts.
3. **Commit changes**. Les fichiers du même nom sont remplacés, tes données sur l'iPhone ne bougent pas.
4. Sur l'iPhone, ferme Forge complètement puis rouvre-la : la nouvelle version s'installe et l'app se recharge d'elle-même.

## Design

- Palette « fonte et craie » : fond gris craie, encre gris fonte. Les couleurs des disques de compétition sont réservées à l'information : bleu (20 kg) pour les actions, rouge (25 kg) pour la suppression et les écarts négatifs, jaune (15 kg) pour les records, vert (10 kg) pour ce qui est fait ou en progrès.
- Chiffres et titres en Big Shoulders (licence OFL, fichier `fonts/OFL.txt`), le reste dans la police système de l'iPhone.
- Mode sombre automatique, qui suit le réglage de l'iPhone.

## Bon à savoir

- **Yuka n'a pas d'API publique.** L'app utilise Open Food Facts, la base libre et gratuite que Yuka a lui-même utilisée à ses débuts. La plupart des produits de supermarché y sont. Si un produit manque, crée-le depuis l'étiquette : il sera reconnu au prochain scan.
- **Caméra :** iOS peut redemander l'autorisation d'accès à la caméra à chaque lancement de l'app. C'est un comportement d'iOS. Le lecteur de code-barres est téléchargé au premier scan, il faut donc du réseau la première fois.
- **Sauvegarde :** si tu supprimes l'icône de l'écran d'accueil, les données sont effacées. Exporte une sauvegarde de temps en temps (Profil › Exporter → Enregistrer dans Fichiers). Les photos ne sont pas incluses dans la sauvegarde.
- **Bip du minuteur :** il ne sonne pas si l'iPhone est en mode silencieux. Le minuteur continue même écran verrouillé, mais l'alerte s'affiche au retour dans l'app.
- **Valeurs nutritionnelles :** la base locale contient des moyennes. Pour un produit précis, scanne-le.

## Modifier l'app

- Programme par défaut : `js/data/program.js`
- Exercices et alternatives : `js/data/exercises.js`
- Aliments de base : `js/data/foods.js`
- Après chaque modification, change `VERSION` en haut de `sw.js` (par exemple `forge-v2.0.1`), sinon l'iPhone peut garder l'ancienne version en cache. La nouvelle version s'active au lancement suivant.

Tester sur ordinateur : `python3 -m http.server` dans le dossier, puis ouvrir http://localhost:8000.
