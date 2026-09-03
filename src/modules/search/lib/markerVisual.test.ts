import { describe, it, expect } from "vitest";
import { resolveMarkerVisual } from "./markerVisual";

const BASE = "https://backend.example";

describe("resolveMarkerVisual (chaîne de repli des marqueurs)", () => {
  it("useItemImage + image présente → vignette (URL relative préfixée)", () => {
    const v = resolveMarkerVisual(
      { profilThumbImageUrl: "/upload/x.jpg" },
      { useItemImage: true },
      BASE,
    );
    expect(v).toEqual({ kind: "image", src: "https://backend.example/upload/x.jpg" });
    // URL absolue conservée telle quelle ; medium en repli de thumb
    expect(
      resolveMarkerVisual({ profilMediumImageUrl: "https://cdn/x.jpg" }, { useItemImage: true }, BASE),
    ).toEqual({ kind: "image", src: "https://cdn/x.jpg" });
  });

  it("useItemImage SANS image → retombe sur le pin stylisé si déclaré", () => {
    const v = resolveMarkerVisual({}, { useItemImage: true, style: "pin", color: "chart-2" }, BASE);
    expect(v).toEqual({ kind: "pin", cssColor: "var(--chart-2)", borderCssColor: "var(--background)" });
    // …et sur le pin par défaut sinon
    expect(resolveMarkerVisual({}, { useItemImage: true }, BASE)).toEqual({ kind: "default" });
  });

  it("style pin : couleur en JETON de thème (déf. primary), bordure background par défaut", () => {
    expect(resolveMarkerVisual({}, { style: "pin" }, BASE)).toEqual({
      kind: "pin",
      cssColor: "var(--primary)",
      borderCssColor: "var(--background)",
    });
  });

  it("borderColor configurable en JETON de thème, pour le pin ET le circle", () => {
    expect(resolveMarkerVisual({}, { style: "pin", color: "primary", borderColor: "accent" }, BASE)).toEqual({
      kind: "pin",
      cssColor: "var(--primary)",
      borderCssColor: "var(--accent)",
    });
    expect(resolveMarkerVisual({}, { style: "circle", color: "primary", borderColor: "accent" }, BASE)).toEqual({
      kind: "circle",
      cssColor: "var(--primary)",
      borderCssColor: "var(--accent)",
    });
  });

  it("style circle : pastille ronde, même résolution couleur+bordure que le pin (déf. background)", () => {
    expect(resolveMarkerVisual({}, { style: "circle", color: "secondary" }, BASE)).toEqual({
      kind: "circle",
      cssColor: "var(--secondary)",
      borderCssColor: "var(--background)",
    });
  });

  it("iconUrl → icône custom (URL relative préfixée, taille + ancrage par défaut)", () => {
    expect(resolveMarkerVisual({}, { iconUrl: "/upload/pin.svg" }, BASE)).toEqual({
      kind: "icon",
      src: "https://backend.example/upload/pin.svg",
      size: 34,
      anchor: "bottom",
    });
    // URL absolue conservée ; taille + ancrage custom
    expect(
      resolveMarkerVisual({}, { iconUrl: "https://cdn/p.png", iconSize: 48, iconAnchor: "center" }, BASE),
    ).toEqual({ kind: "icon", src: "https://cdn/p.png", size: 48, anchor: "center" });
  });

  it("priorité : vignette d'item > icône custom > pin", () => {
    // useItemImage + image l'emporte sur iconUrl
    expect(
      resolveMarkerVisual({ profilThumbImageUrl: "/i.jpg" }, { useItemImage: true, iconUrl: "/p.svg" }, BASE),
    ).toEqual({ kind: "image", src: "https://backend.example/i.jpg" });
    // iconUrl l'emporte sur style:pin
    expect(resolveMarkerVisual({}, { iconUrl: "/p.svg", style: "pin" }, BASE).kind).toBe("icon");
  });

  it("sans config → pin par défaut", () => {
    expect(resolveMarkerVisual({ profilThumbImageUrl: "/x.jpg" }, undefined, BASE)).toEqual({
      kind: "default",
    });
  });

  it("colorBy : pin coloré PAR VALEUR, prioritaire sur le token `color`", () => {
    const colorBy = { mapping: { "territoire62:arrageois": "var(--territoire-arrageois)" } };
    expect(
      resolveMarkerVisual(
        { tags: ["territoire62:arrageois"] },
        { style: "pin", color: "chart-2", colorBy },
        BASE,
      ),
    ).toEqual({
      kind: "pin",
      cssColor: "var(--territoire-arrageois)",
      borderCssColor: "var(--background)",
    });
    // colorBy seul (sans style pin déclaré) : implique le pin
    expect(
      resolveMarkerVisual({ tags: ["territoire62:arrageois"] }, { colorBy }, BASE),
    ).toEqual({
      kind: "pin",
      cssColor: "var(--territoire-arrageois)",
      borderCssColor: "var(--background)",
    });
  });

  it("colorBy respecte `style: circle` et le `borderColor` configuré", () => {
    const colorBy = { mapping: { "territoire62:arrageois": "var(--territoire-arrageois)" } };
    expect(
      resolveMarkerVisual(
        { tags: ["territoire62:arrageois"] },
        { style: "circle", borderColor: "accent", colorBy },
        BASE,
      ),
    ).toEqual({
      kind: "circle",
      cssColor: "var(--territoire-arrageois)",
      borderCssColor: "var(--accent)",
    });
  });

  it("colorBy sans valeur mappée → repli sur le token puis le pin Leaflet", () => {
    const colorBy = { mapping: { "territoire62:arrageois": "var(--territoire-arrageois)" } };
    expect(
      resolveMarkerVisual({ tags: ["santé"] }, { style: "pin", color: "chart-2", colorBy }, BASE),
    ).toEqual({
      kind: "pin",
      cssColor: "var(--chart-2)",
      borderCssColor: "var(--background)",
    });
    expect(resolveMarkerVisual({ tags: ["santé"] }, { colorBy }, BASE)).toEqual({
      kind: "default",
    });
  });

  it("priorité : vignette d'item > colorBy > icône custom", () => {
    const colorBy = { mapping: { "territoire62:arrageois": "var(--territoire-arrageois)" } };
    // l'image de l'item reste prioritaire sur le code couleur
    expect(
      resolveMarkerVisual(
        { profilThumbImageUrl: "/i.jpg", tags: ["territoire62:arrageois"] },
        { useItemImage: true, colorBy },
        BASE,
      ),
    ).toEqual({ kind: "image", src: "https://backend.example/i.jpg" });
    // colorBy l'emporte sur une icône brandée (le code couleur porte l'info)
    expect(
      resolveMarkerVisual(
        { tags: ["territoire62:arrageois"] },
        { iconUrl: "/p.svg", colorBy },
        BASE,
      ).kind,
    ).toBe("pin");
  });
});

describe("resolveMarkerVisual — `by` : marqueur PAR VALEUR d'un attribut", () => {
  const BY = {
    path: "equip_type_famille",
    mapping: {
      Bassin: { color: "chart-1" as const },
      "Terrain de grands jeux": { style: "circle" as const, color: "chart-2" as const },
      "Salle multisports": { iconUrl: "/images/salle.svg", iconSize: 28 },
    },
    default: { color: "chart-5" as const },
  };
  const CONF = { style: "pin" as const, color: "primary" as const, by: BY };

  it("valeur listée → le cas est fusionné sur le marqueur de base", () => {
    // `Bassin` ne déclare qu'une couleur : le `style: "pin"` du base est conservé
    expect(resolveMarkerVisual({ equip_type_famille: "Bassin" }, CONF, BASE)).toEqual({
      kind: "pin",
      cssColor: "var(--chart-1)",
      borderCssColor: "var(--background)",
    });
    // un cas peut changer la forme…
    expect(
      resolveMarkerVisual({ equip_type_famille: "Terrain de grands jeux" }, CONF, BASE),
    ).toEqual({ kind: "circle", cssColor: "var(--chart-2)", borderCssColor: "var(--background)" });
    // …ou passer à l'icône custom
    expect(resolveMarkerVisual({ equip_type_famille: "Salle multisports" }, CONF, BASE)).toEqual({
      kind: "icon",
      src: "https://backend.example/images/salle.svg",
      size: 28,
      anchor: "bottom",
    });
  });

  it("valeur NON listée → `by.default`, et à défaut le marqueur de base", () => {
    expect(resolveMarkerVisual({ equip_type_famille: "Skatepark" }, CONF, BASE)).toEqual({
      kind: "pin",
      cssColor: "var(--chart-5)",
      borderCssColor: "var(--background)",
    });
    // sans `default` déclaré, c'est le marqueur de base qui sert de défaut
    const sansDefault = { ...CONF, by: { path: BY.path, mapping: BY.mapping } };
    expect(resolveMarkerVisual({ equip_type_famille: "Skatepark" }, sansDefault, BASE)).toEqual({
      kind: "pin",
      cssColor: "var(--primary)",
      borderCssColor: "var(--background)",
    });
  });

  it("attribut ABSENT de la projection (undefined) → traité comme non listé", () => {
    // piège `defaultFields` : le champ non projeté vaut undefined, aucun cas ne matche
    expect(resolveMarkerVisual({ name: "Stade" }, CONF, BASE)).toMatchObject({ cssColor: "var(--chart-5)" });
    expect(resolveMarkerVisual(undefined, CONF, BASE)).toMatchObject({ cssColor: "var(--chart-5)" });
  });

  it("attribut TABLEAU → la 1re valeur de l'item présente dans le mapping gagne", () => {
    expect(
      resolveMarkerVisual({ equip_type_famille: ["Inconnue", "Bassin"] }, CONF, BASE),
    ).toMatchObject({ cssColor: "var(--chart-1)" });
    // l'ordre de l'ITEM fait foi, pas celui du mapping
    expect(
      resolveMarkerVisual(
        { equip_type_famille: ["Terrain de grands jeux", "Bassin"] },
        CONF,
        BASE,
      ).kind,
    ).toBe("circle");
  });

  it("valeur non-string (nombre, booléen) → comparée en chaîne", () => {
    const conf = { style: "pin" as const, by: { path: "categorie", mapping: { "2": { color: "chart-3" as const } } } };
    expect(resolveMarkerVisual({ categorie: 2 }, conf, BASE)).toMatchObject({ cssColor: "var(--chart-3)" });
  });

  it("un cas qui déclare un SÉLECTEUR de rendu écarte ceux du marqueur de base", () => {
    // le piège : sans cette règle, l'iconUrl du base (plus haut dans la chaîne)
    // masquerait le `style: "pin"` du cas en silence.
    const conf = {
      iconUrl: "/images/defaut.svg",
      borderColor: "accent" as const,
      by: { path: "type", mapping: { stade: { style: "pin" as const, color: "chart-2" as const } } },
    };
    expect(resolveMarkerVisual({ type: "stade" }, conf, BASE)).toEqual({
      kind: "pin",
      cssColor: "var(--chart-2)",
      // les champs NON sélecteurs (couleur de bordure, tailles) restent hérités
      borderCssColor: "var(--accent)",
    });
    // valeur non listée : le marqueur de base est intact
    expect(resolveMarkerVisual({ type: "piscine" }, conf, BASE).kind).toBe("icon");
  });

  it("`by` se combine avec les autres étages (vignette d'item, colorBy)", () => {
    const conf = {
      style: "pin" as const,
      by: { path: "type", mapping: { personne: { useItemImage: true } }, default: { color: "chart-4" as const } },
    };
    expect(
      resolveMarkerVisual({ type: "personne", profilThumbImageUrl: "/i.jpg" }, conf, BASE),
    ).toEqual({ kind: "image", src: "https://backend.example/i.jpg" });
    // cas `useItemImage` SANS image : le style du base a été écarté (sélecteur) → défaut
    expect(resolveMarkerVisual({ type: "personne" }, conf, BASE)).toEqual({ kind: "default" });
    expect(resolveMarkerVisual({ type: "lieu" }, conf, BASE)).toMatchObject({ cssColor: "var(--chart-4)" });
  });
});

describe("resolveMarkerVisual — `icon` : pictogramme lucide dans la forme", () => {
  it("`icon` seul → goutte + glyphe (pas besoin de déclarer style)", () => {
    expect(resolveMarkerVisual({}, { icon: "waves" }, BASE)).toEqual({
      kind: "pin-icon",
      icon: "waves",
      cssColor: "var(--primary)",
      borderCssColor: "var(--background)",
    });
  });

  it("`icon` + style circle → pastille + glyphe ; les couleurs restent des jetons", () => {
    expect(
      resolveMarkerVisual({}, { style: "circle", color: "chart-2", borderColor: "accent", icon: "goal" }, BASE),
    ).toEqual({
      kind: "circle-icon",
      icon: "goal",
      cssColor: "var(--chart-2)",
      borderCssColor: "var(--accent)",
    });
  });

  it("`icon` se combine avec colorBy (couleur par valeur, glyphe par config)", () => {
    const colorBy = { mapping: { "territoire62:artois": "var(--territoire-artois)" } };
    expect(
      resolveMarkerVisual({ tags: ["territoire62:artois"] }, { icon: "trees", colorBy }, BASE),
    ).toEqual({
      kind: "pin-icon",
      icon: "trees",
      cssColor: "var(--territoire-artois)",
      borderCssColor: "var(--background)",
    });
  });

  it("priorité : vignette d'item > iconUrl > icon lucide", () => {
    expect(
      resolveMarkerVisual({ profilThumbImageUrl: "/i.jpg" }, { useItemImage: true, icon: "waves" }, BASE).kind,
    ).toBe("image");
    // sans image, on retombe sur la goutte + glyphe
    expect(resolveMarkerVisual({}, { useItemImage: true, icon: "waves" }, BASE).kind).toBe("pin-icon");
    // l'image brandée reste prioritaire sur le pictogramme
    expect(resolveMarkerVisual({}, { iconUrl: "/p.svg", icon: "waves" }, BASE).kind).toBe("icon");
  });

  it("`by` : un cas peut poser son propre pictogramme, ou en changer la forme", () => {
    const conf = {
      style: "pin" as const,
      color: "primary" as const,
      icon: "map-pin",
      by: {
        path: "equip_type_famille",
        mapping: {
          Bassin: { color: "chart-1" as const },
          Randonnée: { style: "circle" as const, icon: "footprints" },
        },
        default: { icon: "circle-dashed" },
      },
    };
    // cas SANS sélecteur : hérite style + icon du marqueur de base
    expect(resolveMarkerVisual({ equip_type_famille: "Bassin" }, conf, BASE)).toEqual({
      kind: "pin-icon",
      icon: "map-pin",
      cssColor: "var(--chart-1)",
      borderCssColor: "var(--background)",
    });
    // cas AVEC sélecteur (style) : les sélecteurs du base sautent, d'où l'icon redéclaré
    expect(resolveMarkerVisual({ equip_type_famille: "Randonnée" }, conf, BASE)).toMatchObject({
      kind: "circle-icon",
      icon: "footprints",
    });
    // le default aussi : `icon` seul suffit à produire la goutte
    expect(resolveMarkerVisual({ equip_type_famille: "Skatepark" }, conf, BASE)).toMatchObject({
      kind: "pin-icon",
      icon: "circle-dashed",
    });
  });
});
