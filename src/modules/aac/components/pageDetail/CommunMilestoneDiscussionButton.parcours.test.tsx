// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import "../../i18n";

/**
 * Le PARCOURS d'un palier : son bouton « Discuter », le bouton de la fiche qui monte la modale, la
 * modale chargée en différé, le panneau, la colonne des fils, le lanceur, l'adresse et
 * l'historique — tous les VRAIS, assemblés.
 *
 * Ce qui passait entre les mailles des tests de chaque pièce, et que cette suite tient : le fil
 * d'une ligne où personne n'a écrit s'ouvre bien (la colonne le range dans son pli « Sans
 * discussion » ; ouvert, il s'y lit sous l'en-tête du pli replié), il se relit par son adresse, et
 * la fermeture rend le focus au palier.
 *
 * Trois frontières seulement, comme pour le parcours du bouton de la fiche : l'appel au serveur,
 * le flux temps réel, et le fil de messages lui-même — on n'en observe que la cible qu'il reçoit.
 */

// jsdom ne fournit pas ResizeObserver, dont des pièces de Radix ont besoin.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);

vi.mock("@/modules/comment/hooks/useDiscussionsRealtime", () => ({ useDiscussionsRealtime: () => "degrade" }));
vi.mock("@/modules/comment/components/CommentThread", () => ({
  CommentThread: ({ target }: { target?: { type: string; id: string; path?: string | null } | null }) => (
    <div data-comment-thread data-target={target ? `${target.type}:${target.id}${target.path ? `:${target.path}` : ""}` : ""} />
  ),
}));

const { CommunDiscussionControl } = await import("./CommunDiscussionControl");
const { CommunMilestoneDiscussionButton } = await import("./CommunMilestoneDiscussionButton");

const COMMUN = "65c3000000000000000000c1";
const APPEL = "65c3000000000000000000f1";
const DEPOT = "65c3000000000000000000e1";
const FINANCEMENT = "65c3000000000000000000e3";
const UTILISATEUR = "65d4000000000000000000d1";
const FICHE = `/aac/commun/${COMMUN}`;
const AVANT = "/aac";

const cheminDeLigne = (etape: string, liste: string, ligne: string) =>
  `${APPEL}.${etape}.${COMMUN}.${liste}.question_${liste}.comment.financement.depensekey.aapStep1-depense.depenseindex.${ligne}`;
const cle = (chemin: string) => `forms:${APPEL}:${chemin}`;
const CLE_GENERALE = `answers:${COMMUN}`;
const CLE_COMMENTEE = cle(cheminDeLigne(DEPOT, "depense", "0"));
const CLE_VIERGE = cle(cheminDeLigne(FINANCEMENT, "financer", "2"));

/** L'espace d'un commun à deux paliers : l'un commenté (depuis le legacy), l'autre où personne n'a écrit. */
function espace(session: boolean) {
  const ligne = (key: string, over: Record<string, unknown>) => ({
    key, contextType: "forms", contextId: APPEL, path: key.slice(`forms:${APPEL}:`.length), title: null, carrier: null,
    total: 0, unread: 0, last: null, mine: false, virtual: false, kind: "expense", group: "Financement", audience: null, line: null, ...over,
  });
  return {
    result: true,
    space: { type: "answers", id: COMMUN, title: "Titre du serveur", formId: APPEL },
    canComment: session,
    truncated: false,
    threads: [
      { key: CLE_GENERALE, contextType: "answers", contextId: COMMUN, path: null, title: null, carrier: null, total: 3, unread: 0, last: 1_758_000_000, mine: false, virtual: false, kind: "general", group: null, audience: null, line: null },
      ligne(CLE_COMMENTEE, { title: "Local", total: 2, last: 1_758_000_100, line: "0" }),
      ligne(CLE_VIERGE, { title: "Matériel", virtual: true, line: "2" }),
    ],
  };
}

/** La fiche, réduite à ce qui porte l'espace : son bouton, et celui de chacun de ses paliers. */
function Fiche() {
  return (
    <>
      <CommunDiscussionControl answerId={COMMUN} communTitle="Un commun" />
      <CommunMilestoneDiscussionButton answerId={COMMUN} lineKey="0" name="Local" />
      <CommunMilestoneDiscussionButton answerId={COMMUN} lineKey="2" name="Matériel" />
    </>
  );
}

function Navigateur() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-adresse>{pathname}{search}</output>
      <button type="button" data-nav="retour" onClick={() => { void navigate(-1); }}>retour</button>
    </>
  );
}

function monter(historique: readonly string[] = [AVANT, FICHE], { session = true } = {}) {
  const getDiscussionSpace = vi.fn(async () => espace(session));
  const cocolight = {
    api: { discussions: { space: getDiscussionSpace } },
    me: session ? { isConnected: true } : null,
    entity: session ? { userContext: { id: UTILISATEUR } } : null,
    helper: {},
  } as unknown as CocolightContextType;
  const rendu = render(
    <MemoryRouter initialEntries={[...historique]}>
      <QueryClientProvider client={new QueryClient()}>
        <CocolightContext.Provider value={cocolight}>
          <LocalizationProvider>
            <Routes>
              <Route path="/aac/commun/:answerId" element={<Fiche />} />
              <Route path="*" element={<p data-ailleurs>Une autre page</p>} />
            </Routes>
            <Navigateur />
          </LocalizationProvider>
        </CocolightContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...rendu, getDiscussionSpace };
}

// Une fois la modale ouverte, Radix retire le reste de la page de l'arbre d'accessibilité : on
// cherche donc les boutons par attribut, pas par rôle.
const palier = (ligne: string) => document.querySelector<HTMLButtonElement>(`[data-milestone-discussion="${ligne}"]`);
const adresse = () => document.querySelector("[data-adresse]")!.textContent ?? "";
const param = () => new URLSearchParams(adresse().split("?")[1] ?? "").get("discussion");
const cliquer = (cible: Element) => act(async () => { fireEvent.click(cible); });
const filMonte = () => document.querySelector("[data-comment-thread]");
const rangee = (cleDuFil: string) => document.querySelector(`[data-thread-key="${cleDuFil}"]`);
/** La rangée du fil est dans le pli « Sans discussion » — et non parmi les fils où l'on a écrit. */
const dansLePli = (cleDuFil: string) => rangee(cleDuFil)!.closest("[data-empty-group]") !== null;
/** La rangée du fil se lit : elle n'est pas dans la partie repliée — inerte — du pli. */
const lisible = (cleDuFil: string) => rangee(cleDuFil)!.closest("[inert]") === null;
const croix = () => {
  const toutes = screen.getAllByRole("button", { name: "Fermer les discussions" });
  return toutes[toutes.length - 1];
};
/** La modale — chargée en différé — a rendu sa liste. */
async function attendreLaListe() {
  await screen.findByRole("dialog");
  await waitFor(() => expect(rangee(CLE_GENERALE)).toBeTruthy());
}
async function ouvrirDepuis(ligne: string) {
  await waitFor(() => expect(palier(ligne)).not.toBeNull());
  await cliquer(palier(ligne)!);
  await attendreLaListe();
}

describe("la discussion d'un palier — le parcours, tous maillons assemblés", () => {
  // Le différé a ses propres tests ; ici la modale n'a pas à tenir dans l'attente du premier test.
  beforeAll(async () => { await import("@/modules/comment/components/panel/SpaceModal"); });

  it("un palier commenté : la modale s'ouvre sur SON fil, sélectionné dans la colonne et écrit dans l'adresse", async () => {
    monter();
    await ouvrirDepuis("0");

    expect(param()).toBe(CLE_COMMENTEE);
    expect(filMonte()!.getAttribute("data-target")).toBe(CLE_COMMENTEE);
    expect(rangee(CLE_COMMENTEE)!.getAttribute("data-selected")).toBe("true");
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Local");
  });

  it("un palier où personne n'a écrit : son fil s'ouvre, et sa rangée se lit sous l'en-tête de « Sans discussion », sélectionnée", async () => {
    monter();
    await ouvrirDepuis("2");

    expect(param()).toBe(CLE_VIERGE);
    expect(filMonte()!.getAttribute("data-target")).toBe(CLE_VIERGE);
    expect(rangee(CLE_VIERGE)!.getAttribute("data-selected")).toBe("true");
    expect(dansLePli(CLE_VIERGE)).toBe(true);
    // Pli replié, et pourtant visible : on sait où l'on est.
    expect(lisible(CLE_VIERGE)).toBe(true);
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Matériel");

    // On passe au fil général : la ligne vide reste proposée, rentrée dans le pli, sans la sélection.
    await cliquer(rangee(CLE_GENERALE)!);
    expect(filMonte()!.getAttribute("data-target")).toBe(CLE_GENERALE);
    expect(rangee(CLE_VIERGE)!.getAttribute("data-selected")).toBe("false");
    expect(lisible(CLE_VIERGE)).toBe(false);
    expect(rangee(CLE_COMMENTEE)).toBeTruthy();
  });

  it("ouverte par le bouton de la fiche, la colonne propose aussi la ligne vide — dans son pli « Sans discussion »", async () => {
    monter();
    await waitFor(() => expect(palier("2")).not.toBeNull());
    await cliquer(document.querySelector("[data-commun-discussion]")!);
    await attendreLaListe();
    expect(dansLePli(CLE_VIERGE)).toBe(true);
    expect(dansLePli(CLE_COMMENTEE)).toBe(false);
    // Elle n'est pas ouverte : elle reste repliée avec les autres.
    expect(lisible(CLE_VIERGE)).toBe(false);
  });

  it("la croix referme, rend l'adresse de la fiche et le focus AU PALIER — puis « retour » quitte la fiche", async () => {
    monter();
    await ouvrirDepuis("2");
    await cliquer(croix());

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(adresse()).toBe(FICHE);
    expect(document.activeElement).toBe(palier("2"));

    // Fermer a DÉFAIT l'ouverture : il n'y a pas d'entrée morte derrière.
    await cliquer(document.querySelector('[data-nav="retour"]')!);
    expect(adresse()).toBe(AVANT);
  });

  it("après avoir changé de fil dans la modale, fermer rend encore le focus au palier d'où l'on a ouvert", async () => {
    monter();
    await ouvrirDepuis("0");
    await cliquer(rangee(CLE_GENERALE)!);
    expect(filMonte()!.getAttribute("data-target")).toBe(CLE_GENERALE);
    await cliquer(croix());

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(palier("0"));
  });

  it("l'adresse du fil d'une ligne vide, ouverte comme un lien par un visiteur : le fil est monté, sans rangée de plus", async () => {
    monter([AVANT, `${FICHE}?discussion=${encodeURIComponent(CLE_VIERGE)}`], { session: false });
    await attendreLaListe();

    expect(filMonte()!.getAttribute("data-target")).toBe(CLE_VIERGE);
    expect(rangee(CLE_VIERGE)).toBeNull();
    // Et sur la fiche, le visiteur n'a pas de bouton pour ce palier-là : il n'a rien à y lire.
    expect(palier("2")).toBeNull();
    expect(palier("0")).not.toBeNull();
  });

  it("l'espace n'est demandé qu'une fois pour les trois boutons et la modale", async () => {
    const { getDiscussionSpace } = monter();
    await ouvrirDepuis("0");
    expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
  });
});
