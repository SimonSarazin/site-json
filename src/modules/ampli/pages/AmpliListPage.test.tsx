// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes, useParams } from "react-router";
import "@/modules/ampli/i18n";
import i18n from "@/i18n";
import { renderWithProviders, screen, userEvent, within } from "../../../../tests/test-utils-ui";
import type { AmpliModel } from "../types";
import type { AmpliAnswerCount } from "../hooks/useAmpliAnswerCounts";

/**
 * Page `/ampli` — liste des amplis du costum. Les hooks de données sont mockés :
 * on vérifie ce que la page FAIT de la liste (cartes, filtres, compteurs, accès
 * direct), pas la lecture du costum (testée dans `lib/costumAmpli.test.ts`).
 */

vi.mock("@/components/layout/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("@/components/layout/SiteFooter", () => ({ SiteFooter: () => null }));
vi.mock("@dr.pogodin/react-helmet", () => ({ Helmet: () => null }));

let amplis: AmpliModel[];
let counts: Record<string, AmpliAnswerCount>;
vi.mock("../hooks/useAmplis", () => ({ useAmplis: () => ({ mode: "costum", amplis }) }));
vi.mock("../hooks/useAmpliAnswerCounts", () => ({ useAmpliAnswerCounts: () => counts }));

/** Gestion des amplis (admin du costum) — le gate et les appels SDK ont leurs
 *  propres tests ; ici on vérifie ce que la page en MONTRE. */
let canManage: boolean;
const createMutate = vi.fn();
const removeMutate = vi.fn();
vi.mock("../hooks/useAmpliAdmin", () => ({
  useCanManageAmplis: () => canManage,
  useCreateAmpli: () => ({ mutate: createMutate, isPending: false }),
  useRemoveAmpli: () => ({ mutate: removeMutate, isPending: false }),
}));

const { default: AmpliListPage } = await import("./AmpliListPage");

const PATH = { name: "step.name", address: "step.address" };
const SINISTRE: AmpliModel = {
  slug: "sinistre",
  name: "Sinistre",
  description: "Sinistre config",
  tags: ["Sinistre", "Ampli", "Francki", "Madagascar"],
  path: PATH,
  coform: "6927e9f0db22da724360303c",
};
const VILLE: AmpliModel = {
  slug: "ville",
  name: "Idées pour la ville",
  description: "Urbanisme participatif",
  tags: ["Ville"],
  path: PATH,
  coform: "69426516f7a7f229f7399da2",
};

function AmpliStub() {
  const { slug } = useParams();
  return <p>page ampli {slug}</p>;
}

const render = () =>
  renderWithProviders(
    <MemoryRouter initialEntries={["/ampli"]}>
      <Routes>
        <Route path="/ampli" element={<AmpliListPage />} />
        <Route path="/ampli/:slug" element={<AmpliStub />} />
      </Routes>
    </MemoryRouter>,
  );

const cards = () => screen.queryAllByRole("listitem").filter((item) => item.querySelector("h3"));

describe("AmpliListPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  beforeEach(() => {
    canManage = false;
    createMutate.mockReset();
    removeMutate.mockReset();
    amplis = [SINISTRE, VILLE];
    counts = {
      sinistre: { count: 3, isLoading: false },
      ville: { count: 1, isLoading: false },
    };
  });

  describe("cartes", () => {
    it("affiche nom, description et lien vers la page de l'ampli", () => {
      render();

      const link = screen.getByRole("link", { name: "Sinistre" });
      expect(link).toHaveAttribute("href", "/ampli/sinistre");
      expect(screen.getByText("Sinistre config")).toBeInTheDocument();
    });

    it("montre 3 tags puis « +N »", () => {
      render();

      const card = cards()[0];
      expect(within(card).getByText("#Sinistre")).toBeInTheDocument();
      expect(within(card).getByText("#Francki")).toBeInTheDocument();
      expect(within(card).queryByText("#Madagascar")).toBeNull();
      expect(within(card).getByText("+1")).toBeInTheDocument();
    });

    it("affiche le nombre de propositions, au singulier comme au pluriel", () => {
      render();

      expect(screen.getByText("3 propositions")).toBeInTheDocument();
      expect(screen.getByText("1 proposition")).toBeInTheDocument();
    });

    it("met le compteur en squelette tant qu'il n'est pas connu", () => {
      counts.sinistre = { count: null, isLoading: true };
      const { container } = render();

      expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(1);
      expect(screen.queryByText("3 propositions")).toBeNull();
    });

    it("n'affiche aucun compteur pour un ampli sans formulaire", () => {
      counts.sinistre = { count: null, isLoading: false };
      const { container } = render();

      expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0);
      expect(within(cards()[0]).queryByText(/proposition/)).toBeNull();
    });

    it("mène à la page de l'ampli au clic", async () => {
      render();

      await userEvent.click(screen.getByRole("link", { name: "Idées pour la ville" }));

      expect(screen.getByText("page ampli ville")).toBeInTheDocument();
    });
  });

  describe("recherche et tags", () => {
    it("filtre sur le nom ou la description", async () => {
      render();

      await userEvent.type(screen.getByRole("searchbox", { name: "Rechercher un ampli" }), "urbanisme");

      expect(screen.queryByRole("link", { name: "Sinistre" })).toBeNull();
      expect(screen.getByRole("link", { name: "Idées pour la ville" })).toBeInTheDocument();
    });

    it("propose une puce par tag, qui filtre et se déclare enfoncée", async () => {
      render();

      const chip = screen.getByRole("button", { name: "#Ville" });
      expect(chip).toHaveAttribute("aria-pressed", "false");

      await userEvent.click(chip);

      expect(chip).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByRole("link", { name: "Sinistre" })).toBeNull();
      expect(screen.getByRole("link", { name: "Idées pour la ville" })).toBeInTheDocument();
    });

    it("annonce l'absence de résultat et permet d'effacer les filtres", async () => {
      render();

      await userEvent.type(screen.getByRole("searchbox"), "introuvable");
      expect(screen.getByText("Aucun ampli ne correspond à ces filtres.")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: /Effacer les filtres/ }));

      expect(screen.getByRole("link", { name: "Sinistre" })).toBeInTheDocument();
      expect(screen.getByRole("searchbox")).toHaveValue("");
    });
  });

  describe("accès direct par identifiant", () => {
    it("ouvre l'ampli dont on saisit le slug", async () => {
      render();

      await userEvent.type(screen.getByLabelText("Identifiant de l'ampli"), "Sinistre");
      await userEvent.click(screen.getByRole("button", { name: "Accéder à l'ampli" }));

      expect(screen.getByText("page ampli sinistre")).toBeInTheDocument();
    });

    // La liste est déjà en mémoire : pas de page « introuvable », une erreur ICI.
    it("signale un slug inconnu sans quitter la page", async () => {
      render();

      const input = screen.getByLabelText("Identifiant de l'ampli");
      await userEvent.type(input, "inconnu");
      await userEvent.click(screen.getByRole("button", { name: "Accéder à l'ampli" }));

      expect(screen.getByRole("alert")).toHaveTextContent("Aucun ampli « inconnu » sur ce site.");
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("heading", { name: "Tous les amplis" })).toBeInTheDocument();
    });

    it("efface l'erreur dès que la saisie change", async () => {
      render();

      const input = screen.getByLabelText("Identifiant de l'ampli");
      await userEvent.type(input, "inconnu");
      await userEvent.click(screen.getByRole("button", { name: "Accéder à l'ampli" }));
      await userEvent.type(input, "x");

      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("gestion (admin du costum)", () => {
    it("ne propose ni création ni suppression à un visiteur", () => {
      render();

      expect(screen.queryByRole("button", { name: "Créer un ampli" })).toBeNull();
      expect(screen.queryByRole("button", { name: /Supprimer l'ampli/ })).toBeNull();
    });

    it("crée un ampli depuis l'annuaire et ouvre sa page", async () => {
      canManage = true;
      createMutate.mockImplementation((_draft, { onSuccess }) => onSuccess({ slug: "idees-ete" }));
      render();

      await userEvent.click(screen.getByRole("button", { name: "Créer un ampli" }));
      await userEvent.type(screen.getByLabelText("Nom de l'ampli"), "Idées d'été");
      await userEvent.type(screen.getByLabelText("Mots-clés"), "été, idées");
      await userEvent.click(screen.getByRole("button", { name: "Créer l'ampli" }));

      expect(createMutate).toHaveBeenCalledWith(
        { name: "Idées d'été", description: "", tags: ["été", "idées"] },
        expect.anything(),
      );
      expect(screen.getByText("page ampli idees-ete")).toBeInTheDocument();
    });

    it("supprime l'ampli d'une carte, après confirmation", async () => {
      canManage = true;
      render();

      await userEvent.click(screen.getByRole("button", { name: "Supprimer l'ampli Sinistre" }));
      await userEvent.click(screen.getByRole("button", { name: "Supprimer" }));

      expect(removeMutate).toHaveBeenCalledWith(SINISTRE, expect.anything());
    });
  });

  it("dit qu'aucun ampli n'est déclaré, sans recherche ni puces", () => {
    amplis = [];
    counts = {};
    render();

    expect(screen.getByText("Aucun ampli n'est encore déclaré sur ce site.")).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});
