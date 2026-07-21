# Cartographie des fonctions — RAPPORT

> Généré par `npm run map:functions` · scope `src/modules/search` · base `f693e15e`. NE PAS éditer à la main (régénérer).

**Inventaire** : 255 fonctions sur 109 fichiers. Doublons (corps) : 0 clusters · Clusters de nom : 8 · Génériques à mutualiser : 8 · Code mort : 0 exports + 0 fichiers · Chevauchements de couches : 0.

## 1. À fusionner — corps identiques (≥2 fichiers)
Même corps normalisé à plusieurs endroits → candidat fusion direct vers une source unique.

_Aucun._

## 2. Clusters de NOM (même identifiant utilitaire, ≥2 fichiers) — classés
`identical` = fusionner · `quasi` = vérifier les différences (signature/défaut/retour) avant fusion · `different` = même nom, corps divergents → décider au cas par cas. Les noms INCIDENTS (handlers `handle*`/`on*`, `render*`) sont exclus (convention UI, pas des doublons).

- **initialsOf** ×2 — `quasi`
  - `src/modules/search/components/ThematicCards.tsx:35` _(module:search)_
  - `src/modules/search/components/card/CardNews.tsx:14` _(module:search)_
- **getLocation** ×2 — `quasi`
  - `src/modules/search/helpers/getLocation.ts:11` _(module:search, exporté)_
  - `src/modules/search/components/card/CardFunding.tsx:188` _(module:search)_
- **str** ×2 — `quasi`
  - `src/modules/search/lib/coformAnswer.ts:97` _(module:search)_
  - `src/modules/search/components/preview/PreviewPoiAmenities.tsx:144` _(module:search)_
- **Feature** ×2 — `quasi`
  - `src/modules/search/components/card/CardPoiAmenities.tsx:25` _(module:search)_
  - `src/modules/search/components/preview/PreviewPoiAmenities.tsx:301` _(module:search)_
- **getPoiImage** ×2 — `quasi`
  - `src/modules/search/components/card/CardPoiAmenities.tsx:49` _(module:search)_
  - `src/modules/search/components/preview/PreviewPoiAmenities.tsx:127` _(module:search)_
- **getData** ×2 — `different`
  - `src/modules/search/components/FranceRegionsMap.tsx:87` _(module:search)_
  - `src/modules/search/components/SearchBubbleChart.tsx:103` _(module:search)_
- **resolveLucideIcon** ×2 — `different`
  - `src/modules/search/sections/ThematicsSection.tsx:53` _(module:search)_
  - `src/modules/search/components/card/CardCountCT.tsx:66` _(module:search)_

_(1 clusters de noms incidents handlers/render exclus de cette section.)_

## 3. À mutualiser — génériques enfouis (pures, en module/feature)
Fonctions sans JSX ni hook vivant hors des couches partagées → candidates à promouvoir. (relancer `--refs` pour l'usage cross-module réel.)

- **extractServicePricingAnswers** `src/modules/search/helpers/servicePricingAnswers.ts:91` _(module:search, 54 loc)_ → src/lib/ — dans utils/helpers
- **buildServicePricingStats** `src/modules/search/helpers/servicePricingAnswers.ts:191` _(module:search, 22 loc)_ → src/lib/ — dans utils/helpers
- **buildServicePricingServices** `src/modules/search/helpers/servicePricingAnswers.ts:215` _(module:search, 18 loc)_ → src/lib/ — dans utils/helpers
- **servicePricingStatLabel** `src/modules/search/helpers/servicePricingAnswers.ts:247` _(module:search, 11 loc)_ → src/helpers/ — dans utils/helpers
- **getLocation** `src/modules/search/helpers/getLocation.ts:11` _(module:search, 7 loc)_ → src/helpers/ — dans utils/helpers
- **formatCapacityRange** `src/modules/search/helpers/servicePricingAnswers.ts:235` _(module:search, 7 loc)_ → src/helpers/ — dans utils/helpers
- **accumulateMin** `src/modules/search/helpers/servicePricingAnswers.ts:78` _(module:search, 5 loc)_ → src/helpers/ — dans utils/helpers
- **toInt** `src/modules/search/helpers/servicePricingAnswers.ts:67` _(module:search, 4 loc)_ → src/helpers/ — dans utils/helpers

## 4. Code mort / sur-exporté (knip — à VÉRIFIER)
Signal heuristique : exports/fichiers sans référence statique. Vérifier les usages dynamiques (glob, lazy, inférence de type) avant suppression.

### Fichiers non référencés (0)

### Exports non référencés (0)

## 5. Chevauchements de couches partagées
Même nom de fichier dans plusieurs dossiers partagés (helpers/utils/lib…) → vérifier l'intention (faux doublon vs vraie duplication).

_Aucun._
