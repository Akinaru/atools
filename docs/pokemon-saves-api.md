# API Saves Pokémon (atools) : documentation pour un client Switch (.nro)

Ce document décrit l'API HTTP de l'app **Saves Pokémon** d'atools. Il sert à écrire un homebrew Nintendo Switch (`.nro`, libnx) qui sauvegarde les saves des jeux Pokémon installés sur la console vers le serveur atools.

Ce document se suffit à lui-même : aucun autre fichier n'est nécessaire pour implémenter le client.

---

## 1. Connexion

| Élément | Valeur |
| --- | --- |
| URL de base | `https://atools.akinaru.fr` (HTTPS obligatoire) |
| Préfixe de l'API | `/api/pokemon-saves` |
| Authentification | En-tête `X-API-Key: <clé>` (ou `Authorization: Bearer <clé>`) |
| Taille maximale d'une save | 64 Mo |
| Format des réponses | JSON UTF-8, sauf les téléchargements (binaire) |

La clé API est un secret. Lis-la depuis un fichier de configuration sur la carte SD, par exemple `sdmc:/config/atools-backup/config.ini` :

```ini
url=https://atools.akinaru.fr
api_key=xxxxxxxxxxxxxxxx
slot=switch
```

Ne mets jamais la clé dans le code et ne l'affiche jamais à l'écran.

**Vérifier que le serveur répond** : `GET /api/health` est public (sans clé) et renvoie `{"status":"ok"}`.

**Vérifier la clé** : `GET /api/pokemon-saves/games` renvoie `200` si la clé est bonne, `401` sinon.

---

## 2. Concepts

### Jeu

Chaque jeu a un **id** dans le catalogue (`shield`, `sword`, `legendsarceus`…). Les jeux Switch ont aussi un **title ID**, une chaîne de 16 caractères hexadécimaux.

Partout où l'API attend un jeu (`:game`), tu peux donner **l'un ou l'autre**. La comparaison des title IDs ignore la casse.

Jeux Switch connus aujourd'hui. Récupère toujours la liste à jour avec `GET /games` plutôt que de la coder en dur :

| id | Jeu | Title ID | Lecture auto côté serveur |
| --- | --- | --- | --- |
| `letsgopikachu` | Let's Go Pikachu | `010003F003A34000` | oui |
| `letsgoeevee` | Let's Go Évoli | `0100187003A36000` | oui |
| `sword` | Épée | `0100ABF008968000` | oui |
| `shield` | Bouclier | `01008DB008C2C000` | oui |
| `brilliantdiamond` | Diamant Étincelant | `0100000011D90000` | non (stockage seulement) |
| `shiningpearl` | Perle Scintillante | `010018E011D92000` | non (stockage seulement) |
| `legendsarceus` | Légendes Arceus | `01001F5010DFA000` | oui |
| `scarlet` | Écarlate | `0100A3D008C5C000` | non (stockage seulement) |
| `violet` | Violet | `01008F6008C5E000` | non (stockage seulement) |

« Lecture auto » veut dire que le site affiche le dresseur, l'équipe et les boîtes. Sans lecture auto, la save est quand même stockée et versionnée.

> Ces title IDs n'ont pas encore été vérifiés sur une vraie console. Si `GET /games` ne contient pas le title ID d'un jeu installé, ignore ce jeu et affiche un avertissement. Ne plante pas.

### Slot de backup

Un **slot** est un nom libre qui identifie « la » save de backup d'un jeu, par exemple `switch`.

- La paire (jeu, slot) désigne **une seule** save sur le serveur.
- Envoyer sur un slot existant **met à jour** cette save. Sur un slot nouveau, l'envoi la **crée**.
- Format : `^[A-Za-z0-9._-]{1,64}$`. Pas d'espace ni d'accent.
- Pour gérer plusieurs profils utilisateur de la Switch, utilise un slot par profil, par exemple `switch-max` ou `switch-<début de l'UID>`.

### Versions

Quand une save est écrasée, **l'ancien fichier est conservé** (les 10 dernières versions). Si tu renvoies exactement le même fichier (même SHA-256), rien ne change et la réponse vaut `"status": "unchanged"`.

Le client n'a donc aucun risque de détruire une save côté serveur.

### Format du fichier envoyé

Une save Switch est un **dossier**. Le client doit l'envoyer en **archive ZIP** :

- **Chemins** : relatifs, avec `/` comme séparateur (par exemple `main`, `backup`, `sub/xyz.bin`). Le dossier racine est facultatif.
- **Compression** : *stored* (0) ou *deflate* (8). ZIP64 et chiffrement ne sont pas supportés.
- **Fichier principal** : pour la lecture auto, le serveur cherche `main` (Épée/Bouclier, Arceus) ou `savedata.bin` (Let's Go) par nom de fichier, à n'importe quelle profondeur. À défaut, il prend le plus gros fichier.

**Rends le ZIP déterministe** : même contenu, mêmes octets. Le serveur compare le SHA-256 du fichier envoyé, et le client compare le sien à celui du serveur. Pour cela :
- trie les entrées par chemin ;
- fixe la date de chaque entrée (par exemple 1980-01-01 00:00:00) ;
- utilise toujours la même méthode et le même niveau de compression ;
- n'ajoute ni commentaire ni champ *extra*.

Sans ça, chaque backup créerait une nouvelle version alors que rien n'a changé.

---

## 3. Endpoints

Toutes les routes sont préfixées par `/api/pokemon-saves` et demandent la clé API.

### 3.1 `GET /games`

Catalogue des jeux.

```json
[
  {
    "id": "shield",
    "name": "Pokémon Bouclier",
    "gen": 8,
    "platform": "Nintendo Switch",
    "year": 2019,
    "autoRead": true,
    "switchTitleId": "01008DB008C2C000"
  }
]
```

`switchTitleId` vaut `null` pour les jeux qui ne sont pas sur Switch.

### 3.2 `GET /backups`

Liste des saves qui ont un slot, avec ce qu'il faut pour savoir si un envoi est utile.

```json
[
  {
    "id": "66b49866-31f0-45f1-bb2b-6fee2bb7f2b5",
    "game": "shield",
    "slot": "switch",
    "sha256": "2e0da51815a23cf9…(64 caractères hex minuscules)",
    "size": 1572864,
    "fileDate": "2026-10-14T16:12:00.000Z",
    "updatedAt": "2026-10-14T16:12:03.512Z",
    "versions": 2
  }
]
```

`game` est **l'id** du catalogue, jamais le title ID. Pour retrouver le jeu d'un title ID, passe par `GET /games`.

### 3.3 `PUT /backups/:game/:slot` (route principale du client)

Crée ou met à jour la save du slot.

- `:game` : id du catalogue ou title ID Switch.
- `:slot` : nom du slot (voir le format plus haut).

**Corps, option A (recommandée) : binaire brut.**
- En-tête `Content-Type: application/octet-stream`.
- Corps : les octets du ZIP.
- Paramètres d'URL facultatifs :

| Paramètre | Exemple | Rôle |
| --- | --- | --- |
| `filename` | `Bouclier.zip` | Nom affiché et utilisé au téléchargement (défaut `save.bin`) |
| `modified` | `1760458320000` ou `2026-10-14T16:12:00Z` | Date de la save sur la console, en ms epoch ou ISO 8601 (défaut : maintenant) |
| `label` | `Bouclier` | Nom affiché, utilisé seulement à la création (défaut : le nom du slot) |

**Corps, option B : `multipart/form-data`.**
- Champ `file` : le fichier.
- Champs facultatifs : `label` et `fileDate` (même format que `modified`).

**Réponses :**

| Code | `status` | Sens |
| --- | --- | --- |
| `201` | `created` | Nouvelle save créée pour ce slot |
| `200` | `updated` | Save remplacée, l'ancienne est gardée en version |
| `200` | `unchanged` | Fichier identique à l'actuel, rien n'a été fait |
| `400` | – | Jeu inconnu, slot invalide, fichier vide ou trop gros |
| `401` | – | Clé absente ou invalide |

Exemple de corps de réponse :

```json
{
  "status": "updated",
  "save": {
    "id": "66b49866-31f0-45f1-bb2b-6fee2bb7f2b5",
    "game": { "id": "shield", "name": "Pokémon Bouclier" },
    "label": "switch",
    "slot": "switch",
    "fileName": "Bouclier.zip",
    "size": 1572864,
    "sha256": "2e0da518…",
    "fileDate": "2026-10-14T16:12:00.000Z",
    "uploadedAt": "2026-10-10T09:00:00.000Z",
    "updatedAt": "2026-10-14T16:12:03.512Z",
    "versions": 2,
    "trainer": "Maxou",
    "money": 67180,
    "playTime": { "hours": 13, "minutes": 53 },
    "location": null,
    "badges": 5,
    "party": [
      { "dex": 25, "species": "Pikachu", "nickname": "Pika", "otName": "Maxou", "level": 42, "shiny": false, "egg": false }
    ],
    "url": "/apps/pokemon-saves/save/66b49866-31f0-45f1-bb2b-6fee2bb7f2b5"
  }
}
```

Les champs `trainer`, `money`, `playTime`, `location`, `badges` et `party` valent `null` ou `[]` quand le serveur ne sait pas lire le jeu. Le client peut afficher `trainer` et `party` en résumé après l'envoi ; ce n'est pas obligatoire.

Les envois concurrents sur le même slot sont sérialisés côté serveur, sans créer de doublon. Rester séquentiel (un jeu à la fois) suffit quand même et ménage la mémoire de la Switch.

### 3.4 Autres routes (facultatives pour le client)

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/saves` (`?game=shield`, `?slot=switch`) | Liste des saves avec leur résumé (même objet que `save` ci-dessus) |
| POST | `/saves` | Ajoute une **nouvelle** save, même corps que 3.3. Le jeu se donne par `game` ou `titleId` (en paramètre d'URL ou en champ multipart), avec `slot` en option. Répond `201`. |
| GET | `/saves/:id` | Détail complet : en plus, `trainerId`, `rival`, `pokedex`, `boxes`, `versions` (tableau), `warnings`, `parseError` |
| PUT | `/saves/:id` | Écrase le fichier d'une save précise (même corps que 3.3). Répond `200` `updated` ou `unchanged`, ou `404`. |
| GET | `/saves/:id/file` | Télécharge le fichier actuel (`application/octet-stream`) |
| GET | `/saves/:id/versions/:version/file` | Télécharge une ancienne version (`:version` vient de `versions[].id` dans le détail) |
| DELETE | `/saves/:id` | Supprime la save et ses versions (`204`) |

Une fonction « restaurer » est possible : `GET /saves/:id/file`, puis réécrire le dossier de save sur la console. **N'implémente pas l'écriture sur la console sans confirmation explicite de l'utilisateur.**

---

## 4. Erreurs

Toute erreur renvoie un JSON `{ "error": "message en français" }`.

| Code | Cas |
| --- | --- |
| `400` | Paramètre invalide : jeu inconnu, slot invalide, fichier vide ou de plus de 64 Mo, champ `file` manquant |
| `401` | Clé API absente ou invalide |
| `404` | Save, version ou route inconnue |
| `405` | Méthode non autorisée sur cette route |
| `500` | Erreur serveur : réessayer plus tard |

Pour le client :
- **401** : arrête tout et indique « clé API invalide ».
- **400** : passe au jeu suivant et note l'erreur.
- **5xx et erreurs réseau** : réessaie 2 fois, avec 2 puis 5 secondes d'attente.

---

## 5. Algorithme recommandé pour le .nro

```
1. Lire la config (url, api_key, slot). Initialiser le réseau (socketInitializeDefault) et libcurl.
2. GET /api/pokemon-saves/games         → table titleId (majuscules) → id du jeu.
   401 → afficher « clé API invalide », quitter.
3. GET /api/pokemon-saves/backups       → table (game, slot) → sha256.
4. Choisir le profil utilisateur (pselShowUserSelector ou accountGetPreselectedUser).
5. Pour chaque jeu installé dont le title ID est dans la table de l'étape 2 :
     a. Monter la save du profil : fsdevMountSaveData("save", titleId, uid).
        Échec (pas de save pour ce profil) → « aucune save », jeu suivant.
     b. Zipper tout le contenu de save:/ en ZIP déterministe (voir §2), en mémoire ou dans un fichier temporaire sur la SD.
     c. Démonter (fsdevUnmountDevice).
     d. Calculer le SHA-256 du ZIP (mbedtls, ou sha256CalculateHash de libnx).
        Égal au sha256 connu pour (id, slot) → « à jour », jeu suivant.
     e. PUT /api/pokemon-saves/backups/<titleId>/<slot>?filename=<id>.zip&modified=<ms>
        En-têtes : X-API-Key, Content-Type: application/octet-stream. Corps : le ZIP.
     f. Afficher le résultat : created / updated / unchanged, ou l'erreur.
6. Afficher un récapitulatif : N envoyées, N à jour, N erreurs.
```

Notes d'implémentation :
- **TLS** : la Switch n'a pas les certificats racines de base. Embarque un `cacert.pem` dans romfs et donne-le à curl (`CURLOPT_CAINFO`). Ne désactive pas la vérification du certificat.
- **Content-Length** : envoie un corps de taille connue (`CURLOPT_POSTFIELDSIZE_LARGE` avec `CURLOPT_CUSTOMREQUEST "PUT"`, ou `CURLOPT_UPLOAD` avec `CURLOPT_INFILESIZE_LARGE`).
- **`modified`** : date de dernière modification la plus récente des fichiers de la save, en millisecondes epoch UTC. À défaut, l'heure courante.
- **Saves volumineuses** : celles d'Écarlate/Violet font plusieurs Mo. Préfère un fichier temporaire sur la SD plutôt que la RAM si besoin, et reste sous 64 Mo.
- **Ordre d'appel** : la séquence `GET /backups` puis `PUT` uniquement si le SHA diffère évite d'envoyer les saves inchangées. Même sans cette étape, renvoyer une save identique ne crée pas de version (réponse `unchanged`).

---

## 6. Exemples curl

```bash
BASE=https://atools.akinaru.fr/api/pokemon-saves
KEY=xxxxxxxx

# Catalogue
curl -H "X-API-Key: $KEY" $BASE/games

# Ce qui est déjà sauvegardé
curl -H "X-API-Key: $KEY" $BASE/backups

# Backup de Bouclier (dossier de save zippé) sur le slot "switch"
curl -X PUT -H "X-API-Key: $KEY" -H "Content-Type: application/octet-stream" \
  --data-binary @Bouclier.zip \
  "$BASE/backups/01008DB008C2C000/switch?filename=Bouclier.zip&modified=1760458320000"

# Même chose en multipart
curl -X PUT -H "X-API-Key: $KEY" -F file=@Bouclier.zip -F fileDate=1760458320000 \
  "$BASE/backups/shield/switch"
```
