// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { SearchEntity } from "@communecter/cocolight-api-client";

/**
 * Câblage de la fiche structure (partagée SSBE + Ekilib.re), corrigé en review de la MR `n-dev` → `main` :
 * - blocs Informations + Documents réservés aux gestionnaires (`canEditProfile`), comme le bloc
 *   `$ssbeCanManage` de la fiche legacy ; la fiche complète n'est même pas chargée sans ce droit ;
 * - la fiche AFFICHE l'entité que la modale MODIFIE, et la recharge à la fermeture de la modale
 *   (sinon elle restait sur les anciennes valeurs après enregistrement).
 * La règle de droits elle-même (`useProfilPermissions`) n'est pas re-testée ici.
 */

const ctx = vi.hoisted(() => ({
  canEdit: false,
  full: null as unknown,
  refetch: vi.fn(),
  lastOptions: undefined as { enabled?: boolean } | undefined,
}));
vi.mock("@/modules/profil/hooks/useProfilPermissions", () => ({
  useProfilPermissions: () => ({ canEditProfile: ctx.canEdit }),
}));
vi.mock("@/hooks/useEntityBySlugQuery", () => ({
  useEntityBySlugQuery: ({ options }: { options?: { enabled?: boolean } }) => {
    ctx.lastOptions = options;
    return { data: options?.enabled ? ctx.full : null, refetch: ctx.refetch };
  },
}));
// La modale réelle charge le registre de formulaires : une doublure qui sait seulement se fermer.
vi.mock("@/modules/profil/components/profile-edit/EditModalRegistry", () => ({
  DynamicEditModal: ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) =>
    open ? <button onClick={() => onOpenChange(false)}>fermer-modale</button> : null,
}));
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/modules/profil/components/sections/ProfileMapLeaflet", () => ({ default: () => null }));
vi.mock("@/components/layout/LazyImage", () => ({ default: () => null }));

import PreviewStructure from "./PreviewStructure";

const fiche = (serverData: Record<string, unknown>) => ({ id: "org1", serverData }) as unknown as SearchEntity;
const BASE = { slug: "ma-structure", thematic: ["Sport"], created: 1_700_000_000 };
const item = fiche({ ...BASE, name: "Nom de la recherche" });

beforeEach(() => {
  ctx.canEdit = false;
  ctx.full = null;
  ctx.refetch.mockClear();
  ctx.lastOptions = undefined;
});

describe("PreviewStructure — visiteur (non gestionnaire)", () => {
  it("ne charge pas la fiche complète et n'affiche ni Informations ni Documents", () => {
    ctx.full = fiche({ ...BASE, name: "Nom complet", files: { d1: { _id: "d1", name: "statuts.pdf", docPath: "/u/s.pdf", subKey: "statusFile" } } });
    render(<PreviewStructure item={item} />);
    expect(ctx.lastOptions?.enabled).toBe(false);
    expect(screen.getAllByText("Nom de la recherche").length).toBeGreaterThan(0);
    expect(screen.queryByText("PreviewStructure.information")).toBeNull();
    expect(screen.queryByText("PreviewStructure.documents")).toBeNull();
    expect(screen.queryByText("statuts.pdf")).toBeNull();
  });
});

describe("PreviewStructure — site web", () => {
  const href = () => screen.getByLabelText("PreviewStructure.website").getAttribute("href");

  it("`link` (écrit par le formulaire et le legacy) l'emporte sur `url`, et reçoit son schéma", () => {
    render(<PreviewStructure item={fiche({ ...BASE, name: "x", url: "https://letampon.fr", link: "www.letampon.fr" })} />);
    expect(href()).toBe("https://www.letampon.fr");
  });

  it("fiche ancienne : repli sur `url`, laissée intacte", () => {
    render(<PreviewStructure item={fiche({ ...BASE, name: "x", url: "https://promotionsante.re/" })} />);
    expect(href()).toBe("https://promotionsante.re/");
  });
});

describe("PreviewStructure — badge « Affiliée »", () => {
  // Formes reçues par le front, mesurées en prod le 25/09 : "Oui"/"Non" (fiches historiques),
  // true/false (les chaînes "true"/"false" du formulaire actuel, converties par l'API).
  const badge = (affiliate: unknown) => {
    render(<PreviewStructure item={fiche({ ...BASE, name: "x", affiliateTo: "Fédération X", affiliate })} />);
    return screen.queryByText("PreviewStructure.affiliated");
  };

  it.each([["Oui"], [true], ["true"]])("affiliate %j → badge affiché", (affiliate) => {
    expect(badge(affiliate)).not.toBeNull();
  });

  it.each([["Non"], [false], ["false"], [undefined]])("affiliate %j → pas de badge", (affiliate) => {
    expect(badge(affiliate)).toBeNull();
  });
});

describe("PreviewStructure — gestionnaire", () => {
  beforeEach(() => {
    ctx.canEdit = true;
    ctx.full = fiche({ ...BASE, name: "Nom complet", files: { d1: { _id: "d1", name: "statuts.pdf", docPath: "/u/s.pdf", subKey: "statusFile" } } });
  });

  it("affiche la fiche complète (celle que la modale modifie), avec Informations et Documents", () => {
    render(<PreviewStructure item={item} />);
    expect(ctx.lastOptions?.enabled).toBe(true);
    expect(screen.getAllByText("Nom complet").length).toBeGreaterThan(0);
    expect(screen.queryByText("Nom de la recherche")).toBeNull();
    expect(screen.getByText("PreviewStructure.information")).toBeTruthy();
    expect(screen.getByText("PreviewStructure.documents")).toBeTruthy();
    expect(screen.getByText("statuts.pdf")).toBeTruthy();
  });

  it("recharge la fiche complète à la fermeture de la modale d'édition", () => {
    render(<PreviewStructure item={item} />);
    fireEvent.click(screen.getByText("PreviewStructure.edit"));
    expect(ctx.refetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("fermer-modale"));
    expect(ctx.refetch).toHaveBeenCalledTimes(1);
  });

  it("tant que la fiche complète n'est pas chargée, affiche l'item de recherche", () => {
    ctx.full = null;
    render(<PreviewStructure item={item} />);
    expect(screen.getAllByText("Nom de la recherche").length).toBeGreaterThan(0);
  });
});
