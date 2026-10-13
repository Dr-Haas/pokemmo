# Jouer à trois (web + mobile)

Version modifiée de PokeMMO pour jouer entre nous, sur ordinateur ou téléphone.

## Ce qui a changé

- **Mobile** : croix directionnelle, boutons A / B / START à l'écran (affichés seulement sur écran tactile). Le jeu s'adapte à la taille de l'écran, en paysage (plein écran) comme en portrait (style Game Boy).
- **Nom de dresseur** : demandé à la première ouverture, affiché au-dessus de chaque joueur et dans le menu.
- **Partie privée** : avec la variable `GAME_CODE`, seuls ceux qui ont le lien `...?code=XXX` peuvent rejoindre.
- **Une seule adresse** : le serveur Node sert aussi le jeu, donc un seul déploiement.
- **Installable** sur l'écran d'accueil du téléphone (PWA).
- Multi corrigé : position réelle envoyée à l'arrivée (on se voit au bon endroit même en reprenant une sauvegarde sur une autre carte), position finale envoyée à l'arrêt, joueurs séparés par salle.

Contrôles clavier inchangés : flèches, `Z` (A), `X` (B), `Entrée` (START).

## Lancer en local

```bash
cd server && npm install && node server.js          # terminal 1
cd client && npm install && npm start               # terminal 2, ouvre http://localhost:8080
```

Pour tester sur un téléphone du même Wi-Fi : `http://<ip-de-ton-ordi>:8080`.

## Mettre en ligne (Render, gratuit)

1. Pousser ce dossier sur un dépôt GitHub **privé** à toi.
2. Sur render.com : *New > Blueprint*, choisir le dépôt. Le fichier `render.yaml` configure tout (Docker, offre gratuite, code de partie généré).
3. Une fois déployé, récupérer la valeur de `GAME_CODE` dans *Environment*.
4. Envoyer à ton frère et ton cousin : `https://<ton-app>.onrender.com/?code=<GAME_CODE>`

Le code est mémorisé sur leur téléphone après la première ouverture.

À savoir sur l'offre gratuite : le serveur s'endort après 15 min sans joueur, le premier qui se connecte attend environ 1 minute le temps du réveil. L'offre à 7 $/mois supprime ça. Fly.io ou Railway marchent aussi avec le même `Dockerfile`.

## Installer sur le téléphone

- **iPhone (Safari)** : bouton Partager > *Sur l'écran d'accueil*.
- **Android (Chrome)** : menu ⋮ > *Installer l'application*.

Le jeu s'ouvre alors en plein écran, comme une app.

## Bon à savoir

- Au tout premier lancement, le jeu télécharge le Pokédex depuis PokeAPI (environ 300 requêtes, 20 à 40 s). Ensuite c'est en cache sur l'appareil.
- Garder le dépôt et le lien privés : les noms et sprites de Pokémon appartiennent à Nintendo / The Pokémon Company.

## Variables du serveur

| Variable | Rôle |
| --- | --- |
| `PORT` | Port d'écoute (3000 par défaut, fourni par l'hébergeur) |
| `GAME_CODE` | Code de partie privée. Vide = partie ouverte à tous |
| `MONITOR` | `1` pour activer la console d'admin Colyseus sur `/colyseus` |
| `OPENAI_API_KEY`, `MOLROO_API_KEY` | Optionnels : dialogues IA des PNJ |
