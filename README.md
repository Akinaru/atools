# atools

Dashboard perso d'apps, interface style console. Next.js 16 (App Router, Cache Components) + Tailwind 4.

```bash
npm install
npm run dev      # http://localhost:3000
```

En local, sans variables d'environnement, tout est ouvert. Voir [Déploiement](#déploiement-coolify) pour la prod.

## Structure

```
src/
  app/                      Routes Next (génériques, aucune logique d'app ici)
    page.tsx                Écran d'accueil : une tuile par app
    apps/[slug]/[[...path]] UI d'une app        → /apps/<slug>/...
    api/route.ts            Index de l'API      → GET /api
    api/health              Healthcheck public  → GET /api/health
    api/[app]/[[...path]]   API d'une app       → /api/<slug>/...
  apps/
    types.ts                Contrat App (slug, nom, Page, api…)
    registry.ts             Liste des apps
    <slug>/                 Une app = un dossier, tout dedans (UI, API, serveur, données)
  components/console/       Kit d'interface console réutilisable
  lib/                      api.ts (routeur), auth.ts, storage.ts
  proxy.ts                  Mot de passe de l'interface web
public/assets/<slug>/       Images publiques d'une app
data/<slug>/                Fichiers d'une app (hors git, volume en prod)
```

## Créer une app

```bash
npm run new-app -- mon-app "Mon app"
```

La commande crée `src/apps/mon-app/` (`index.tsx` pour la page, `api.ts` pour l'API) et l'ajoute à `src/apps/registry.ts`.
L'app apparaît sur l'accueil, avec son UI sur `/apps/mon-app` et son API sur `/api/mon-app/...`.

| Champ de `App` | Rôle |
| --- | --- |
| `slug`, `name`, `description`, `icon`, `accent`, `cover` | Tuile d'accueil et URLs |
| `Page({ path })` | Composant serveur. `/apps/mon-app/a/b` donne `path = ["a", "b"]` |
| `api` | Liste de routes `{ method, path: "items/:id", description, handler }` |

- Fichiers : `appDataDir(slug, ...)` de `src/lib/storage.ts`.
- Helpers d'API : `json()` et `apiError()` de `src/lib/api.ts`.
- Kit console (`src/components/console/`) :
  - `NavGrid` : tuiles avec curseur.
  - `ConsoleTabs` : onglets L/R.
  - `KeyCap` et `playSound`.

| Action | Clavier | Manette |
| --- | --- | --- |
| Déplacer | flèches | croix ou stick |
| Valider | Entrée | A |
| Retour | Échap | B |
| Onglets | Q / E | L / R |

## API

Toutes les routes, sauf `/api/health`, demandent la clé `ATOOLS_API_KEY`. Elle s'envoie de deux façons :
- `Authorization: Bearer <clé>` ;
- `X-API-Key: <clé>`.

Le navigateur connecté avec le mot de passe de l'interface y a aussi accès.

`GET /api` liste toutes les routes de toutes les apps. `GET /api/<slug>` liste celles d'une app.

### Saves Pokémon (`/api/pokemon-saves`)

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/games` | Catalogue des jeux, avec les title IDs Switch |
| GET | `/saves` (`?game=black`) | Saves avec leur résumé |
| POST | `/saves` | Envoi d'une save |
| GET | `/saves/:id` | Détail : équipe, boîtes, badges, Pokédex |
| GET | `/saves/:id/file` | Fichier original |
| DELETE | `/saves/:id` | Suppression |

Il y a deux façons d'envoyer une save. La plus simple pour un homebrew Switch est le corps binaire brut, avec le jeu donné par son title ID :

```bash
curl -X POST "https://atools.example.com/api/pokemon-saves/saves?titleId=01008DB008C2C000&filename=main&label=Bouclier" \
  -H "X-API-Key: $ATOOLS_API_KEY" --data-binary @main
```

L'autre est le multipart, avec les champs `file`, `game` ou `titleId`, `label` et `fileDate` :

```bash
curl -X POST https://atools.example.com/api/pokemon-saves/saves \
  -H "Authorization: Bearer $ATOOLS_API_KEY" -F file=@Pokemon_Noir.sav -F game=black
```

Les jeux se désignent de deux façons :
- `game` : l'id du catalogue (`black`, `y`, `shield`…) ;
- `titleId` : le title ID Switch (Let's Go, Épée/Bouclier, DÉ/PS, Arceus, Écarlate/Violet).

`modified` / `fileDate` accepte des millisecondes ou une date ISO.

## Déploiement (Coolify)

Le `Dockerfile` produit une image autonome (Next `output: "standalone"`).

1. Coolify → *New Resource* → ton dépôt Git → build pack **Dockerfile**, port **3000**.
2. Variables d'environnement (voir `.env.example`) :
   - `ATOOLS_PASSWORD` : mot de passe de l'interface. Le nom d'utilisateur est libre.
   - `ATOOLS_API_KEY` : clé de l'API. Génère-la par exemple avec `openssl rand -hex 32`.
3. *Storages* : ajoute un volume persistant monté sur **`/app/data`**. C'est là que sont stockées les saves.
4. Healthcheck : `GET /api/health`. Il est déjà déclaré dans l'image.

En production, un secret manquant verrouille l'accès au lieu de l'ouvrir : la réponse est une 401.

Test en local :

```bash
docker build -t atools .
docker run -p 3000:3000 -v atools-data:/app/data -e ATOOLS_PASSWORD=… -e ATOOLS_API_KEY=… atools
```

## App : Saves Pokémon (`src/apps/pokemon-saves`)

| Dossier / fichier | Contenu |
| --- | --- |
| `games.ts` | Catalogue des 38 jeux : jaquettes, badges, title IDs Switch |
| `parsers/` | Lecture des saves, offsets portés de PKHeX |
| `server/` | Stockage (`store.ts`) et Server Actions |
| `api.ts` | API |
| `ui/` | Écrans |
| `data/` | Noms FR/EN, cartes, courbes d'XP |

- **Jeux lus automatiquement** : Gen 1 à 3, Noir/Blanc, X/Y, Rubis Oméga/Saphir Alpha, Let's Go, Épée/Bouclier et Légendes Arceus (pour ces deux derniers, le fichier `main` du dossier de save). Les autres jeux sont stockés, et leurs infos se saisissent à la main.
- **Images** : jaquettes et badges de Bulbapedia, dans `public/assets/pokemon-saves/`. Les sprites viennent de PokeAPI et demandent une connexion internet.
