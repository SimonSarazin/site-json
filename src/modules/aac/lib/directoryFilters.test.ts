import { describe, expect, it } from "vitest";
import {
  DEFAULT_AAC_DIRECTORY_FILTERS,
  resolveDirectoryFilters,
  type AacDirectoryFiltersConfig,
} from "./directoryFilters";
import { AacDirectorySectionSchema } from "../schema";

const ALL_ON = { search: true, usage: true, tags: true, maturity: true, sort: true };

describe("resolveDirectoryFilters", () => {
  it("un bloc PARTIEL n'éteint que les filtres cités — les autres restent au défaut (M4/M22/M24)", () => {
    // Le cas de la revue : `{"search": false}` éteignait usage, tags, maturity et sort.
    expect(resolveDirectoryFilters({ search: false })).toEqual({ ...ALL_ON, search: false });
    expect(resolveDirectoryFilters({ sort: false, maturity: false })).toEqual({
      ...ALL_ON,
      sort: false,
      maturity: false,
    });
  });

  it("un bloc VIDE vaut le défaut", () => {
    expect(resolveDirectoryFilters({})).toEqual(ALL_ON);
  });

  it("un bloc ABSENT vaut le défaut (undefined comme null)", () => {
    expect(resolveDirectoryFilters(undefined)).toEqual(ALL_ON);
    expect(resolveDirectoryFilters(null)).toEqual(ALL_ON);
  });

  it("un bloc COMPLET est honoré tel quel", () => {
    const allOff = { search: false, usage: false, tags: false, maturity: false, sort: false };
    expect(resolveDirectoryFilters(allOff)).toEqual(allOff);
    expect(resolveDirectoryFilters(ALL_ON)).toEqual(ALL_ON);
  });

  it("une clé à `undefined` est « non renseignée », pas `false` — comme pour Zod", () => {
    const partial: AacDirectoryFiltersConfig = { search: undefined, tags: false };
    expect(resolveDirectoryFilters(partial)).toEqual({ ...ALL_ON, tags: false });
  });

  it("ne mute ni le défaut ni l'entrée", () => {
    const input = { search: false };
    const resolved = resolveDirectoryFilters(input);
    resolved.usage = false;

    expect(input).toEqual({ search: false });
    expect(DEFAULT_AAC_DIRECTORY_FILTERS).toEqual(ALL_ON);
  });

  it("le défaut du composant est celui du schéma — une seule vérité, pas de dérive", () => {
    // Le schéma n'est pas parsé à l'exécution : c'est ce test qui tient les deux
    // sources alignées si l'une change sans l'autre.
    const fromSchema = AacDirectorySectionSchema.shape.props.shape.filters.parse(undefined);
    expect(DEFAULT_AAC_DIRECTORY_FILTERS).toEqual(fromSchema);
    expect(resolveDirectoryFilters({ search: false })).toEqual(
      AacDirectorySectionSchema.shape.props.shape.filters.parse({ search: false })
    );
  });
});
