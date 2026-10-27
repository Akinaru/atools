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
| `url` | App externe, sans `Page` : la tuile ouvre cette URL dans un nouvel onglet (ex. `src/apps/aarchive`) |
| `api` | Liste de routes `{ method, path: "items/:id", description, handler }` |
| `pwa` | App installable seule (PWA) : `{ manifest, appleIcon }`, fichiers dans `public/assets/<slug>/` (ex. `src/apps/monnaie`) |

- Fichiers : `appDataDir(slug, ...)` de `src/lib/storage.ts`.
- Helpers d'API : `json()` et `apiError()` de `src/lib/api.ts`.
- Kit console (`src/components/console/`) :
  - `NavGrid` : tuiles avec curseur.
  - `ConsoleTabs` : onglets L/R.
  - `playSound` : sons de navigation.

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

Le navigateur connecté à l'interface y a aussi accès, grâce à son cookie de session.

Un appareil peut aussi obtenir sa propre clé par **appairage** : il affiche un code, saisi ensuite sur `/apps/pokemon-saves/pair`. Les clés d'appareil sont stockées hachées dans `data/atools/devices.json`, et cette page permet de les révoquer.

`GET /api` liste toutes les routes de toutes les apps. `GET /api/<slug>` liste celles d'une app.

### Saves Pokémon (`/api/pokemon-saves`)

Doc complète pour un client (homebrew Switch) : [`docs/pokemon-saves-api.md`](docs/pokemon-saves-api.md).

| Méthode | Route | Rôle |
| --- | --- | --- |
| POST | `/pair` | Démarre l'appairage d'un appareil (public) |
| GET | `/pair/:pairingId` | État de l'appairage, puis la clé d'appareil une seule fois (public) |
| GET | `/games` | Catalogue des jeux, avec les title IDs Switch et les codes jeu DS |
| GET | `/backups` | Saves de backup : `game`, `slot`, `sha256`, `updatedAt` |
| PUT | `/backups/:game/:slot` | **Ajoute ou met à jour** la save d'un slot |
| GET | `/saves` (`?game=`, `?slot=`) | Saves avec leur résumé |
| POST | `/saves` | Ajoute une nouvelle save |
| GET | `/saves/:id` | Détail : équipe, boîtes, badges, Pokédex, versions |
| PUT | `/saves/:id` | **Écrase** le fichier d'une save |
| GET | `/saves/:id/file` | Fichier actuel |
| GET | `/saves/:id/versions/:version/file` | Une version précédente |
| DELETE | `/saves/:id` | Suppression |

**Envoi d'un fichier.** Toutes les routes d'envoi acceptent deux formats :
- un corps binaire brut, avec en paramètres d'URL `filename`, `modified` (millisecondes ou date ISO) et `label` ;
- du `multipart/form-data`, avec les champs `file`, `label` et `fileDate`.

Une save Switch est un dossier : envoie-le en **`.zip`**. L'app y lit `main` (Épée/Bouclier, Arceus) ou `savedata.bin` (Let's Go).

**Écrasement sans perte.** Chaque écrasement garde l'ancien fichier en version (les 10 dernières). Renvoyer un fichier identique ne change rien, et la réponse est `status: "unchanged"`.

**Backup depuis la Switch.** Chaque jeu a un slot fixe, par exemple `switch` :
- `:game` est l'id du catalogue (`shield`) ou le title ID Switch (`01008DB008C2C000`) ;
- `:slot` est un nom libre : lettres, chiffres, `.`, `_` et `-`, 64 caractères maximum.

1. `GET /api/pokemon-saves/backups` : récupère les `sha256` connus.
2. Pour chaque jeu dont le SHA-256 local diffère, envoie la save :

```bash
curl -X PUT "https://atools.akinaru.fr/api/pokemon-saves/backups/01008DB008C2C000/switch?filename=Bouclier.zip&modified=1760400000000" \
  -H "X-API-Key: $ATOOLS_API_KEY" --data-binary @Bouclier.zip
# → 201 {"status":"created", "save":{…}}   puis   200 {"status":"updated" | "unchanged", …}
```

Codes d'erreur : 400 (jeu, slot ou fichier invalide), 401 (clé API), 404 (save inconnue). Le corps est `{ "error": "…" }`.

### Monnaie (`/api/monnaie`)

Montants en **centimes** (entiers).

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/entries` (`?month=AAAA-MM`, `?kind=income\|expense`) | Lignes, les plus récentes d'abord |
| POST | `/entries` | Ajoute une ligne : `{ kind, amount, label, category, date, note?, regret? }`. `kind` : `income`, `expense` (plaisir), `charge` (loyer, énergie…) `savings` (livret, `category` = `depot` ou `retrait`) ou `debt` (`person` requis, `category` = `dette`, `rembourse`, `pret` ou `recu`) |
| PATCH | `/entries/:id` | Modifie une ligne : seuls les champs envoyés changent, puis la ligne est revalidée |
| DELETE | `/entries/:id` | Supprime une ligne |
| GET | `/months/:month` | Bilan du mois : encaissé, charges, cramé, livret (net et solde), reste, budget, par catégorie |
| GET | `/export.csv` | Toutes les lignes en CSV |
| GET | `/backup.json` | Sauvegarde complète. L'en-tête `ETag` donne sa version |
| PUT | `/backup.json` | Remplace toute la base. `If-Match: <ETag lu>` obligatoire (428 sans, 412 si la base a changé depuis). L'ancienne base est gardée dans `data/monnaie/ledger.before-restore-*.json` |
| POST | `/import` (`?dryRun=1`) | Importe un export CSV Caisse d'Épargne (corps brut) : règles apprises puis catégories de la banque, opérations déjà importées sautées |

Modifier la base de prod d'un bloc : lire, éditer, renvoyer avec la version lue.

```bash
curl -sD headers.txt -H "Authorization: Bearer $ATOOLS_API_KEY" https://atools.akinaru.fr/api/monnaie/backup.json -o ledger.json
# … éditer ledger.json …
curl -X PUT -H "Authorization: Bearer $ATOOLS_API_KEY" -H "If-Match: $(grep -i '^etag' headers.txt | cut -d' ' -f2 | tr -d '\r')" \
  --data-binary @ledger.json https://atools.akinaru.fr/api/monnaie/backup.json
```

## Déploiement (Coolify)

Le `Dockerfile` produit une image autonome (Next `output: "standalone"`).

1. Coolify → *New Resource* → ton dépôt Git → build pack **Dockerfile**, port **3000**.
2. Variables d'environnement (voir `.env.example`) :
   - `ATOOLS_PASSWORD` : mot de passe de l'interface, saisi sur la page `/login`. La session dure 30 jours. Changer le mot de passe déconnecte tous les navigateurs.
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

## App : Monnaie (`src/apps/monnaie`)

Suivi de l'argent : ce que je gagne, mes charges (loyer, énergie, assurances…), ce que je dépense sans nécessité, ce que je mets sur le livret chaque mois, et les dettes entre potes (l'ardoise).

| Dossier / fichier | Contenu |
| --- | --- |
| `money.ts` | Types, catégories, montants, calcul des stats (pur, sans I/O) |
| `server/store.ts` | Stockage dans `data/monnaie/ledger.json`, validation des entrées |
| `server/actions.ts` | Server Actions des formulaires |
| `import/` | Lecture des exports bancaires et suggestions de catégorie |
| `ui/` | Écrans : mois, année, lignes, objectifs, réglages (import compris) ; DA dans `ui/monnaie.css` |

- **Pages** : `/apps/monnaie` (le mois, ◀ ▶ sans changer l'URL), `/annee`, `/lignes`, `/objectifs`, `/reglages` avec ses onglets `/reglages/import`, `/categories`, `/recurrents`, `/pointages`, `/donnees`.
- **Lignes** : toutes les lignes, filtrées (texte, catégorie, période), triées, en liste ou groupées par libellé. Sélection (clic, Maj+clic, ⌘A) puis actions groupées : renommer, reclasser, regret, supprimer. « Retenir pour l'import » met aussi à jour les règles d'import.
- **Import bancaire** (`import/`) : `caisse-epargne.ts` lit l'export CSV, `suggest.ts` propose type et catégorie (règles apprises, puis catégories de la banque). Chaque opération a un `importId` stable : réimporter une période ne crée pas de doublon. Corriger une ligne à l'import crée une règle (gérées dans les Réglages).
- **Épargne** : le livret, avec son solde de départ dans les Réglages. Revolut est traité comme une dépense ou un revenu (catégorie « Revolut »).
- **Analyses** (`insights.ts`) : ce qui revient chaque mois (même libellé, 3 mois sur 6, montant stable), prévision du solde au 31, moyenne de chaque catégorie sur les 3 mois précédents.
- **Pointages du solde** : le solde réel saisi à une date ; le solde de chaque mois en découle, et chaque pointage est comparé au précédent pour repérer une opération manquante.
- **Catégories perso** et **budgets par catégorie** dans les Réglages ; une ligne peut reclasser toutes celles du même libellé (et créer une règle d'import).
- **Raccourci** : X ouvre l'ajout d'une ligne.
