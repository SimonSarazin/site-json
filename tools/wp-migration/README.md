# Migration WordPress → POI costum (parent62.org)

Récupère TOUT le contenu WordPress (contenu **converti HTML→markdown**, images **téléchargées** pour
réhébergement Coco) via l'API REST `wp/v2`, en JSON prêt à importer en POI `type:"article"` d'un costum dédié.

## Usage
```
npm install
node fetch-wp.mjs                      # run complet (~6486 articles, ~16k images ; reprenable)
node fetch-wp.mjs --max-pages 1        # pilote (100 articles)
node fetch-wp.mjs --resume             # reprend au dernier checkpoint
node fetch-wp.mjs --no-images          # contenu seul (rapide)
```
Options : `--base <url>` `--out <dir>` `--per-page 100` `--throttle 300` `--max-pages N` `--resume` `--no-images`.

## Sorties (dans `out/`, non versionnées)
- `articles.json` / `articles.ndjson` — 1 enregistrement/article (voir mapping ci-dessous)
- `images/` — images à la une + inline (réécrites en chemins locaux dans `contentMarkdown`)
- `categories.json`, `summary.csv`, `manifest.json`, `checkpoint.json`

## Mapping cible (POI type=article, costum dédié parent62)
`title→name` · `contentMarkdown→description` (format markdown) · `excerpt→shortDescription` ·
`date→created` · `categories`+`tags`→`tags` · `featuredImage.localPath→image` (réhébergée) ·
`slug→slug` · `link`/`guid`→`source.originUrl` (+ clé idempotence `wpId`).

L'IMPORT (JSON+images → POI) est une étape SÉPARÉE (cf. docs/module-articles-blog.md §8-9).
