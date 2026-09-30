// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Feature, Geometry } from "geojson";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

import { renderWithProviders, screen, fireEvent, createEvent } from "../../../tests/test-utils-ui";
import type { GeoShapeLayer } from "@/lib/geoShapes";
import type { MapShapesProps } from "@/types/site-schema";

/**
 * Ce que garantit ce fichier : la section `map-shapes` est un bloc de NAVIGATION, pas une
 * illustration. Un contour ne vaut que par le lien qu'il porte, et c'est justement la partie
 * qu'aucun typage ne protège — `shapeHref` rend `null` en silence quand la propriété visée manque,
 * et `target.layers` retire la cliquabilité d'une couche entière. Les trois régressions possibles
 * (lien mort, lien absent, couche de décor devenue cliquable) sont donc muettes à l'œil.
 *
 * Stratégie de doublure : SEUL `useGeoShapes` est remplacé — les fonctions pures du barrel
 * (`shapeHref`, `isLayerInteractive`, `cssColorToken`) restent les vraies, sinon on ne testerait
 * que le stub. `projectShapes` est importé par CHEMIN DIRECT par le composant : il échappe au mock
 * du barrel, donc la projection d3-geo qui s'exécute ici est bien la vraie (c'est elle qui produit
 * le `viewBox` et les `d`).
 */

const etat = vi.hoisted(() => ({ couches: [] as unknown[] }));
const naviguer = vi.hoisted(() => vi.fn());

vi.mock("@/lib/geoShapes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/geoShapes")>()),
  useGeoShapes: () => etat.couches,
}));

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => naviguer,
}));

import MapShapes from "./MapShapes";

/** Carré de ~2 km quelque part sur La Réunion : il faut une vraie géométrie, d3-geo la projette. */
function carre(x: number, y: number, taille = 0.02): Geometry {
  return {
    type: "Polygon",
    coordinates: [
      [
        [x, y],
        [x + taille, y],
        [x + taille, y + taille],
        [x, y + taille],
        [x, y],
      ],
    ],
  };
}

let seq = 0;
function contour(properties: Record<string, unknown>, x = 55.2 + 0.05 * seq, y = -21.0): Feature {
  seq += 1;
  return { type: "Feature", id: `f${seq}`, properties, geometry: carre(x, y) };
}

function couche(id: string, features: Feature[], extra: Partial<GeoShapeLayer> = {}): GeoShapeLayer {
  return {
    id,
    data: { type: "FeatureCollection", features },
    isLoading: false,
    isError: false,
    ...extra,
  };
}

const SOURCES: MapShapesProps["shapes"] = [
  {
    id: "communes",
    source: "cities",
    filters: { countryCode: "RE", parentId: "58be4af494ef47df1d0ddbcc", parentLevel: "4" },
  },
];

const CIBLE: MapShapesProps["target"] = { path: "/cible", filterId: "monFiltre" };

/**
 * `useGeoShapes` est stubé, donc React Query n'est jamais sollicité — le provider est là par
 * CONTRAT (le composant reste un consommateur de `useQueries`) et non par nécessité du test.
 */
function rendre(props: Partial<MapShapesProps> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderWithProviders(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MapShapes props={{ shapes: SOURCES, target: CIBLE, ...props }} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function liens(container: HTMLElement) {
  return [...container.querySelectorAll("a")];
}

beforeEach(() => {
  seq = 0;
  etat.couches = [];
  naviguer.mockClear();
});

describe("MapShapes — chaque contour est un lien vers la recherche filtrée", () => {
  it("rend un <a> par contour, avec le href du contrat regionsTarget et le nom en aria-label", () => {
    etat.couches = [
      couche("communes", [contour({ name: "Saint-Paul" }), contour({ name: "Saint-Denis" })]),
    ];
    const { container } = rendre();

    const as = liens(container);
    expect(as.map((a) => a.getAttribute("href"))).toEqual([
      "/cible?monFiltre=Saint-Paul",
      "/cible?monFiltre=Saint-Denis",
    ]);
    // Un `<a>` sans texte est anonyme pour un lecteur d'écran : le nom du territoire EST le libellé.
    expect(as.map((a) => a.getAttribute("aria-label"))).toEqual(["Saint-Paul", "Saint-Denis"]);
    expect([...container.querySelectorAll("svg title")].map((n) => n.textContent)).toEqual([
      "Saint-Paul",
      "Saint-Denis",
    ]);
  });

  it("un contour dont la propriété de `valueFrom` manque reste du DÉCOR, pas un lien mort", () => {
    etat.couches = [
      couche("communes", [
        contour({ name: "Saint-Paul", insee: "97415" }),
        contour({ name: "Sans code" }),
      ]),
    ];
    const { container } = rendre({ target: { ...CIBLE, valueFrom: "insee" } });

    expect(liens(container).map((a) => a.getAttribute("href"))).toEqual(["/cible?monFiltre=97415"]);
    // Les deux contours sont bien DESSINÉS : c'est la cliquabilité qui tombe, pas le rendu.
    expect(container.querySelectorAll("path")).toHaveLength(2);
    const inerte = container.querySelectorAll("svg > path");
    expect(inerte).toHaveLength(1);
    expect(inerte[0].getAttribute("class")).toContain("pointer-events-none");
  });

  it("un contour SANS `name` reste nommé par sa valeur de filtre, jamais un lien anonyme", () => {
    // Beaucoup de documents legacy n'ont pas de `name` (`toFeatureCollection` pose alors `null`).
    // Un `<a>` SVG focusable au clavier sans nom accessible est inatteignable au lecteur d'écran.
    etat.couches = [couche("communes", [contour({ insee: "97415" }), contour({ name: "Nommé", insee: "97411" })])];
    const { container } = rendre({ target: { ...CIBLE, valueFrom: "insee" } });

    const as = liens(container);
    expect(as.map((a) => a.getAttribute("href"))).toEqual(["/cible?monFiltre=97415", "/cible?monFiltre=97411"]);
    expect(as.map((a) => a.getAttribute("aria-label"))).toEqual(["97415", "Nommé"]);
    expect([...container.querySelectorAll("svg title")].map((n) => n.textContent)).toEqual(["97415", "Nommé"]);
  });

  it("`target.layers` garde une couche de décor inerte sous une couche cliquable", () => {
    etat.couches = [
      couche("decor", [contour({ name: "Contour régional" })]),
      couche("communes", [contour({ name: "Saint-Paul" })]),
    ];
    const { container } = rendre({ target: { ...CIBLE, layers: ["communes"] } });

    const as = liens(container);
    expect(as).toHaveLength(1);
    expect(as[0].getAttribute("aria-label")).toBe("Saint-Paul");
    // Le contour régional a pourtant un `name` exploitable : seule la liste des couches l'exclut.
    expect(container.querySelectorAll("svg > path")).toHaveLength(1);
  });

  it("le clic navigue en SPA : `navigate` reçoit le href et le lien ne recharge pas la page", () => {
    etat.couches = [couche("communes", [contour({ name: "Saint-Paul" })])];
    const { container } = rendre();

    const evenement = createEvent.click(liens(container)[0]);
    fireEvent(liens(container)[0], evenement);

    expect(naviguer).toHaveBeenCalledTimes(1);
    expect(naviguer).toHaveBeenCalledWith("/cible?monFiltre=Saint-Paul");
    // Sans preventDefault, le href déclencherait une navigation PLEINE PAGE en plus du push SPA.
    expect(evenement.defaultPrevented, "le href doit rester partageable sans recharger").toBe(true);
  });

  it("🔒 Ctrl/Cmd + clic laisse le navigateur ouvrir un nouvel onglet", () => {
    etat.couches = [couche("communes", [contour({ name: "Saint-Paul" })])];
    const { container } = rendre();

    for (const modificateur of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }]) {
      const evenement = createEvent.click(liens(container)[0], modificateur);
      fireEvent(liens(container)[0], evenement);
      // Le seul intérêt d'une vraie ancre SVG sur un `<path>` + handler, c'est justement ceci :
      // un `preventDefault` inconditionnel le confisquerait sans que rien ne le signale.
      expect(evenement.defaultPrevented, JSON.stringify(modificateur)).toBe(false);
    }
    expect(naviguer, "la nav SPA ne doit pas doubler l'ouverture demandée").not.toHaveBeenCalled();
  });
});

describe("MapShapes — états sans contour", () => {
  it("couche vide et chargement terminé : l'état vide est annoncé", () => {
    etat.couches = [couche("communes", [])];
    const { container } = rendre();

    expect(screen.getByRole("status")).toHaveTextContent("Aucun contour à afficher pour ce périmètre.");
    expect(container.querySelector("svg[role='group']")).toBeNull();
  });

  it("couche vide MAIS en cours de chargement : squelette, surtout pas l'état vide", () => {
    etat.couches = [couche("communes", [], { isLoading: true })];
    const { container } = rendre();

    // Annoncer « aucun contour » pendant le fetch serait un mensonge, et `aria-live` le lirait.
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.querySelector("[data-slot='skeleton']")).not.toBeNull();
  });

  it("échec de chargement : on signale la PANNE, on n'affirme pas que le périmètre est vide", () => {
    etat.couches = [couche("communes", [], { isError: true })];
    rendre();

    // Dire « aucun contour ici » quand on n'a RIEN PU LIRE tromperait sur le territoire lui-même,
    // et `aria-live` le lirait à voix haute.
    const statut = screen.getByRole("status");
    expect(statut).toHaveTextContent("Les contours n'ont pas pu être chargés.");
    expect(statut).not.toHaveTextContent("Aucun contour");
  });

  it("une couche chargée suffit à sortir du squelette même si une autre charge encore", () => {
    etat.couches = [
      couche("communes", [contour({ name: "Saint-Paul" })]),
      couche("decor", [], { isLoading: true }),
    ];
    const { container } = rendre();

    expect(container.querySelector("[data-slot='skeleton']")).toBeNull();
    expect(liens(container)).toHaveLength(1);
  });
});

describe("MapShapes — config amputée (jamais revalidée au runtime)", () => {
  // La config arrive par `JSON.parse` : le `required` du schéma ne protège de rien en production.

  it("sans `target`, tous les contours restent du décor au lieu de faire tomber la section", () => {
    etat.couches = [couche("communes", [contour({ name: "Saint-Paul" }), contour({ name: "Saint-Denis" })])];
    const { container } = rendre({ target: undefined });

    expect(liens(container)).toHaveLength(0);
    const inertes = container.querySelectorAll("svg > path");
    expect(inertes).toHaveLength(2);
    for (const path of inertes) expect(path.getAttribute("class")).toContain("pointer-events-none");
  });

  it("un `target` sans `path` ne produit jamais de lien vers `undefined?…`", () => {
    etat.couches = [couche("communes", [contour({ name: "Saint-Paul" })])];
    const { container } = rendre({ target: { filterId: "monFiltre" } as MapShapesProps["target"] });

    expect(liens(container)).toHaveLength(0);
    expect(container.querySelectorAll("svg > path")).toHaveLength(1);
  });
});

describe("MapShapes — légende et repère SVG", () => {
  it("seules les couches portant un `label` entrent en légende", () => {
    etat.couches = [
      couche("communes", [contour({ name: "Saint-Paul" })], { label: { fr: "Communes" } }),
      couche("decor", [contour({ name: "Contour régional" })]),
    ];
    const { container } = rendre();

    const entrees = [...container.querySelectorAll("li")].map((li) => li.textContent);
    expect(entrees).toEqual(["Communes"]);
  });

  it("une couche libellée mais VIDE n'entre pas en légende", () => {
    etat.couches = [
      couche("communes", [contour({ name: "Saint-Paul" })], { label: { fr: "Communes" } }),
      couche("qpv", [], { label: { fr: "Quartiers prioritaires" } }),
    ];
    const { container } = rendre();

    // Une case de légende sans contour à l'écran envoie chercher ce qui n'existe pas.
    expect([...container.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Communes"]);
  });

  it("le viewBox est un repère fini : ni NaN ni Infinity ne doivent en sortir", () => {
    etat.couches = [
      couche("communes", [contour({ name: "Saint-Paul" }), contour({ name: "Saint-Denis" })]),
    ];
    const { container } = rendre();

    const viewBox = container.querySelector("svg")?.getAttribute("viewBox") ?? "";
    // Un `NaN` ici et le SVG entier disparaît sans erreur : c'est la panne la plus silencieuse.
    expect(viewBox).toMatch(/^0 0 1000 \d+$/);
    for (const nombre of viewBox.split(" ").map(Number)) expect(Number.isFinite(nombre)).toBe(true);
    for (const path of container.querySelectorAll("path")) {
      expect(path.getAttribute("d")).not.toMatch(/NaN|Infinity/);
    }
  });
});
