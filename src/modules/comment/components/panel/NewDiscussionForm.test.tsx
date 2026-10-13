// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import cocolightApiClient from "@communecter/cocolight-api-client";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { NewDiscussionForm } from "./NewDiscussionForm";
import type { SpaceAudience, SpaceRef } from "../../types";
import "../../i18n";

/**
 * Le formulaire « Nouvelle discussion » : un nom, et qui la lira.
 *
 * L'appel au serveur est la frontière ; le formulaire, sa mutation et la lecture de la réponse sont
 * les vrais. Ce qu'il ne décide PAS : qui peut créer, et avec quelle audience — il n'offre que
 * celles qu'on lui donne, celles que le serveur a annoncées.
 */

// jsdom ne fournit pas ResizeObserver, dont le groupe de boutons radio de Radix a besoin.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);

const COMMUN = "65c3000000000000000000c1";
const APPEL = "65c3000000000000000000f1";
const ESPACE: SpaceRef = { type: "answers", id: COMMUN };
const CHEMIN = `${APPEL}.moreDiscussions_93015AbCdEfGh.${COMMUN}.discu_121020269301512.comment`;
const FIL_CREE = {
  key: `forms:${APPEL}:${CHEMIN}`, contextType: "forms", contextId: APPEL, path: CHEMIN, total: 0, unread: 0, last: null, mine: false,
  title: "Budget 2026", carrier: null, virtual: true, kind: "discussion", group: null, audience: "authorAdmin", line: null,
};
const TOUTES: readonly SpaceAudience[] = ["authorAll", "authorAdmin", "private"];

const refusDuSdk = (code: string) => async (): Promise<never> => {
  throw new cocolightApiClient.error.ApiResponseError("Texte du serveur.", 200, { result: false, code, msg: "Texte du serveur." });
};

interface Montage {
  readonly audiences?: readonly SpaceAudience[];
  readonly reponse?: (corps: Record<string, unknown>) => Promise<unknown>;
}

function monter({ audiences = ["authorAll", "authorAdmin"], reponse = async () => ({ result: true, thread: FIL_CREE }) }: Montage = {}) {
  const createDiscussion = vi.fn(reponse);
  const cocolight = {
    api: { createDiscussion }, me: { isConnected: true }, entity: { userContext: { id: "65d4000000000000000000d1" } }, helper: {},
  } as unknown as CocolightContextType;
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  const horsDuFormulaire = vi.fn();
  const rendu = render(
    <QueryClientProvider client={new QueryClient()}>
      <CocolightContext.Provider value={cocolight}>
        <LocalizationProvider>
          {/* Ce qu'entendrait la modale si le formulaire laissait passer la touche. */}
          <div onKeyDown={horsDuFormulaire}>
            <NewDiscussionForm space={ESPACE} audiences={audiences} onCreated={onCreated} onCancel={onCancel} />
          </div>
        </LocalizationProvider>
      </CocolightContext.Provider>
    </QueryClientProvider>,
  );
  return { ...rendu, createDiscussion, onCreated, onCancel, horsDuFormulaire };
}

const nom = () => screen.getByLabelText("Nom de la discussion") as HTMLInputElement;
const creer = () => screen.getByRole("button", { name: /Créer|Création/ }) as HTMLButtonElement;
const choix = () => screen.getAllByRole("radio").map(radio => ({
  nom: radio.getAttribute("aria-labelledby")
    ? document.getElementById(radio.getAttribute("aria-labelledby")!)!.textContent
    : document.querySelector(`label[for="${radio.id}"]`)!.textContent,
  coche: radio.getAttribute("aria-checked") === "true",
  aide: document.getElementById(radio.getAttribute("aria-describedby")!)!.textContent,
}));
const saisir = (valeur: string) => fireEvent.change(nom(), { target: { value: valeur } });
const envoyer = () => act(async () => { fireEvent.submit(document.querySelector("[data-new-discussion]")!); });

describe("NewDiscussionForm", () => {
  describe("ce qu'il offre", () => {
    it("peut se réduire et défiler : dans une colonne trop basse, ses boutons restent atteignables", () => {
      monter();
      const classes = document.querySelector("[data-new-discussion]")!.className.split(/\s+/);
      expect(classes).toContain("min-h-0");
      expect(classes).toContain("overflow-y-auto");
    });

    it("se présente comme un formulaire nommé, le champ du nom prêt à recevoir la saisie", () => {
      monter();
      expect(screen.getByRole("form", { name: "Nouvelle discussion" })).toBeTruthy();
      expect(document.activeElement).toBe(nom());
      expect(nom().maxLength).toBe(120);
    });

    it("n'offre que les audiences qu'on lui donne, chacune avec ce qu'elle veut dire", () => {
      monter({ audiences: ["authorAll", "authorAdmin"] });
      expect(choix().map(c => [c.nom, c.aide])).toEqual([
        ["Publique", "Tout le monde, sans être connecté."],
        ["Privée", "Le déposant du commun, ses référents et les administrateurs de l'appel."],
      ]);
    });

    it("offre « Admins » en plus à qui le serveur l'accorde", () => {
      monter({ audiences: TOUTES });
      expect(choix().map(c => c.nom)).toEqual(["Publique", "Privée", "Admins"]);
      expect(choix()[2].aide).toBe("Les administrateurs de l'appel seulement.");
    });

    it("coche « Privée » d'office, comme le legacy : ouvrir à tous doit être un geste", () => {
      monter({ audiences: TOUTES });
      expect(choix().filter(c => c.coche).map(c => c.nom)).toEqual(["Privée"]);
    });

    it("à défaut de « Privée », coche la première qu'on lui donne", () => {
      monter({ audiences: ["authorAll", "private"] });
      expect(choix().filter(c => c.coche).map(c => c.nom)).toEqual(["Publique"]);
    });
  });

  describe("créer", () => {
    it("ne s'envoie pas sans nom — ni avec des espaces seulement", async () => {
      const { createDiscussion } = monter();
      expect(creer().disabled).toBe(true);
      saisir("   ");
      expect(creer().disabled).toBe(true);
      await envoyer();
      expect(createDiscussion).not.toHaveBeenCalled();
      saisir("Budget");
      expect(creer().disabled).toBe(false);
    });

    it("envoie le nom rogné, ses espaces réduits, et l'audience cochée", async () => {
      const { createDiscussion } = monter({ audiences: TOUTES });
      saisir("  Budget   2026  ");
      fireEvent.click(screen.getByRole("radio", { name: "Admins" }));
      await envoyer();
      expect(createDiscussion).toHaveBeenCalledWith({ contextType: "answers", contextId: COMMUN, name: "Budget 2026", audience: "private" });
    });

    it("sans y toucher, envoie l'audience cochée d'office", async () => {
      const { createDiscussion } = monter();
      saisir("Budget 2026");
      await envoyer();
      expect(createDiscussion).toHaveBeenCalledWith(expect.objectContaining({ audience: "authorAdmin" }));
    });

    it("rend à l'hôte le fil créé — c'est lui qui l'ouvre", async () => {
      const { onCreated } = monter();
      saisir("Budget 2026");
      await envoyer();
      await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
      expect(onCreated.mock.calls[0][0]).toMatchObject({ target: { type: "forms", id: APPEL, path: CHEMIN }, kind: "discussion" });
    });

    it("pendant l'envoi, se dit occupé et ne s'envoie pas deux fois", async () => {
      let repondre: (valeur: unknown) => void = () => undefined;
      const { createDiscussion } = monter({ reponse: () => new Promise(resolve => { repondre = resolve; }) });
      saisir("Budget 2026");
      await envoyer();
      await waitFor(() => expect(creer().textContent).toBe("Création…"));
      expect(creer().disabled).toBe(true);
      expect(creer().getAttribute("aria-busy")).toBe("true");
      await envoyer();
      expect(createDiscussion).toHaveBeenCalledTimes(1);
      await act(async () => { repondre({ result: true, thread: FIL_CREE }); });
    });

    it("deux envois coup sur coup n'en font qu'UN — avant même que l'écran ne se dise occupé", async () => {
      // Deux Entrée dans le même souffle : le second part avant le rendu qui désactive le bouton.
      const { createDiscussion, onCreated } = monter();
      saisir("Budget 2026");
      await act(async () => {
        const formulaire = document.querySelector("[data-new-discussion]")!;
        fireEvent.submit(formulaire);
        fireEvent.submit(formulaire);
      });
      await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
      expect(createDiscussion).toHaveBeenCalledTimes(1);
    });

    it("après un refus, on peut renvoyer : la garde est relâchée", async () => {
      const { createDiscussion } = monter({ reponse: refusDuSdk("failed") });
      saisir("Budget 2026");
      await envoyer();
      await screen.findByRole("alert");
      await envoyer();
      await waitFor(() => expect(createDiscussion).toHaveBeenCalledTimes(2));
    });
  });

  describe("quand la création n'aboutit pas", () => {
    it.each([
      ["forbidden", "Vous ne pouvez pas créer cette discussion."],
      ["bad-name", "Donnez-lui un nom, de 120 caractères au plus."],
      ["too-many", "Ce commun a atteint son nombre maximal de discussions."],
      ["hidden", "Cet espace de discussion est introuvable."],
      ["failed", "La discussion n'a pas pu être créée. Réessayez."],
    ])("un refus `%s` se dit dans la langue de l'écran, jamais avec le texte du serveur", async (code, phrase) => {
      const { onCreated, container } = monter({ reponse: refusDuSdk(code) });
      saisir("Budget 2026");
      await envoyer();
      const alerte = await screen.findByRole("alert");
      expect(alerte.textContent).toBe(phrase);
      expect(alerte.getAttribute("data-new-discussion-error")).toBe(code);
      expect(container.textContent).not.toContain("Texte du serveur.");
      expect(onCreated).not.toHaveBeenCalled();
      // Le formulaire reste là, la saisie aussi : on corrige, on ne recommence pas.
      expect(nom().value).toBe("Budget 2026");
      expect(creer().disabled).toBe(false);
    });

    it("une réponse illisible dit de vérifier la liste avant de recommencer — la discussion existe peut-être", async () => {
      monter({ reponse: async () => "<html>Maintenance</html>" });
      saisir("Budget 2026");
      await envoyer();
      expect((await screen.findByRole("alert")).textContent)
        .toBe("La réponse du serveur est illisible. Vérifiez la liste avant de recommencer.");
    });

    it("une panne du serveur ou du réseau ne dit PAS « réessayez » : la discussion existe peut-être, on vérifie la liste", async () => {
      // La forme de ce que le SDK lève quand la réponse n'arrive pas : une erreur à statut 500.
      const { onCreated } = monter({ reponse: async () => { throw new cocolightApiClient.error.ApiClientError("Erreur lors de l'appel de l'API : Network Error", 500); } });
      saisir("Budget 2026");
      await envoyer();
      const alerte = await screen.findByRole("alert");
      expect(alerte.getAttribute("data-new-discussion-error")).toBe("uncertain");
      expect(alerte.textContent).toBe("Le serveur n'a pas répondu : la discussion a peut-être été créée. Vérifiez la liste avant de recommencer.");
      expect(alerte.textContent).not.toContain("Réessayez");
      expect(onCreated).not.toHaveBeenCalled();
      expect(nom().value).toBe("Budget 2026");
    });

    it("un nom refusé marque le champ, et l'erreur lui est rattachée", async () => {
      monter({ reponse: refusDuSdk("bad-name") });
      saisir("Budget 2026");
      await envoyer();
      const alerte = await screen.findByRole("alert");
      expect(nom().getAttribute("aria-invalid")).toBe("true");
      expect(nom().getAttribute("aria-describedby")).toBe(alerte.id);
    });

    it("un autre refus ne marque pas le champ du nom : ce n'est pas lui qui est en cause", async () => {
      monter({ reponse: refusDuSdk("forbidden") });
      saisir("Budget 2026");
      await envoyer();
      await screen.findByRole("alert");
      expect(nom().hasAttribute("aria-invalid")).toBe(false);
    });

    it("sans erreur, ne montre ni alerte ni champ marqué", () => {
      monter();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(nom().hasAttribute("aria-invalid")).toBe(false);
      expect(nom().hasAttribute("aria-describedby")).toBe(false);
    });
  });

  describe("renoncer", () => {
    it("« Annuler » rend la main, sans rien envoyer", () => {
      const { onCancel, createDiscussion } = monter();
      saisir("Budget 2026");
      fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(createDiscussion).not.toHaveBeenCalled();
    });

    it("Échap aussi — et la touche ne va pas plus loin : elle ne ferme pas la modale", () => {
      const { onCancel, horsDuFormulaire, container } = monter();
      fireEvent.keyDown(nom(), { key: "Escape" });
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(horsDuFormulaire).not.toHaveBeenCalled();
      // C'est aussi par cet attribut que la modale sait qu'Échap est revendiquée (`DiscussionModalShell`).
      expect(container.querySelector("[data-new-discussion]")!.hasAttribute("data-comment-escape")).toBe(true);
    });

    it("une autre touche passe : le formulaire ne retient qu'Échap", () => {
      const { onCancel, horsDuFormulaire } = monter();
      fireEvent.keyDown(nom(), { key: "a" });
      expect(onCancel).not.toHaveBeenCalled();
      expect(horsDuFormulaire).toHaveBeenCalledTimes(1);
    });
  });
});
