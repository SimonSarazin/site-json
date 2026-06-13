// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { renderMapPopup } from "./renderMapPopup";

/**
 * La popup de marker est du HTML STATIQUE (renderToString) injecté dans
 * Leaflet : aucun état React n'y fonctionne. Ces tests verrouillent le
 * contrat : contenu rendu, bouton d'action `data-id` (seul point
 * interactif — listener natif posé par SearchMap), libellé selon
 * `map.itemAction`, et AUCUN résidu d'interactivité morte.
 */

const t = (key: string) => key;

function fakeItem(over: Record<string, unknown> = {}): SearchEntity {
  return {
    serverData: {
      id: "x1",
      name: "Stade de l'Est",
      slug: "stade-est",
      address: { streetAddress: "12 rue du Sport", postalCode: "97400", addressLocality: "Saint-Denis" },
      tags: ["foot", "athlétisme", "natation", "judo", "tennis", "basket"],
      ...over,
    },
  } as unknown as SearchEntity;
}

describe("renderMapPopup (HTML statique)", () => {
  it("rend nom, adresse, tags plafonnés (+N statique) et le bouton data-id", () => {
    const html = renderMapPopup({ item: fakeItem(), id: "popup-x1", t });
    expect(html).toContain("Stade de l&#x27;Est");
    expect(html).toContain("12 rue du Sport");
    expect(html).toContain('data-id="popup-x1"');
    // 6 tags → 4 visibles + compteur statique. NB : renderToString insère des
    // séparateurs <!-- --> entre nœuds texte adjacents (#{tag} → #<!-- -->foot).
    expect(html).toContain("foot");
    expect(html).toContain("natation");
    expect(html).toMatch(/\+(<!-- -->)?2/);
    expect(html).not.toContain("basket");
  });

  it("libellé du bouton selon l'action : préview (défaut) vs profil", () => {
    expect(renderMapPopup({ item: fakeItem(), id: "p", t })).toContain("En savoir plus");
    expect(renderMapPopup({ item: fakeItem(), id: "p", t, actionKind: "profil" })).toContain("Voir le profil");
  });

  it("bandeau image quand l'item en a une (URL relative préfixée)", () => {
    const html = renderMapPopup({
      item: fakeItem({ profilMediumImageUrl: "/upload/stade.jpg" }),
      id: "p",
      t,
    });
    expect(html).toMatch(/<img src="[^"]*\/upload\/stade\.jpg"/);
    // sans image : pas de bandeau
    expect(renderMapPopup({ item: fakeItem(), id: "p", t })).not.toContain("<img");
  });

  it("aucun résidu Font Awesome (icônes lucide inline uniquement)", () => {
    const html = renderMapPopup({ item: fakeItem(), id: "p", t });
    expect(html).not.toContain("fa-solid");
    expect(html).toContain("<svg");
  });
});
