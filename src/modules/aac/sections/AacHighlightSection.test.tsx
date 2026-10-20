// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import i18n from "@/i18n";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { UseAacCommunsCountResult } from "../hooks/useAacCommunsCount";
import type { AacHighlightSectionProps } from "../schema";

/**
 * État du décompte, MUTABLE d'un test à l'autre : c'est l'état de la requête
 * qu'on fait varier. Remis « en attente » avant chaque test.
 */
const countState: UseAacCommunsCountResult = { count: null, isLoading: false, error: null };

/**
 * Le socle partagé, MUTABLE lui aussi : c'est l'état de la RÉSOLUTION du
 * formulaire qui dit si le chiffre viendra un jour. Au repos : résolution
 * aboutie (`resolved` posé), donc décompte ACTIVÉ et légitimement en attente.
 */
const contextState = {
  formId: "f1" as string | null,
  resolved: {} as unknown,
  isFormLoading: false,
  configError: null as Error | null,
};
const CONTEXT_AT_REST = { ...contextState };

vi.mock("../hooks/useAacCommunsCount", () => ({
  useAacCommunsCount: () => countState,
}));
vi.mock("../hooks/useAacDirectoryContext", () => ({
  useAacDirectoryContext: () => contextState,
}));

import AacHighlightSection from "./AacHighlightSection";

function poser(over: Partial<AacHighlightSectionProps> = {}) {
  return render(
    <MemoryRouter>
      <LocalizationProvider>
        <AacHighlightSection
          props={
            {
              title: { fr: "Déposez votre commun" },
              count: { source: "communs" },
              ...over,
            } as unknown as AacHighlightSectionProps
          }
        />
      </LocalizationProvider>
    </MemoryRouter>
  );
}

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

beforeEach(() => {
  Object.assign(countState, { count: null, isLoading: false, error: null });
  Object.assign(contextState, CONTEXT_AT_REST);
});

/**
 * M21 — la requête du décompte n'est ACTIVÉE qu'une fois le formulaire résolu
 * (jamais préchargé au SSR). Tant qu'elle est désactivée, React Query la dit
 * `pending` sans la dire `fetching` : `isLoading` vaut false et `count` est
 * null — exactement l'état que le médaillon prenait pour un échec. Il manquait
 * donc du HTML SSR et du premier rendu client, puis surgissait ~500 ms plus
 * tard en repoussant la colonne de texte.
 */
describe("AacHighlightSection — le médaillon réserve sa place (M21)", () => {
  it("montre le médaillon en squelette tant que le chiffre n'est pas déterminé", () => {
    // Requête désactivée : ni chargement, ni erreur, ni valeur.
    poser();

    expect(screen.getByText("Communs déposés")).toBeInTheDocument();
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it("affiche le chiffre une fois connu", () => {
    countState.count = 12;
    poser();

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Communs déposés")).toBeInTheDocument();
  });

  it("retire le médaillon sur un ÉCHEC — le seul cas où il disparaît", () => {
    countState.error = new Error("503");
    poser();

    expect(screen.queryByText("Communs déposés")).not.toBeInTheDocument();
  });

  it("garde le chiffre connu quand seul un rafraîchissement a échoué", () => {
    countState.count = 12;
    countState.error = new Error("503");
    poser();

    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("ne réserve rien sans AAC déclaré : le chiffre ne viendra jamais", () => {
    contextState.formId = null;
    poser();

    expect(screen.queryByText("Communs déposés")).not.toBeInTheDocument();
  });

  it("réserve la place tant que la résolution du formulaire est EN VOL", () => {
    contextState.resolved = null;
    contextState.isFormLoading = true;
    poser();

    expect(screen.getByText("Communs déposés")).toBeInTheDocument();
  });

  it("ne rend aucun médaillon si la config n'en demande pas", () => {
    countState.count = 12;
    poser({ count: undefined });

    expect(screen.queryByText("Communs déposés")).not.toBeInTheDocument();
    expect(screen.queryByText("12")).not.toBeInTheDocument();
  });
});

/**
 * Le revers de M21 : le médaillon lit son attente sur `value === null`, et la
 * requête du décompte attend `resolved` — donc reste `pending` À JAMAIS si la
 * résolution du formulaire n'aboutit pas. Le squelette « en attente » devenait
 * alors perpétuel, là où la doc du composant promet qu'un chiffre inconnu fait
 * DISPARAÎTRE le médaillon.
 */
describe("AacHighlightSection — la config du formulaire ne se résoudra jamais", () => {
  it("retire le médaillon quand la résolution a échoué", () => {
    contextState.resolved = null;
    contextState.configError = new Error("form supprimé");
    poser();

    expect(screen.queryByText("Communs déposés")).not.toBeInTheDocument();
  });

  it("retire le médaillon quand la résolution est terminée sans rien produire", () => {
    // Requête de config désactivée (pas d'entité costum) : ni en vol, ni en
    // erreur, et `resolved` restera nul.
    contextState.resolved = null;
    contextState.isFormLoading = false;
    poser();

    expect(screen.queryByText("Communs déposés")).not.toBeInTheDocument();
  });
});
