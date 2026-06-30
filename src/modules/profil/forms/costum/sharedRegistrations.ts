/**
 * Barrel SIDE-EFFECT des clés GÉNÉRIQUES réutilisables par TOUT costum (y compris purement-config).
 *
 * Avant : ces clés (`address:*`, `openingHours:*`, `social:*`, `monthYear`/`enumOrOther`/`multiCsv`,
 * `coerce:*`, `geo:write`/`geoPosition:write`, `image:profilUrl`, `cleanValues:*`, `invalidate:standard`,
 * validators `addressComplete`/`addressValid`/…) n'étaient enregistrées que TRANSITIVEMENT via les `fns.ts`
 * des 2 costums TS existants — un costum de config qui en dépendait marchait par effet de bord, fragile si
 * ces `fns.ts` étaient retirés/refactorés.
 *
 * Désormais ce barrel est importé INCONDITIONNELLEMENT par `registerSpecFns` (chemin app) et par
 * `registerCostumForms` (loader config, AVANT toute compilation de costum). Les clés génériques sont donc
 * GARANTIES, indépendamment de quels costums spécifiques existent. Les `fns.ts` costum gardent leurs imports
 * (redondants mais inoffensifs) ; un futur costum 100 %-config n'a plus de dépendance cachée.
 */
import "@/modules/formEngine/engine/coercions"; // coerce:string/number/bool/stringArray/dateYMD/orEmpty/…
import "../geoTransforms";                       // geo:write / geoPosition:write
import "../validators";                          // addressComplete / addressValid / eventDates…
import "./sharedCodecs";                         // address / openingHours / social / monthYear / enumOrOther / multiCsv
import "./sharedFns";                            // image:profilUrl / cleanValues:dropEmptyArrayItems / invalidate:standard
import "../registerWidgets";                     // widgets DOMAINE (location/finder/tags/image/email/tel/eventDates/editSocial/editSchedule) — GARANTIS avant la garde widget de registerCostumForm (runtime + test)
