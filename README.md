# CoC7 – Suivi de Poursuites

Module compagnon de **CoC7 – Suivi de Chance**, **Santé Mentale** et
**Bonds du groupe**, même style Art Déco, pour Foundry VTT (V13/V14) +
système **CoC7**.

## ⚠️ Important : système original, pas une reproduction des règles officielles

Ce module **n'implémente pas** les règles de poursuite du manuel du
Gardien CoC7 (contenu protégé par le droit d'auteur de Chaosium). C'est
un système maison, simplifié, pensé pour être compatible avec n'importe
quelle poursuite (1933 ou moderne, à pied ou en voiture) sans dépendre
d'un tableau précis. Les seuils par défaut (±1 point pour un obstacle
mineur, ±2 pour un majeur) sont des valeurs de départ que tu peux ajuster
librement selon tes propres règles de table.

## Ce qu'il fait

Ajoute un bouton (icône compteur de vitesse) dans la barre de contrôles
à gauche de l'écran, dans le groupe **Jeton**. Un clic ouvre/ferme un
tableau de poursuite :

- **Bascule mode** : À pied / En voiture — change les suggestions de
  compétences pour les obstacles (indicatif).
- **Bascule époque** : 1933 / Moderne — cosmétique, aucun effet sur les
  calculs, mais change les idées d'obstacles proposées.
- **Jauge d'écart** : de 0 (rattrapé) à 10 (échappé) par défaut, avec
  boutons +/- pour un ajustement manuel rapide.
- **Glisser-déposer** : fais glisser un acteur directement depuis la
  barre latérale Foundry vers la colonne "Poursuivants" ou "Poursuivis"
  pour l'ajouter avec son portrait et son nom. Tu peux aussi glisser une
  carte déjà présente d'une colonne à l'autre pour changer son rôle en
  cours de poursuite.
- **Ajout manuel** : pour les PNJ sans fiche ou les véhicules (Personnage
  / Véhicule), avec un nom, un rôle et une valeur de Mouvement facultative.
- **Obstacle** : pour chaque participant, choisis une compétence (Chance
  suggérée par défaut, champ libre), la sévérité (mineur/majeur), puis
  Réussite ou Échec — l'écart s'ajuste automatiquement et l'action est
  notée dans le journal.
- **🍀 Jet de Chance automatisé** : disponible pour tout participant
  ajouté par glisser-déposer (donc lié à une vraie fiche). Un clic lance
  réellement 1d100 dans Foundry, compare au score de Chance de l'acteur,
  poste le résultat dans le chat, et résout l'obstacle tout seul.
- **Idées d'obstacles** : panneau dépliable avec des suggestions
  originales (à pied/en voiture, 1933/moderne) pour improviser sans
  réfléchir — ce ne sont pas des règles officielles, juste des amorces
  narratives.
- **Journal de poursuite** : historique des 25 dernières actions.

## Installation

1. Décompressez le dossier `coc7-chase-tracker` dans
   `[DonnéesFoundry]/Data/modules/coc7-chase-tracker`
2. Activez-le dans **Configuration du monde → Gérer les modules**.
3. Le bouton apparaît dans le groupe d'outils "Jeton", à côté des autres
   modules de la suite CoC7 si installés.

## Comment l'utiliser en jeu

1. Avant la scène de poursuite, ajoute les participants (PJ et
   antagonistes) avec leur rôle.
2. Chaque round, fais rouler normalement les joueurs sur leur fiche
   (comme d'habitude dans Foundry), puis reporte le résultat dans le
   module via le bouton Réussite/Échec du participant concerné.
3. Regarde la jauge : à 0 c'est du corps-à-corps/collision, à 10 c'est
   l'échappée.

## Personnalisation rapide

- **Ampleur des écarts** : dans `scripts/chase-tracker.js`, fonction
  `recordObstacle`, ajuste la variable `magnitude`.
- **Longueur de la jauge** : `DEFAULT_STATE.maxGap` (10 par défaut).
- **Rendre le bouton visible aux joueurs** : ligne
  `visible: game.user.isGM,` → `visible: true,`.
- **Couleurs** : variables CSS en tête de `styles/chase-tracker.css`.
