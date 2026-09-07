import { describe, expect, it, vi } from "vitest";
import {
  canInviteContributors,
  isAdminContributorLink,
  isProjectAdmin,
  toCommunContributors,
  toContributorRoles,
} from "./communContributors";

/** Un résultat de recherche minimal — même forme qu'un `User`/`Organization` du SDK. */
function fiche(
  id: string,
  serverData: Record<string, unknown> = {},
  type: string = "citoyens"
) {
  return { id, serverData: { name: id, ...serverData }, getEntityType: () => type };
}

describe("isAdminContributorLink", () => {
  it("accepte le booléen ET la chaîne — le drapeau voyage sous les deux formes", () => {
    expect(isAdminContributorLink({ isAdmin: true })).toBe(true);
    expect(isAdminContributorLink({ isAdmin: "true" })).toBe(true);
  });

  it("refuse tout le reste, y compris l'absence de lien", () => {
    expect(isAdminContributorLink({ isAdmin: false })).toBe(false);
    expect(isAdminContributorLink({ isAdmin: "false" })).toBe(false);
    expect(isAdminContributorLink({ type: "citoyens" })).toBe(false);
    expect(isAdminContributorLink(undefined)).toBe(false);
    expect(isAdminContributorLink("citoyens")).toBe(false);
  });
});

describe("toContributorRoles", () => {
  it("accepte les trois formes que produit Communecter", () => {
    expect(toContributorRoles({ roles: ["Développeuse", "Animation"] })).toEqual([
      "Développeuse",
      "Animation",
    ]);
    // Map indexée : le même tableau, passé par une sérialisation Mongo.
    expect(toContributorRoles({ roles: { "0": "Développeuse", "1": "Animation" } })).toEqual([
      "Développeuse",
      "Animation",
    ]);
    expect(toContributorRoles({ roles: "Animation" })).toEqual(["Animation"]);
  });

  it("garde l'ordre d'origine — c'est celui que le projet a choisi", () => {
    expect(toContributorRoles({ roles: ["Zoologie", "Animation"] })).toEqual([
      "Zoologie",
      "Animation",
    ]);
  });

  it("nettoie sans interpréter : trim, vides écartées, doublons ignorés", () => {
    expect(
      toContributorRoles({ roles: ["  Animation  ", "", "   ", "Animation", "Design"] })
    ).toEqual(["Animation", "Design"]);
  });

  it("écarte ce qui n'est pas une chaîne plutôt que de le rendre tel quel", () => {
    expect(toContributorRoles({ roles: ["Design", 42, null, { nom: "Dev" }] })).toEqual(["Design"]);
  });

  it("rend un tableau vide quand il n'y a rien à lire", () => {
    expect(toContributorRoles({ isAdmin: true })).toEqual([]);
    expect(toContributorRoles({ roles: [] })).toEqual([]);
    expect(toContributorRoles(undefined)).toEqual([]);
    expect(toContributorRoles("Animation")).toEqual([]);
  });
});

describe("toCommunContributors", () => {
  it("joint le rôle du document projet à la fiche trouvée par la recherche", () => {
    const resultat = toCommunContributors(
      [fiche("u1", { name: "Alice", slug: "alice", profilMediumImageUrl: "/img/alice.png" })],
      { u1: { type: "citoyens", isAdmin: true, roles: ["Développeuse"] } }
    );

    expect(resultat).toEqual([
      {
        id: "u1",
        name: "Alice",
        slug: "alice",
        imageUrl: "/img/alice.png",
        type: "citoyens",
        isAdmin: true,
        roles: ["Développeuse"],
      },
    ]);
  });

  it("rend `roles` vide plutôt qu'absent quand le lien n'en porte pas", () => {
    const [sansRole] = toCommunContributors([fiche("u1")], { u1: { type: "citoyens" } });
    expect(sansRole.roles).toEqual([]);
  });

  it("relit la forme déjà normalisée que le hook met en cache", () => {
    // `useCommunProjectContributors` range `{isAdmin, roles}` en JSON nu : cette
    // forme doit repasser ici sans second chemin de code (grille « en attente »).
    const [contributeur] = toCommunContributors([fiche("u1")], {
      u1: { isAdmin: true, roles: ["Animation"] },
    });
    expect(contributeur.isAdmin).toBe(true);
    expect(contributeur.roles).toEqual(["Animation"]);
  });

  it("classe les porteur·ses d'abord, puis par nom", () => {
    const resultat = toCommunContributors(
      [fiche("u1", { name: "Zoé" }), fiche("u2", { name: "Alice" }), fiche("u3", { name: "Bob" })],
      { u3: { isAdmin: true } }
    );

    expect(resultat.map((c) => c.name)).toEqual(["Bob", "Alice", "Zoé"]);
  });

  it("laisse le nom vide plutôt que d'inventer un repli — c'est à l'UI de le traduire", () => {
    const resultat = toCommunContributors([fiche("u1", { name: "   " })], {});
    expect(resultat[0].name).toBe("");
  });

  it("relègue les fiches sans nom en fin de liste", () => {
    const resultat = toCommunContributors(
      [fiche("u1", { name: "" }), fiche("u2", { name: "Alice" })],
      {}
    );
    expect(resultat.map((c) => c.id)).toEqual(["u2", "u1"]);
  });

  it("ignore les doublons d'id — la recherche peut ramener deux fois la même fiche", () => {
    const resultat = toCommunContributors([fiche("u1"), fiche("u1")], {});
    expect(resultat).toHaveLength(1);
  });

  it("retombe sur l'id Mongo de `serverData` quand la fiche n'expose pas `id`", () => {
    const resultat = toCommunContributors(
      [{ serverData: { _id: { $id: "u9" }, name: "Alice" } }],
      { u9: { isAdmin: true } }
    );

    expect(resultat[0].id).toBe("u9");
    expect(resultat[0].isAdmin).toBe(true);
  });

  it("écarte les fiches sans id : sans lui, aucun rôle ni aucune clé de rendu", () => {
    expect(toCommunContributors([{ serverData: { name: "Fantôme" } }], {})).toEqual([]);
  });

  it("tient un lien absent pour « pas administrateur », jamais pour une erreur", () => {
    const resultat = toCommunContributors([fiche("u1")], null);
    expect(resultat[0].isAdmin).toBe(false);
  });

  it("garde le type d'entité — c'est lui qui distingue une orga d'un citoyen", () => {
    const resultat = toCommunContributors(
      [fiche("o1", { name: "La CAE" }, "organizations")],
      {}
    );
    expect(resultat[0].type).toBe("organizations");
  });

  it("rend une liste vide sans résultat de recherche", () => {
    expect(toCommunContributors(undefined, { u1: { isAdmin: true } })).toEqual([]);
  });
});

describe("isProjectAdmin", () => {
  it("reconnaît le lien direct d'administration du projet", () => {
    expect(isProjectAdmin({ isAdmin: () => true })).toBe(true);
    expect(isProjectAdmin({ isAdmin: () => false })).toBe(false);
  });

  it("demande le silence au SDK — un visiteur sans lien n'est pas une anomalie", () => {
    const isAdmin = vi.fn(() => true);
    isProjectAdmin({ isAdmin });
    expect(isAdmin).toHaveBeenCalledWith({ silent: true });
  });

  it("refuse plutôt que de casser la page quand `isAdmin()` lève", () => {
    expect(
      isProjectAdmin({
        isAdmin: () => {
          throw new Error("pas de contexte utilisateur");
        },
      })
    ).toBe(false);
  });

  it("refuse sur une instance publique, qui n'expose pas le lien de rattachement", () => {
    expect(isProjectAdmin({} as { isAdmin?: () => boolean })).toBe(false);
    expect(isProjectAdmin(null)).toBe(false);
    expect(isProjectAdmin(undefined)).toBe(false);
  });
});

describe("canInviteContributors", () => {
  it("ouvre l'ajout à l'administrateur·rice du projet", () => {
    expect(canInviteContributors({ isAdmin: () => true })).toBe(true);
  });

  it("l'ouvre AUSSI au déposant qui n'administre pas le projet lié", () => {
    // Projet généré par l'admin de l'appel, ou projet existant associé par un
    // tiers : le déposant n'y a pas de lien d'admin, c'est pourtant son commun.
    expect(canInviteContributors({ isAdmin: () => false }, { isCommunAuthor: true })).toBe(true);
    expect(canInviteContributors(null, { isCommunAuthor: true })).toBe(true);
  });

  it("ne consulte même pas le projet quand le visiteur est le déposant", () => {
    const isAdmin = vi.fn(() => false);
    expect(canInviteContributors({ isAdmin }, { isCommunAuthor: true })).toBe(true);
    expect(isAdmin).not.toHaveBeenCalled();
  });

  it("le refuse au simple contributeur comme au visiteur", () => {
    expect(canInviteContributors({ isAdmin: () => false })).toBe(false);
    expect(canInviteContributors({ isAdmin: () => false }, { isCommunAuthor: false })).toBe(false);
    expect(canInviteContributors(null)).toBe(false);
    expect(canInviteContributors(undefined)).toBe(false);
  });
});
