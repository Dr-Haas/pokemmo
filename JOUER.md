# Jouer à trois (web + mobile)

Version modifiée de PokeMMO pour jouer entre nous, sur ordinateur ou téléphone.

## Ce qui a changé

- **Mobile** : croix directionnelle et boutons A / B à l'écran (affichés seulement sur écran tactile). Le jeu s'adapte à la taille de l'écran, en paysage (plein écran) comme en portrait (style Game Boy). Vérifié aux tailles iPhone 15, 16 Pro et 17 Pro Max.
- **Menu déroulant** : on touche la bande noire en haut de l'écran (onglet MENU), le menu descend. On peut toucher directement ses options.
- **Entre joueurs** : en s'approchant d'un autre joueur, une bulle « A ÉCHANGER » apparaît. A ouvre un menu : voir son **Pokédex** (vus, pris, équipe), voir ses **badges**, ou le **défier en combat**.
- **Combats PvP** : l'autre reçoit le défi et accepte ou refuse. Tour par tour, arbitré par le serveur pour que les deux écrans affichent la même chose. Attaque, changement de Pokémon, abandon. Les équipes sont soignées au début et rien n'est modifié après, comme les combats en link câble. Si un joueur se déconnecte, l'autre gagne.
- **Combats au doigt** : commandes, attaques, choix du Pokémon et messages se touchent directement (combats sauvages aussi).
- **Nom de dresseur** : demandé à la première ouverture, affiché au-dessus de chaque joueur et dans le menu.
- **Partie privée** : avec la variable `GAME_CODE`, seuls ceux qui ont le lien `...?code=XXX` peuvent rejoindre.
- **Une seule adresse** : le serveur Node sert aussi le jeu, donc un seul déploiement.
- **Installable** sur l'écran d'accueil du téléphone (PWA).
- Multi corrigé : position réelle envoyée à l'arrivée (on se voit au bon endroit même en reprenant une sauvegarde sur une autre carte), position finale envoyée à l'arrêt, joueurs séparés par salle.

Contrôles clavier inchangés : flèches, `Z` (A), `X` (B), `Entrée` (menu).

Limite connue : le serveur fait confiance aux statistiques envoyées par chaque joueur (il borne les valeurs, sans recalculer à partir du Pokédex). Pour jouer entre nous, ça suffit.

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

## Mettre en ligne (Hostinger VPS)

Le jeu a besoin d'un serveur Node qui tourne en continu avec des WebSockets : il faut un **VPS** Hostinger (KVM 1 suffit), pas l'hébergement web mutualisé.

1. Créer le VPS avec le modèle **Ubuntu 24.04 with Docker** (ou installer Docker : `curl -fsSL https://get.docker.com | sh`).
2. Chez le registrar du domaine : un enregistrement **A** `pokemmo.mondomaine.fr` → IP du VPS.
3. Sur le VPS :
   ```bash
   git clone <url-du-depot-prive> pokemmo && cd pokemmo
   cp .env.example .env
   nano .env            # DOMAIN=pokemmo.mondomaine.fr, GAME_CODE=$(openssl rand -hex 6)
                        # REDIRECT_FROM=www.pokemmo.mondomaine.fr (facultatif, redirigé vers DOMAIN)
   docker compose up -d --build
   ```
4. Ouvrir `https://pokemmo.mondomaine.fr/?code=<GAME_CODE>`. Caddy obtient le certificat HTTPS tout seul (ports 80 et 443 ouverts dans le pare-feu Hostinger).

Mettre à jour : `git pull && docker compose up -d --build`. Logs : `docker compose logs -f game`.

Les comptes et les sauvegardes sont dans le volume Docker `pokemmo_game_data` (fichier SQLite `pokemmo.db`). Copie de secours :
```bash
docker compose exec game sh -c 'cp /data/pokemmo.db /data/backup-$(date +%F).db'
```

## Installer sur le téléphone

- **iPhone (Safari)** : bouton Partager > *Sur l'écran d'accueil*.
- **Android (Chrome)** : bouton *Installer l'app* sur l'écran du nom, ou menu ⋮ > *Installer l'application*.

Le jeu s'ouvre alors en plein écran avec son icône, comme une app. L'écran du nom rappelle la marche à suivre sur iPhone. Chrome valide l'installabilité sans erreur (manifeste, icônes 180/192/512, service worker). Une nouvelle version déployée est prise au lancement suivant.

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
