// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Garde d'authentification des modales d'AJOUT.
 *
 * Ce qui est protégé : toutes les clés de ce registre sont des `add-*`, et
 * `runEntityMutation` crée sur `me` (`throw "No entity provided"` sans session).
 * Sans garde, un visiteur remplissait le formulaire entier pour récolter un
 * toast d'erreur technique à l'envoi.
 */

const state = vi.hoisted(() => ({
  isConnected: false,
  costumForms: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@/modules/auth/hooks/useAuthActions", () => ({
  useAuthActions: () => ({ isConnected: state.isConnected }),
}));
vi.mock("@/modules/auth", () => ({
  LoginPrompt: () => <div data-testid="login-prompt" />,
}));
vi.mock("@/hooks/useSite", () => ({
  useSite: () => ({ config: { costumForms: state.costumForms } }),
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
// `useT` route selon le type : une string est une clé i18n, un objet est un
// `LocalizedString` à résoudre par locale. Le stub reproduit ce routage, car
// c'est précisément ce que la surcharge de config exerce.
vi.mock("@/hooks/useT", () => ({
  useT: () => (v: unknown) => (typeof v === "string" ? v : (v as { fr: string }).fr),
}));

// Le formulaire réel est chargé en `lazy()` (import dynamique) : on le remplace
// par un marqueur synchrone, sans quoi le test observerait le Suspense.
vi.mock("../../../forms/EntityFormModal", () => ({
  EntityFormModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="entity-form" /> : null,
}));

import { DynamicModal } from "./ModalRegistry";

describe("DynamicModal — garde d'authentification", () => {
  beforeEach(() => {
    state.isConnected = false;
    state.costumForms = undefined;
  });

  it("non connecté ET ouvert : rend l'invite de connexion, PAS le formulaire", () => {
    render(<DynamicModal modalName="add-organization" open onOpenChange={() => {}} />);
    expect(screen.getByTestId("login-prompt")).toBeInTheDocument();
    expect(screen.queryByTestId("entity-form")).not.toBeInTheDocument();
  });

  it("non connecté mais FERMÉ : aucune invite (le garde ne se déclenche qu'à l'ouverture)", () => {
    render(<DynamicModal modalName="add-organization" open={false} onOpenChange={() => {}} />);
    expect(screen.queryByTestId("login-prompt")).not.toBeInTheDocument();
  });

  it("🔒 connecté : le garde s'efface — le comportement d'avant est inchangé", () => {
    state.isConnected = true;
    render(<DynamicModal modalName="add-organization" open onOpenChange={() => {}} />);
    expect(screen.queryByTestId("login-prompt")).not.toBeInTheDocument();
  });

  it("clé inconnue du registre : rien n'est rendu, même non connecté", () => {
    render(<DynamicModal modalName="cette-modale-nexiste-pas" open onOpenChange={() => {}} />);
    expect(screen.queryByTestId("login-prompt")).not.toBeInTheDocument();
    expect(screen.queryByTestId("entity-form")).not.toBeInTheDocument();
  });
});

describe("DynamicModal — textes de l'invite surchargeables par la config", () => {
  beforeEach(() => {
    state.isConnected = false;
    state.costumForms = undefined;
  });

  it("sans surcharge : les traductions par défaut sont employées", () => {
    render(<DynamicModal modalName="add-organization" open onOpenChange={() => {}} />);
    expect(screen.getByText("AuthRequired.title")).toBeInTheDocument();
    expect(screen.getByText("AuthRequired.description")).toBeInTheDocument();
  });

  it("`chrome.authPrompt` du formulaire costum remplace titre et phrase", () => {
    state.costumForms = {
      "institut-bleu-acteur": {
        chrome: {
          authPrompt: {
            title: { fr: "Un compte est nécessaire" },
            description: { fr: "La fiche reste rattachée à votre compte." },
          },
        },
      },
    };
    render(<DynamicModal modalName="add-institut-bleu-acteur" open onOpenChange={() => {}} />);
    expect(screen.getByText("Un compte est nécessaire")).toBeInTheDocument();
    expect(screen.queryByText("AuthRequired.title")).not.toBeInTheDocument();
  });

  it("surcharge PARTIELLE : la clé absente retombe sur la traduction", () => {
    state.costumForms = {
      "institut-bleu-acteur": { chrome: { authPrompt: { title: { fr: "Un compte est nécessaire" } } } },
    };
    render(<DynamicModal modalName="add-institut-bleu-acteur" open onOpenChange={() => {}} />);
    expect(screen.getByText("Un compte est nécessaire")).toBeInTheDocument();
    expect(screen.getByText("AuthRequired.description")).toBeInTheDocument();
  });

  it("l'entrée `costumForms` d'un AUTRE formulaire ne fuit pas sur celui-ci", () => {
    state.costumForms = {
      "un-autre-form": { chrome: { authPrompt: { title: { fr: "Message d’un autre site" } } } },
    };
    render(<DynamicModal modalName="add-institut-bleu-acteur" open onOpenChange={() => {}} />);
    expect(screen.getByText("AuthRequired.title")).toBeInTheDocument();
  });
});
