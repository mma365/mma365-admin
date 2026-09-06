# Ligne éditoriale MMA365

> Document de référence pour la création d'articles — humaine ou assistée.
> Sert de contexte au pipeline de génération et à l'assistant IA de l'éditeur admin.

## Identité

MMA365 raconte **tout le MMA, pas seulement l'UFC**, à un public francophone qui n'a
ni le temps ni l'envie de suivre 15 sites spécialisés. KSW, Cage Warriors, PFL, ONE
sont traités avec le même sérieux que l'UFC — c'est le créneau que personne n'occupe
en français.

Deux piliers, aucune opinion :

1. **La data que personne n'a** — la DB MMA365 (historiques complets, rankings,
   séries, méthodes de victoire) fournit des faits chiffrés que même la presse MMA
   ne compile pas.
2. **Le storytelling factuel** — on raconte des histoires (comeback, revanche,
   ascension), mais chaque phrase repose sur un fait vérifiable. Jamais d'avis,
   jamais de pronostic, jamais de spéculation.

## Lecteur type

**Le fan casual.** Il regarde quelques events par an, connaît les stars de l'UFC,
pas les rosters KSW ou CW. Conséquences :

- L'enjeu doit être compréhensible **sans prérequis** — on donne toujours le contexte
  (qui est ce fighter, pourquoi ce combat compte) sans être condescendant.
- Pas de jargon non expliqué. « Décision partagée », « finish », « main event » : oui.
  Acronymes obscurs et références pointues sans contexte : non.
- **L'accroche n°1 est l'histoire humaine** : on ouvre sur la trajectoire, pas sur
  la fiche technique.

## Formats (lancement)

Rythme : **2 à 3 articles par semaine**, sujets proposés par le pipeline
(classés par popularity score et calendrier) et **validés dans l'admin**.

| Format | Longueur | Déclencheur | Contenu |
|---|---|---|---|
| **Preview d'event** | ~250 mots | J-2 / J-3 avant un event des orgs suivies | Pourquoi cet event vaut le coup, les 2-3 combats à suivre, heure locale et diffuseur FR (déjà en DB). |
| **Focus combat** | ~300 mots | Main event / title fight marquant | Un seul combat raconté : parcours croisés, enjeu, la stat clé. |
| **Portrait de fighter** | ~300-350 mots | Combat charnière à venir, exploit récent, entrée dans les rankings | La trajectoire — le format le plus storytelling. |

La longueur **varie d'un article à l'autre** à l'intérieur de ces cibles : l'uniformité
est le premier marqueur d'un texte généré.

## Titres

**Accrocheurs sans clickbait**, tournés vers l'histoire, façon presse sportive :

- ✅ « Invaincu chez lui, attendu au tournant : Gamrot face à son passé »
- ✅ « Trois ans après sa blessure, Dumont retrouve une cage samedi »
- ❌ « Vous ne devinerez jamais qui combat samedi » (clickbait)
- ❌ « KSW 105 : preview » (fiche technique, pas un titre)

Le titre promet une histoire que l'article tient. Jamais de question rhétorique en série.

## Signature

**« La rédaction MMA365 »** — signature collective, standard des médias sportifs.
On ne crée pas de faux auteurs individuels.

## Sources et hiérarchie

1. **La DB MMA365, lue intelligemment** — source de vérité et matière première du
   storytelling. Les histoires sont déjà dans les données, il faut les détecter :
   - 3 défaites puis 5 victoires → **comeback**
   - Même adversaire déjà affronté → **revanche** (vérifier le résultat du 1er combat)
   - 2 ans sans combat → **retour** (long layoff)
   - X victoires consécutives, X finishes → **série en cours**
   - Changement de catégorie de poids entre deux combats → **nouveau défi**
   - Fighter non classé face à un top 5 → **l'outsider**
   - Champion qui n'a plus défendu depuis longtemps → **le champion attendu**
   - Rankings (`ranking_boards` + `ranking_entries` : rang, tendance
     montée/descente, badge nouveau, champion par catégorie) → **l'enjeu sportif**
     (« le numéro 1 reçoit un invaincu », « il entre dans le top 10 », duel de
     classés, proximité d'une chance au titre)
2. **Presse MMA via RSS** (La Sueur en FR ; MMA Fighting, MMA Junkie en EN) —
   uniquement pour le contexte que la DB ignore : blessure avérée, changement de camp,
   déclaration marquante. **Chaque fait externe doit être vérifié avant publication**
   (relecture admin). Jamais de copie, jamais de rumeur.

Règle d'or anti-hallucination : **le générateur reçoit un dossier de faits fermé
(extrait de la DB + faits RSS vérifiés) et n'a pas le droit d'écrire en dehors.**
Un fait absent du dossier n'existe pas.

## Règles d'écriture (l'anti-« ça sent l'IA »)

1. **Chaque phrase s'appuie sur un fait du dossier** : record exact, dates, méthodes,
   adversaires, rankings. Un paragraphe sans fait précis est un paragraphe à couper.
2. **La data sert l'histoire, elle ne la remplace pas.** Une seule statistique
   marquante par article (deux maximum), choisie parce qu'elle raconte quelque chose.
   Le reste des faits s'écrit en mots, pas en chiffres : « invaincu depuis sept ans »
   plutôt que trois records alignés. Jamais de rafale de chiffres, jamais plus d'une
   comparaison de palmarès par article. Si le lecteur doit relire pour suivre qui a
   battu qui, l'article est raté.
3. **Interdits absolus** : « dans le monde du MMA », « il ne fait aucun doute »,
   « seul l'avenir nous le dira », « une chose est sûre », conclusions bateau,
   listes à puces dans le corps de l'article, emojis, superlatifs en série,
   pronostics, opinions, **et le tiret long (—) sous toutes ses formes** : les
   incises se font avec des virgules ou des parenthèses, ou deviennent des phrases.
4. **Varier** structure, accroche et longueur d'un article à l'autre : les gabarits
   tournent, deux articles consécutifs ne se ressemblent pas.
5. **Français naturel** : vocabulaire MMA tel qu'on le parle (KO, soumission,
   décision partagée, main event), pas de calques de l'anglais.
6. **La version EN est un article à part entière**, écrit pour un lecteur anglophone,
   pas une traduction mot à mot du FR.
7. Un article raconte **une histoire**, pas trois. L'angle est choisi avant
   la rédaction (voir bibliothèque d'angles ci-dessus) et tenu jusqu'au bout.

## Ce qu'on ne publie pas

- Rumeurs non sourcées, spéculations sur des blessures ou des signatures.
- Vie privée hors sport.
- Trash talk relayé sans contexte sportif.
- Pronostics et cotes.

## Déclinaison Instagram

Chaque article est un pack : **article app + article site + post Instagram**.
Le post Insta n'est pas un copier-coller de l'article, c'est sa version affiche :

- **Visuel** : carte au format 1080x1350 générée depuis un template aux couleurs
  MMA365 (fond sombre, accent #E8003D) : titre court, noms des fighters, date,
  organisation. Pas de photo de fighter tant qu'on n'a pas les droits d'image.
- **Caption** : l'accroche de l'article en 2-3 phrases courtes, percutantes mais
  factuelles (mêmes interdits que les articles : pas de pronostic, pas de tiret
  long, pas de rafale de chiffres). 1 emoji maximum. Se termine par un renvoi
  (« L'article complet sur MMA365 » / lien en bio) + 4-6 hashtags (#MMA #UFC/#PFL/
  #KSW selon l'org, #MMAFrance + le nom des fighters).
- La caption est stockée avec l'article (`insta_caption_fr` / `insta_caption_en`)
  et générée en même temps que lui ; la publication Instagram reste manuelle au
  début (copier depuis l'admin), automatisable plus tard via l'API Meta.

## Régularité : le rythme éditorial

Le calendrier des events dicte les sujets, les portraits comblent les creux :

- **Lundi** : après le passage des scrapers, le pipeline génère la short-list de
  la semaine (events du week-end à venir classés par popularité, fighters en forme)
  et les brouillons associés. Tout attend en `draft` dans l'admin.
- **Mardi ou mercredi** : publication n°1, un portrait ou un focus combat lié au
  week-end à venir.
- **Jeudi ou vendredi (J-2 de l'event principal)** : publication n°2, la preview
  du gros event du week-end. C'est elle qui déclenche la notification push.
- **Troisième créneau optionnel** selon l'actualité (deuxième event fort, entrée
  dans un ranking).
- Le post Insta part le jour de publication de son article.
- **Semaine creuse** : le portrait est le format joker, publiable sans actualité.

La régularité vient du calendrier MMA lui-même : il y a toujours un event à
prévisualiser. L'objectif de 2-3 publications tient tant que la relecture du
lundi/mardi est faite ; si une semaine saute, on ne rattrape pas, on reprend.

## Circuit de publication

1. **Génération** : le pipeline propose sujets + brouillons FR/EN + caption Insta
   (statut `draft`).
2. **Création manuelle** : éditeur libre dans l'admin avec assistant IA
   (suggérer un angle, reformuler, vérifier un fait contre la DB), page blanche
   ou brouillon généré comme point de départ.
3. **Relecture admin** : édition FR/EN + caption, puis publication.
4. **Diffusion par article (le pack)** : site web public (SEO) + post Instagram,
   + notification push quand le sujet s'y prête (preview → notif J-2, pointant vers
   la page event dans l'app). L'admin trace l'état de chaque canal
   (publié web / posté Insta).

> **App : reporté à une prochaine mise à jour.** Décision du 19/07/2026 : pas
> d'articles dans l'app au lancement. Quand ce sera le moment, l'approche validée
> est le placement contextuel (preview sur la page event, portrait sur la page
> fighter, focus sur la page fight) + bloc « À la une » sur la Home, sans onglet
> dédié. Prévoir une clé `articles_version` dans `app_meta` à ce moment-là.
