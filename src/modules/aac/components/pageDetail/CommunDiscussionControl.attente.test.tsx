// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import "../../i18n";

/**
 * L'intervalle où la modale est OUVERTE mais pas encore là : son code se télécharge. La page n'est
 * pas inerte pendant ce temps — le bouton reste cliquable, et rien ne s'affiche encore.
 *
 * Ce que cette suite tient :
 *   - le bouton se dit occupé tant qu'on attend la modale, et cesse dès qu'elle arrive ;
 *   - cliquer « Discussion » dans l'intervalle ne remplace pas le fil du lien par lequel on est venu.
 *
 * Un fichier à part : l'import de la modale y est RETENU par une porte, qu'on n'ouvre qu'une fois.
 */

const porte = vi.hoisted(() => {
  let ouvrir: () => void = () => undefined;
  const ouverte = new Promise<void>(resolve => { ouvrir = resolve; });
  return { ouverte, ouvrir: () => ouvrir(), recu: null as Record<string, unknown> | null };
});

vi.mock("@/modules/comment/hooks/useDiscussionsRealtime", () => ({ useDiscussionsRealtime: () => "degrade" }));
vi.mock("@/modules/comment/components/panel/SpaceModal", async () => {
  // Le téléchargement du morceau : il n'aboutit que quand le test ouvre la porte.
  await porte.ouverte;
  return {
    default: (props: Record<string, unknown>) => {
      porte.recu = props;
      return <div data-testid="space-modal" />;
    },
  };
});

const { CommunDiscussionControl } = await import("./CommunDiscussionControl");

const COMMUN = "65c3000000000000000000c1";
const APPEL = "65c3000000000000000000f1";
const ETAPE = "65c3000000000000000000e1";
const FICHE = `/aac/commun/${COMMUN}`;
const CHEMIN = `${APPEL}.${ETAPE}.${COMMUN}.budget.question_budget.comment`;
const FIL_DU_LIEN = `forms:${APPEL}:${CHEMIN}`;

const ESPACE = {
  result: true,
  space: { type: "answers", id: COMMUN, title: "Titre du serveur", formId: APPEL },
  canComment: false,
  truncated: false,
  threads: [
    { key: `answers:${COMMUN}`, contextType: "answers", contextId: COMMUN, path: null, total: 3, unread: 0, last: 1_758_000_000, mine: false, title: null, carrier: null, virtual: false, kind: "general", group: null, audience: null },
    { key: FIL_DU_LIEN, contextType: "forms", contextId: APPEL, path: CHEMIN, total: 2, unread: 0, last: 1_757_000_000, mine: false, title: "Budget", carrier: null, virtual: false, kind: "question", group: "Proposition", audience: null },
  ],
};

/** L'adresse et l'identité de l'entrée d'historique, lisibles dans le DOM. */
function SondeUrl() {
  const { search, key } = useLocation();
  return <span data-url data-entree={key}>{search}</span>;
}

function monter(url: string) {
  const cocolight = { api: { getDiscussionSpace: vi.fn(async () => ESPACE) }, me: null, entity: null, helper: {} } as unknown as CocolightContextType;
  return render(
    <MemoryRouter initialEntries={["/aac", url]}>
      <QueryClientProvider client={new QueryClient()}>
        <CocolightContext.Provider value={cocolight}>
          <LocalizationProvider>
            <CommunDiscussionControl answerId={COMMUN} communTitle="Une instance peertube" />
            <SondeUrl />
          </LocalizationProvider>
        </CocolightContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const bouton = () => screen.getByRole("button", { name: /Discussion/ });
const sonde = () => document.querySelector("[data-url]")!;
const param = () => new URLSearchParams(sonde().textContent ?? "").get("discussion");
const entree = () => sonde().getAttribute("data-entree");

describe("CommunDiscussionControl — tant que la modale se fait attendre", () => {
  it("arrivé par le lien d'un fil : le bouton se dit occupé, et cliquer ne remplace pas ce fil", async () => {
    monter(`${FICHE}?discussion=${encodeURIComponent(FIL_DU_LIEN)}`);
    // La fiche est là, son compteur aussi ; la modale, elle, attend son code.
    await waitFor(() => expect(document.querySelector("[data-commun-discussion-total]")).toBeTruthy());
    expect(screen.queryByTestId("space-modal")).toBeNull();
    await waitFor(() => expect(bouton().getAttribute("aria-busy")).toBe("true"));
    expect(bouton().hasAttribute("disabled")).toBe(false);

    // Rien ne s'affiche encore : on clique « Discussion ». L'espace est déjà ouvert, là où
    // l'adresse le dit — répondre par le fil général effacerait le fil du lien, historique compris.
    const avant = entree();
    await act(async () => { fireEvent.click(bouton()); });
    expect(param()).toBe(FIL_DU_LIEN);
    expect(entree()).toBe(avant);

    // Le code arrive : la modale s'ouvre sur le fil du lien, et le bouton n'attend plus rien.
    await act(async () => { porte.ouvrir(); });
    await screen.findByTestId("space-modal");
    expect(porte.recu).toMatchObject({ target: { type: "forms", id: APPEL, path: CHEMIN } });
    await waitFor(() => expect(bouton().hasAttribute("aria-busy")).toBe(false));
    expect(param()).toBe(FIL_DU_LIEN);
  });

  it("une fois le code arrivé, ouvrir ne fait plus attendre : le bouton ne se dit pas occupé", async () => {
    monter(FICHE);
    await waitFor(() => expect(document.querySelector("[data-commun-discussion-total]")).toBeTruthy());
    expect(bouton().hasAttribute("aria-busy")).toBe(false);
    await act(async () => { fireEvent.click(bouton()); });
    await screen.findByTestId("space-modal");
    expect(bouton().hasAttribute("aria-busy")).toBe(false);
    expect(param()).toBe(`answers:${COMMUN}`);
  });
});
