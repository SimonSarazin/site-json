import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";

import { useCocolight } from "@/hooks/useCocolight";
import { useSite } from "@/hooks/useSite";
import { parseLegacyHash } from "@/lib/legacyEmailHash";
import { resolveHostEntity } from "@/modules/news/lib/resolveHostEntity";
import { buildProfileTabUrl } from "@/modules/profil/hooks/useNewsDetailUrlGenerator";

/** Ids d'onglet « communauté/membres » connus (le type de section est générique → on matche par id). */
const COMMUNITY_TAB_IDS = new Set([
  "members", "membership", "community", "communaute", "contributors", "contributeurs",
]);

/**
 * Rattrape les DEEP-LINKS EN FRAGMENT des e-mails legacy (`<base>/#page.type.<coll>.id.<id>`, `#@<slug>`).
 *
 * Le fragment n'arrive jamais au serveur : ces liens atterrissaient donc sur l'accueil (cf.
 * `cocolight-backend/docs/24`, AXE 2). Comme les e-mails sont **déjà partis** et que le legacy
 * continuera d'en émettre, le seul rattrapage possible est ici, au montage, côté client.
 *
 * Le routing du site est par **slug** : on résout donc l'entité avant de naviguer — via
 * `api.<type>({id})` (même mécanisme que `useNotificationNavigation`) ou `entity.entityBySlug`.
 *
 * ## Règle du chantier : ne JAMAIS faire pire qu'avant
 * Avant ce hook, un de ces liens montrait l'accueil. Il ne doit donc jamais produire un écran
 * d'erreur. D'où :
 *  - fragment non reconnu → on ne touche à rien (ancres `#section`, hash applicatifs costum) ;
 *  - **on ne navigue qu'après avoir VÉRIFIÉ que la cible existe** — `ProfilePage` affiche une carte
 *    d'erreur sur un slug inconnu, ce qui serait pire que l'accueil ;
 *  - toute exception est avalée (cet effet est monté à la RACINE, sous l'ErrorBoundary de
 *    `RootLayout` : une exception ferait tomber TOUT le site) ;
 *  - `replace: true` — le lien d'e-mail ne doit pas polluer l'historique.
 */
export function useLegacyHashRedirect(): void {
  const navigate = useNavigate();
  const { api, entity } = useCocolight();
  const { config } = useSite();
  const traite = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return; // SSR : pas de fragment côté serveur
    const hash = window.location.hash;
    if (!hash || traite.current === hash) return;

    // Ceinture et bretelles : aucune exception ne doit sortir d'un effet monté à la racine.
    let cible: ReturnType<typeof parseLegacyHash> = null;
    try { cible = parseLegacyHash(hash); } catch { return; }
    if (!cible) return; // pas un lien d'e-mail legacy → on laisse passer

    // ⚠️ Le marquage vient APRÈS les garde-fous de disponibilité : tant que l'API n'est pas prête on
    // ne marque rien, sinon le fragment serait consommé sans rien faire et la redirection perdue.
    if (!api || !entity) return;
    traite.current = hash;

    // Position de départ, figée AVANT l'appel réseau. `SiteShell` étant l'élément de la route racine
    // il n'est jamais démonté, et les deps sont stables (`navigate` mémoïsé par le data router,
    // `config` = state jamais réassigné) : le cleanup ne tourne donc PAS lors d'une navigation
    // interne, et un drapeau d'annulation seul ne protégerait de rien. Sans ce garde-fou, un visiteur
    // qui clique ailleurs pendant la résolution (backend froid = plusieurs secondes) serait ARRACHÉ
    // de sa page — et comme on navigue en `replace`, son entrée d'historique serait écrasée.
    const departPath = window.location.pathname + window.location.search;
    /** Le visiteur est-il toujours là où il était quand on a lancé la résolution ? */
    const toujoursLa = (): boolean =>
      window.location.hash === hash
      && window.location.pathname + window.location.search === departPath;

    void (async () => {
      try {
        if (cible.kind === "slug") {
          // `#@<slug>` : le slug est là, mais on vérifie qu'il RÉSOUT avant de naviguer (sinon
          // `ProfilePage` afficherait sa carte d'erreur). Le suffixe legacy éventuel
          // (`.view.forms.dir.answer.<id>`, 4 590 des 4 591 liens émis) n'a pas d'équivalent
          // site-json : on ouvre la fiche du porteur, ce qui reste plus proche que l'accueil.
          const cible2 = await entity.entityBySlug(cible.slug);
          if (!cible2?.slug || !toujoursLa()) return;
          navigate(`/profil/${cible2.slug}`, { replace: true });
          return;
        }

        const cibleElt = await resolveHostEntity(api, cible.type, cible.id);
        if (!cibleElt?.slug || !toujoursLa()) return; // sans slug, pas de fiche → on reste à l'accueil
        const root = `/profil/${cibleElt.slug}`;
        // `.view.directory` (legacy) = l'annuaire de l'élément → onglet communauté quand il existe.
        const url =
          cible.view === "directory"
            ? buildProfileTabUrl(config, cibleElt, (tab) => COMMUNITY_TAB_IDS.has(tab.id)) ?? root
            : root;
        navigate(url, { replace: true });
      } catch (error) {
        // Volontairement silencieux côté UX : on laisse le visiteur sur l'accueil.
        console.error("[legacy-hash] résolution impossible", error);
      }
    })();
  }, [api, entity, config, navigate]);
}
