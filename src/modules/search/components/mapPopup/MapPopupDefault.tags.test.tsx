// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { MapPopupDefault } from "./MapPopupDefault";
import type { SearchEntity } from "@communecter/cocolight-api-client";

const t = (key: string) => key;
const item = (tags: unknown) => ({ id: "x", serverData: { name: "Cabinet X", tags } }) as unknown as SearchEntity;

/**
 * Chips de tags de la popup : la MÊME conf que la carte de liste (`list.card.tagColors`). Un annuaire
 * filtré sur un marqueur (`lieux-sante`) le masque en liste ; la popup ne doit pas le révéler.
 */
describe("MapPopupDefault — chips de tags", () => {
  it("sans conf : les tags s'affichent tels quels, 4 au plus puis « +N »", () => {
    const { getByText, queryByText } = render(<MapPopupDefault item={item(["a", "b", "c", "d", "e"])} t={t} />);
    for (const x of ["#a", "#b", "#c", "#d"]) expect(getByText(x)).toBeInTheDocument();
    expect(queryByText("#e")).toBeNull();
    expect(getByText("+1")).toBeInTheDocument();
  });

  it("tagColors.hideTags : le marqueur d'annuaire n'apparaît pas, les mots-clés libres restent", () => {
    const { getByText, queryByText } = render(
      <MapPopupDefault item={item(["lieux-sante", "pharmacie"])} t={t} tagColors={{ mapping: {}, hideTags: ["lieux-sante"] }} />,
    );
    expect(queryByText("#lieux-sante")).toBeNull();
    expect(getByText("#pharmacie")).toBeInTheDocument();
  });

  it("tags en objet (forme PHP) : rendus sans exception", () => {
    const { getByText } = render(<MapPopupDefault item={item({ "1": "Pedagogie" })} t={t} />);
    expect(getByText("#Pedagogie")).toBeInTheDocument();
  });
});
