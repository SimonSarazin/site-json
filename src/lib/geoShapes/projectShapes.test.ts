import { describe, expect, it } from "vitest";
import type { Feature, Geometry, Position } from "geojson";

import type { GeoShapeLayer } from "./useGeoShapes";
import { projectShapes, SHAPE_VIEW_WIDTH } from "./projectShapes";

/**
 * Ce que garantit ce fichier : la projection SVG de la section `map-shapes`.
 *
 * Le rendu n'a aucun filet — un `d` faux reste un `<path>` valide, et un cadrage faux reste un
 * `viewBox` valide : le bloc s'affiche, simplement il ne montre pas le territoire. Trois invariants
 * portent donc tout le reste : le repère est COMMUN à toutes les couches (sinon les contours ne se
 * superposent plus), le sens de parcours des anneaux est normalisé (`d3-geo` lit les polygones sur
 * la sphère, cf. plus bas), et les libellés restent lisibles (plafonnés, jamais vides).
 */

/** Rectangle en degrés, parcouru dans le sens HORAIRE — la convention de `d3-geo`. */
function rectangle(ouest: number, sud: number, largeur: number, hauteur: number): Geometry {
  return {
    type: "Polygon",
    coordinates: [
      [
        [ouest, sud],
        [ouest, sud + hauteur],
        [ouest + largeur, sud + hauteur],
        [ouest + largeur, sud],
        [ouest, sud],
      ],
    ],
  };
}

/** Le MÊME rectangle parcouru à l'envers (sens RFC 7946) : c'est ce que renvoie `zoniris`. */
function rectangleInverse(ouest: number, sud: number, largeur: number, hauteur: number): Geometry {
  const anneau = (rectangle(ouest, sud, largeur, hauteur) as { coordinates: Position[][] }).coordinates[0];
  return { type: "Polygon", coordinates: [anneau.slice().reverse()] };
}

const carre = (ouest: number, sud: number, taille = 0.1) => rectangle(ouest, sud, taille, taille);

function contour(id: string, geometry: Geometry, properties: Record<string, unknown> = {}): Feature {
  return { type: "Feature", id, geometry, properties };
}

function couche(id: string, features: Feature[], extra: Partial<GeoShapeLayer> = {}): GeoShapeLayer {
  return { id, data: { type: "FeatureCollection", features }, isLoading: false, isError: false, ...extra };
}

/** Boîte englobante d'un attribut `d` : c'est la seule lecture géométrique fiable d'un path. */
function boite(d: string): { gauche: number; droite: number; haut: number; bas: number } {
  const nombres = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const xs = nombres.filter((_, i) => i % 2 === 0);
  const ys = nombres.filter((_, i) => i % 2 === 1);
  return { gauche: Math.min(...xs), droite: Math.max(...xs), haut: Math.min(...ys), bas: Math.max(...ys) };
}

describe("projectShapes — cadrage", () => {
  it("rend un cadre VIDE sans contour : le viewBox ne doit jamais porter de NaN", () => {
    for (const couches of [[], [couche("vide", [])], [couche("a", []), couche("b", [])]]) {
      const projection = projectShapes(couches);
      expect(projection).toEqual({ shapes: [], labels: [], height: 0 });
      // Le composant écrit `0 0 ${SHAPE_VIEW_WIDTH} ${height}` : un NaN y invaliderait le SVG entier.
      expect(`0 0 ${SHAPE_VIEW_WIDTH} ${projection.height}`).toBe("0 0 1000 0");
    }
  });

  it("projette un carré en un `d` peignable et une hauteur finie", () => {
    const { shapes, height } = projectShapes([couche("communes", [contour("c1", carre(55.2, -21.0))])]);

    expect(shapes).toHaveLength(1);
    expect(shapes[0].d).toMatch(/^M[\d.,\-LMZ]+Z$/);
    expect(Number.isFinite(height)).toBe(true);
    expect(height).toBeGreaterThan(0);
    // Un carré tient dans la largeur : sa hauteur est du même ordre (Mercator étire un peu en
    // latitude). Une hauteur de 1000 pile serait le symptôme d'un contour retourné (le globe).
    expect(height).toBeGreaterThan(1000);
    expect(height).toBeLessThan(1200);
  });

  it("cale le contenu en haut du repère (aucune bande vide au-dessus)", () => {
    const { shapes } = projectShapes([couche("communes", [contour("c1", rectangle(55.2, -21.0, 0.4, 0.1))])]);
    const { gauche, droite, haut } = boite(shapes[0].d);
    expect(haut).toBeCloseTo(0, 5);
    expect(gauche).toBeCloseTo(0, 5);
    expect(droite).toBeCloseTo(SHAPE_VIEW_WIDTH, 5);
  });

  it("projette DEUX couches dans le MÊME repère : une feature identique y produit le même `d`", () => {
    // Sans repère commun, la couche « région » serait cadrée SEULE et occuperait toute la largeur,
    // alors qu'ici elle doit laisser la place à la commune voisine, plus à l'est.
    const region = rectangle(55.2, -21.0, 0.2, 0.2);
    const projection = projectShapes([
      couche("regions", [contour("r1", region)]),
      couche("communes", [contour("c1", region), contour("c2", rectangle(55.6, -21.0, 0.2, 0.2))]),
    ]);

    const dansRegions = projection.shapes.find((s) => s.layerId === "regions")!;
    const dansCommunes = projection.shapes.find((s) => s.key === "communes-c1")!;
    expect(dansRegions.d).toBe(dansCommunes.d);

    // Preuve que le cadrage tient compte de l'AUTRE couche : le contour partagé n'occupe pas
    // toute la largeur, il s'arrête là où commence la commune de l'est.
    expect(boite(dansRegions.d).droite).toBeLessThan(SHAPE_VIEW_WIDTH / 2);
    const voisine = projection.shapes.find((s) => s.key === "communes-c2")!;
    expect(boite(voisine.d).droite).toBeCloseTo(SHAPE_VIEW_WIDTH, 5);
  });

  it("donne une clé de rendu STABLE et unique par (couche, contour)", () => {
    const couches = [
      couche("regions", [contour("doc1", carre(55.2, -21.0))]),
      // Même `id` de document dans une autre couche : deux `<path>` distincts, donc deux clés.
      couche("communes", [contour("doc1", carre(55.4, -21.0)), contour("doc2", carre(55.6, -21.0))]),
    ];
    const cles = projectShapes(couches).shapes.map((s) => s.key);

    expect(cles).toEqual(["regions-doc1", "communes-doc1", "communes-doc2"]);
    expect(new Set(cles).size).toBe(cles.length);
    // Stable : même entrée, mêmes clés — sinon React remonterait tout le SVG à chaque render.
    expect(projectShapes(couches).shapes.map((s) => s.key)).toEqual(cles);
  });
});

describe("projectShapes — sens de parcours des anneaux", () => {
  /**
   * `d3-geo` raisonne sur la SPHÈRE : un anneau extérieur parcouru à l'envers ne décrit pas le
   * contour mais tout le globe SAUF lui. La donnée legacy mélange les deux conventions —
   * `cities`/`zones` arrivent en horaire, `zoniris` en antihoraire (vérifié sur l'API le
   * 2026-08-28 : 24/24 communes de La Réunion horaires, 7/7 bassins de vie antihoraires).
   * Sans normalisation, une section `map-shapes` sur `zoniris` peint 7 rectangles pleins.
   */
  it("redresse un contour antihoraire : même boîte que son jumeau horaire", () => {
    const horaire = projectShapes([couche("a", [contour("x", rectangle(55.2, -21.0, 0.4, 0.1))])]);
    const antihoraire = projectShapes([couche("a", [contour("x", rectangleInverse(55.2, -21.0, 0.4, 0.1))])]);

    expect(antihoraire.height).toBe(horaire.height);
    const attendue = boite(horaire.shapes[0].d);
    const obtenue = boite(antihoraire.shapes[0].d);
    expect(obtenue.gauche).toBeCloseTo(attendue.gauche, 3);
    expect(obtenue.droite).toBeCloseTo(attendue.droite, 3);
    expect(obtenue.haut).toBeCloseTo(attendue.haut, 3);
    expect(obtenue.bas).toBeCloseTo(attendue.bas, 3);
  });

  it("garde la superposition quand les deux conventions se mélangent dans la même section", () => {
    // Le cas réel : une couche « communes » (horaire) sous une couche « bassins de vie »
    // (antihoraire). Le bassin est DANS la commune : sa boîte doit le rester après projection.
    const projection = projectShapes([
      couche("communes", [contour("commune", rectangle(55.2, -21.1, 0.4, 0.2))]),
      couche("bassins", [contour("bassin", rectangleInverse(55.25, -21.05, 0.1, 0.05))]),
    ]);

    const commune = boite(projection.shapes[0].d);
    const bassin = boite(projection.shapes[1].d);
    expect(bassin.gauche).toBeGreaterThan(commune.gauche);
    expect(bassin.droite).toBeLessThan(commune.droite);
    expect(bassin.haut).toBeGreaterThan(commune.haut);
    expect(bassin.bas).toBeLessThan(commune.bas);
    // Et la commune, elle, cadre toujours le bloc (elle n'a pas été écrasée par un contour-globe).
    expect(commune.droite).toBeCloseTo(SHAPE_VIEW_WIDTH, 5);
  });

  it("ne recopie pas la géométrie d'entrée quand il n'y a rien à retourner", () => {
    // La donnée vient du cache React Query, partagé avec la carte : la projection ne doit ni la
    // muter, ni la dupliquer inutilement (un contour legacy pèse des milliers de points).
    const geometry = rectangle(55.2, -21.0, 0.2, 0.1);
    const copie = structuredClone(geometry);
    const feature = contour("x", geometry);
    projectShapes([couche("a", [feature])]);
    expect(feature.geometry).toBe(geometry);
    expect(geometry).toEqual(copie);

    const inverse = rectangleInverse(55.2, -21.0, 0.2, 0.1);
    const copieInverse = structuredClone(inverse);
    const featureInverse = contour("y", inverse);
    projectShapes([couche("a", [featureInverse])]);
    // Retournée POUR LA PROJECTION, mais la feature d'origine reste intacte.
    expect(featureInverse.geometry).toEqual(copieInverse);
  });
});

describe("projectShapes — libellés", () => {
  const nommes = [
    contour("c1", rectangle(55.2, -21.0, 0.4, 0.4), { name: "Grande" }),
    contour("c2", rectangle(55.7, -21.0, 0.3, 0.3), { name: "Moyenne" }),
    contour("c3", rectangle(56.1, -21.0, 0.2, 0.2), { name: "Petite" }),
    contour("c4", rectangle(56.4, -21.0, 0.1, 0.1), { name: "Minuscule" }),
  ];

  it("ne libelle RIEN sans showNames", () => {
    expect(projectShapes([couche("communes", nommes)]).labels).toEqual([]);
    expect(projectShapes([couche("communes", nommes, { showNames: false })]).labels).toEqual([]);
  });

  it("pose un libellé par contour nommé quand showNames est vrai", () => {
    const { labels, height } = projectShapes([couche("communes", nommes, { showNames: true })]);

    expect(labels.map((l) => l.text).sort()).toEqual(["Grande", "Minuscule", "Moyenne", "Petite"]);
    expect(new Set(labels.map((l) => l.key)).size).toBe(labels.length);
    for (const label of labels) {
      expect(Number.isFinite(label.x)).toBe(true);
      expect(label.x).toBeGreaterThanOrEqual(0);
      expect(label.x).toBeLessThanOrEqual(SHAPE_VIEW_WIDTH);
      expect(label.y).toBeGreaterThanOrEqual(0);
      expect(label.y).toBeLessThanOrEqual(height);
    }
  });

  it("plafonne les libellés et garde les contours les plus VASTES", () => {
    // Un libellé = un nœud : au-delà du plafond ce sont les grands territoires qu'on nomme,
    // les petits étant de toute façon illisibles à cette échelle.
    const { labels } = projectShapes([couche("communes", nommes, { showNames: true })], { maxLabels: 2 });
    expect(labels.map((l) => l.text)).toEqual(["Grande", "Moyenne"]);
  });

  it("ne libelle jamais un contour sans `name`, et n'en fait pas non plus un titre", () => {
    const { shapes, labels } = projectShapes([
      couche(
        "communes",
        [
          contour("c1", rectangle(55.2, -21.0, 0.4, 0.4), { name: "Nommée" }),
          contour("c2", rectangle(55.7, -21.0, 0.3, 0.3)),
          contour("c3", rectangle(56.1, -21.0, 0.3, 0.3), { name: "" }),
          contour("c4", rectangle(56.5, -21.0, 0.3, 0.3), { name: 42 }),
        ],
        { showNames: true },
      ),
    ]);

    expect(labels.map((l) => l.text)).toEqual(["Nommée"]);
    // `name` n'est exposé que s'il est une chaîne non vide : le composant en fait un `<title>`
    // et un `aria-label`, un « 42 » ou un vide y seraient du bruit pour les lecteurs d'écran.
    expect(shapes.map((s) => s.name)).toEqual(["Nommée", null, null, null]);
  });

  it("encaisse une géométrie non surfacique sans casser le reste de la couche", () => {
    // `toFeatureCollection` laisse passer les `LineString` (contours de rivière, tracés) : elles
    // se peignent, mais il n'y a pas d'« intérieur » où poser un libellé.
    const ligne: Geometry = {
      type: "LineString",
      coordinates: [
        [55.2, -21.0],
        [55.6, -20.8],
      ],
    };
    const { shapes, labels, height } = projectShapes([
      couche(
        "mixte",
        [contour("poly", rectangle(55.2, -21.0, 0.4, 0.4), { name: "Surface" }), contour("ligne", ligne, { name: "Rivière" })],
        { showNames: true },
      ),
    ]);

    expect(shapes.map((s) => s.key)).toEqual(["mixte-poly", "mixte-ligne"]);
    expect(shapes[1].d).not.toBe("");
    expect(labels.map((l) => l.text)).toEqual(["Surface"]);
    expect(Number.isFinite(height)).toBe(true);
    expect(height).toBeGreaterThan(0);
  });

  it("expose les propriétés du contour telles quelles (elles portent le lien)", () => {
    const { shapes } = projectShapes([
      couche("communes", [contour("c1", carre(55.2, -21.0), { name: "Saint-Paul", insee: "97415", docId: "c1" })]),
    ]);
    // `shapeHref` les relit : les perdre rendrait tous les contours non cliquables, en silence.
    expect(shapes[0].properties).toEqual({ name: "Saint-Paul", insee: "97415", docId: "c1" });
    expect(shapes[0].layerId).toBe("communes");
  });
});
