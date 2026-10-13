// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Globe } from "lucide-react";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { CarrierRail } from "./CarrierRail";
import { ThreadColumn } from "./ThreadColumn";
import { CARRIER_NONE } from "../../lib/discussions";
import type { DiscussionCarrier, DiscussionThread } from "../../types";
import "../../i18n";

/**
 * Les deux premières colonnes du panneau.
 *
 * Comme pour `CommentRow`, on interroge les attributs `data-*` : ce sont eux qui pilotent le
 * style, donc les tester teste la CAUSE et non une couleur calculée. Ce que cette suite
 * garantit, c'est qu'aucun état ne disparaît en silence d'un refactor — le rendu en clair et
 * en sombre se vérifie au navigateur.
 */

const ORG = "65a1000000000000000000a1";
const PROJ = "65a1000000000000000000a2";
const ACT = "65b2000000000000000000b1";

const wrap = (ui: React.ReactElement) =>
  render(<LocalizationProvider>{ui}</LocalizationProvider>);

function carrier(over: Partial<DiscussionCarrier> = {}): DiscussionCarrier {
  return {
    id: ORG, type: "organizations", name: "Une organisation", slug: "orga", image: null,
    threads: 2, total: 5, unread: 0, last: 1_700_000_000, mine: false, membership: "member", ...over,
  };
}

function thread(over: Partial<DiscussionThread> = {}): DiscussionThread {
  return {
    key: `actions:${ACT}`,
    target: { type: "actions", id: ACT, path: null },
    title: "Ouvrir le capot", carrier: { type: "projects", id: PROJ },
    total: 4, unread: 0, last: 1_700_000_000, mine: false, virtual: false, ...over,
  };
}

describe("CarrierRail", () => {
  it("rend un porteur par ligne, avec son nom", () => {
    wrap(<CarrierRail carriers={[carrier(), carrier({ id: PROJ, type: "projects", name: "Un projet" })]}
      selected={null} onSelect={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByText("Une organisation")).toBeTruthy();
    expect(screen.getByText("Un projet")).toBeTruthy();
  });

  it("marque le porteur sélectionné sur l'attribut ET sur `aria-current`", () => {
    const { container } = wrap(
      <CarrierRail carriers={[carrier()]} selected={`organizations:${ORG}`} onSelect={() => {}} />);
    const ligne = container.querySelector("[data-carrier-row]")!;
    expect(ligne.getAttribute("data-selected")).toBe("true");
    expect(ligne.getAttribute("aria-current")).toBe("true");
  });

  it("n'affiche la pastille que s'il y a des non-lus", () => {
    const { container: sans } = wrap(<CarrierRail carriers={[carrier({ unread: 0 })]} selected={null} onSelect={() => {}} />);
    expect(sans.querySelector("[data-carrier-row]")!.getAttribute("data-unread")).toBe("false");

    const { container: avec } = wrap(<CarrierRail carriers={[carrier({ unread: 3 })]} selected={null} onSelect={() => {}} />);
    expect(avec.querySelector("[data-carrier-row]")!.getAttribute("data-unread")).toBe("true");
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("écrête la pastille au-delà de 99 — un badge à 4 chiffres déformerait la ligne", () => {
    wrap(<CarrierRail carriers={[carrier({ unread: 1240 })]} selected={null} onSelect={() => {}} />);
    expect(screen.getByText("99+")).toBeTruthy();
  });

  it("nomme le groupe « sans porteur » au lieu de l'afficher vide", () => {
    // Ce groupe n'est pas marginal : 52 % des formulaires n'ont aucun lien parent en base.
    wrap(<CarrierRail carriers={[carrier({ id: null, type: null, name: null })]} selected={null} onSelect={() => {}} />);
    expect(screen.getByText("Sans espace")).toBeTruthy();
  });

  it("sélectionne le groupe orphelin par la clé `none`", () => {
    const { container } = wrap(
      <CarrierRail carriers={[carrier({ id: null, type: null, name: null })]} selected={CARRIER_NONE} onSelect={() => {}} />);
    expect(container.querySelector("[data-carrier-row]")!.getAttribute("data-selected")).toBe("true");
  });

  it("remonte le porteur cliqué", () => {
    const onSelect = vi.fn();
    wrap(<CarrierRail carriers={[carrier()]} selected={null} onSelect={onSelect} />);
    screen.getByRole("button").click();
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: ORG, type: "organizations" }));
  });

  it("dit qu'il n'y a rien plutôt que de rendre une colonne muette", () => {
    wrap(<CarrierRail carriers={[]} selected={null} onSelect={() => {}} />);
    // Phrase EXACTE, et non `/Aucun espace/` : sous filtre, la colonne dit tout autre chose
    // (« Aucun espace ne correspond à … »), qu'une regex aussi large avaliserait ici.
    expect(screen.getByText("Aucun espace avec des discussions")).toBeTruthy();
  });

  it("signale le chargement à l'assistance technique", () => {
    const { container } = wrap(<CarrierRail carriers={[]} selected={null} onSelect={() => {}} isLoading />);
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  /**
   * La régression corrigée côté serveur : un élément dont on est membre mais où personne
   * n'a écrit n'avait aucune clé dans `comments`, donc n'apparaissait nulle part — on ne
   * pouvait pas y lancer de discussion. Il est désormais rendu, mais REPLIÉ : trier ne
   * suffisait pas, un compte à 218 projets aurait noyé cinq porteurs actifs sous 213 vides.
   */
  it("range les porteurs sans discussion dans une section repliée", () => {
    const { container } = wrap(<CarrierRail
      carriers={[
        carrier({ name: "Avec des messages", threads: 2 }),
        carrier({ id: PROJ, type: "projects", name: "Jamais commenté", threads: 0, total: 0, unread: 0, last: null }),
      ]}
      selected={null} onSelect={() => {}} />);
    // Le contenu replié reste MONTÉ — c'est ce qui permet d'animer sa hauteur — mais il est
    // rendu INERTE : hors tabulation, hors arbre d'accessibilité.
    const section = container.querySelector(".comment-collapsible")!;
    expect(section.getAttribute("data-open")).toBe("false");
    expect(section.hasAttribute("inert")).toBe(true);
    expect(section.contains(screen.getByText("Jamais commenté"))).toBe(true);

    const groupe = screen.getByRole("button", { name: /sans discussion/i });
    expect(groupe.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(groupe);
    expect(section.getAttribute("data-open")).toBe("true");
    expect(section.hasAttribute("inert")).toBe(false);
  });

  it("invite à lancer la discussion au lieu d'annoncer « 0 fil »", () => {
    wrap(<CarrierRail
      carriers={[carrier({ threads: 0, total: 0, unread: 0, last: null })]}
      selected={null} onSelect={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /sans discussion/i }));
    expect(screen.getByText("Démarrer la discussion")).toBeTruthy();
    expect(screen.queryByText("0 fil")).toBeNull();
  });

  it("n'affiche aucune section quand tous les porteurs ont des fils", () => {
    wrap(<CarrierRail carriers={[carrier({ threads: 2 })]} selected={null} onSelect={() => {}} />);
    expect(screen.queryByRole("button", { name: /sans discussion/i })).toBeNull();
  });

  it("date un espace dans la langue de l'interface, pas en français d'office", () => {
    const { container } = render(
      <LocalizationProvider defaultLocale="en">
        <CarrierRail carriers={[carrier({ last: 1_700_000_000 })]} selected={null} onSelect={() => {}} />
      </LocalizationProvider>);
    expect(container.textContent).toMatch(/Nov \d{1,2}, 23/);
    expect(container.textContent).not.toContain("nov.");
  });

  it("empêche la pastille de non-lus de se comprimer face à un nom long", () => {
    const { container } = wrap(<CarrierRail
      carriers={[carrier({ unread: 3, name: "Une organisation au nom particulièrement long" })]}
      selected={null} onSelect={() => {}} />);
    const pastille = container.querySelector("[data-carrier-row] [data-unread-badge]")!;
    expect(pastille.className).toContain("shrink-0");
  });

  it("annonce les non-lus au lecteur d'écran : ils sont DANS le nom de la rangée, au singulier comme au pluriel", () => {
    const { container } = wrap(<CarrierRail
      carriers={[carrier({ id: "1".repeat(24), unread: 1, name: "Atelier" }), carrier({ id: "2".repeat(24), unread: 3, name: "Fabrique" })]}
      selected={null} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Atelier, 1 non lu" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fabrique, 3 non lus" })).toBeTruthy();
    // La pastille ne double pas la lecture : elle est cachée au lecteur d'écran.
    for (const p of container.querySelectorAll("[data-unread-badge]")) expect(p.getAttribute("aria-hidden")).toBe("true");
  });

  /**
   * Le filtre de la barre de recherche, vu de la colonne.
   *
   * Elle ne filtre PAS : le panneau lui passe déjà la liste réduite. Ce qu'elle fait de la
   * requête est autre chose — déplier, compter, marquer, et dire ce qui ne correspond pas.
   */
  const railFiltrable = (query?: string) => (
    <CarrierRail
      carriers={[
        carrier({ name: "Avec des messages", threads: 2 }),
        carrier({
          id: PROJ, type: "projects", name: "Jamais commenté",
          threads: 0, total: 0, unread: 0, last: null,
        }),
      ]}
      selected={null} onSelect={() => {}} query={query}
    />
  );

  it("déplie la section « Sans discussion » d'office dès qu'une requête est passée", () => {
    // Sur un compte à 257 espaces, 253 sont derrière ce pli : un filtre qui ne le traverserait
    // pas répondrait « aucun espace » sur exactement ce que l'utilisateur cherche.
    const { container } = wrap(railFiltrable("jamais"));
    const section = container.querySelector(".comment-collapsible")!;
    expect(section.getAttribute("data-open")).toBe("true");
    expect(section.hasAttribute("inert")).toBe(false);
  });

  it("retrouve le pli qu'on avait laissé quand la requête est retirée", () => {
    const { container, rerender } = wrap(railFiltrable());
    const section = () => container.querySelector(".comment-collapsible")!;
    const avecRequete = () => rerender(<LocalizationProvider>{railFiltrable("jamais")}</LocalizationProvider>);
    const sansRequete = () => rerender(<LocalizationProvider>{railFiltrable()}</LocalizationProvider>);

    expect(section().getAttribute("data-open")).toBe("false");
    avecRequete();
    expect(section().getAttribute("data-open")).toBe("true");
    // Le dépli d'office est une DÉRIVATION : `emptyOpen` n'a pas été écrasé au passage.
    sansRequete();
    expect(section().getAttribute("data-open")).toBe("false");

    // Et dans l'autre sens, qui seul prouve que l'état a SURVÉCU : un pli ouvert à la main
    // traverse la recherche sans se refermer derrière elle.
    fireEvent.click(screen.getByRole("button", { name: /sans discussion/i }));
    expect(section().getAttribute("data-open")).toBe("true");
    avecRequete();
    sansRequete();
    expect(section().getAttribute("data-open")).toBe("true");
  });

  it("n'offre plus un en-tête cliquable sous filtre — un bouton sans effet est un bouton mort", () => {
    wrap(railFiltrable("jamais"));
    expect(screen.queryByRole("button", { name: /sans discussion/i })).toBeNull();
    // Le même libellé est rendu, simplement sans interaction.
    expect(screen.getByText("Sans discussion (1)")).toBeTruthy();
  });

  it("compte les espaces retenus, et jamais le total", () => {
    const vierge = (n: number) => carrier({
      id: `${PROJ}${n}`, type: "projects", name: `Sans le moindre message ${n}`,
      threads: 0, total: 0, unread: 0, last: null,
    });
    const { container: total } = wrap(
      <CarrierRail carriers={[carrier(), vierge(1), vierge(2), vierge(3)]}
        selected={null} onSelect={() => {}} />);
    expect(total.textContent).toContain("Sans discussion (3)");

    // La liste arrive déjà filtrée du panneau : « Sans discussion (3) » au-dessus d'une seule
    // rangée visible serait un mensonge.
    const { container: filtre } = wrap(
      <CarrierRail carriers={[vierge(2)]} selected={null} onSelect={() => {}} query="message 2" />);
    expect(filtre.textContent).toContain("Sans discussion (1)");
    expect(filtre.textContent).not.toContain("Sans discussion (3)");
  });

  it("dit ce qui ne correspond pas plutôt qu'il n'y a rien", () => {
    const { container } = wrap(
      <CarrierRail carriers={[]} selected={null} onSelect={() => {}} query="solaire" />);
    // « Aucun espace avec des discussions » serait FAUX sous un filtre : il y en a, ils ne
    // correspondent simplement pas.
    expect(container.textContent).toContain("Aucun espace ne correspond à « solaire »");
    expect(container.textContent).not.toContain("Aucun espace avec des discussions");
  });

  it("marque dans le nom ce qui a fait retenir la rangée", () => {
    const { container } = wrap(
      <CarrierRail carriers={[carrier()]} selected={null} onSelect={() => {}} query="organi" />);
    const marque = container.querySelector("mark")!;
    expect(marque).toBeTruthy();
    expect(marque.textContent).toBe("organi");
    // Le nom reste entier : le marquage découpe, il ne réécrit pas.
    expect(container.querySelector("[data-carrier-label]")!.textContent)
      .toContain("Une organisation");

    const { container: sans } = wrap(
      <CarrierRail carriers={[carrier()]} selected={null} onSelect={() => {}} />);
    expect(sans.querySelector("mark")).toBeNull();
  });

  it("n'avertit de la troncature que sous filtre", () => {
    // Sans filtre l'information est secondaire ; sous filtre elle est décisive — « aucun
    // résultat » ne doit pas être confondu avec « le serveur n'a pas tout envoyé ».
    const { container: sous } = wrap(
      <CarrierRail carriers={[carrier()]} selected={null} onSelect={() => {}} truncated query="organi" />);
    expect(sous.querySelector("[data-search-partial]")).toBeTruthy();

    const { container: sans } = wrap(
      <CarrierRail carriers={[carrier()]} selected={null} onSelect={() => {}} truncated />);
    expect(sans.querySelector("[data-search-partial]")).toBeNull();
  });
});

describe("ThreadColumn", () => {
  it("étiquette CHAQUE fil par son type — c'est ce qui rend une liste hétérogène lisible", () => {
    wrap(<ThreadColumn threads={[
      thread(),
      thread({ key: "news:x", target: { type: "news", id: ORG, path: null }, title: "Une actu" }),
    ]} selected={null} onSelect={() => {}} />);
    expect(screen.getByText("Action")).toBeTruthy();
    expect(screen.getByText("Actualité")).toBeTruthy();
  });

  it("n'affiche AUCUN texte de message — le serveur n'en envoie pas", () => {
    const { container } = wrap(<ThreadColumn threads={[thread()]} selected={null} onSelect={() => {}} />);
    // Le titre est celui du CONTEXTE ; rien dans la colonne ne doit ressembler à un message.
    expect(container.textContent).toContain("Ouvrir le capot");
    expect(container.querySelector("[data-comment-row]")).toBeNull();
  });

  it("dit les non-lus d'un fil au lecteur d'écran, et lui cache le chiffre seul", () => {
    const { container } = wrap(<ThreadColumn threads={[thread({ unread: 3 })]} selected={null} onSelect={() => {}} />);
    const pastille = container.querySelector("[data-thread-row] [data-unread-badge]")!;
    expect(pastille.querySelector('[aria-hidden="true"]')?.textContent).toBe("3");
    expect(pastille.querySelector(".sr-only")?.textContent).toBe("3 non lus");
  });

  it("date un fil dans la langue de l'interface, pas en français d'office", () => {
    // Novembre 2023 : une autre année que celle du test, donc le jour, le mois ET l'année. Le
    // jour exact dépend du fuseau de la machine ; seul le FORMAT est en question.
    const { container } = render(
      <LocalizationProvider defaultLocale="en">
        <ThreadColumn threads={[thread({ last: 1_700_000_000 })]} selected={null} onSelect={() => {}} />
      </LocalizationProvider>);
    expect(container.textContent).toMatch(/Nov \d{1,2}, 23/);
    expect(container.textContent).not.toContain("nov.");
  });

  it("porte les états sur des attributs", () => {
    const { container } = wrap(
      <ThreadColumn threads={[thread({ unread: 2, mine: true })]} selected={`actions:${ACT}`} onSelect={() => {}} />);
    const ligne = container.querySelector("[data-thread-row]")!;
    expect(ligne.getAttribute("data-unread")).toBe("true");
    expect(ligne.getAttribute("data-mine")).toBe("true");
    expect(ligne.getAttribute("data-selected")).toBe("true");
  });

  it("distingue deux fils du MÊME document par leur `path`", () => {
    const chemin = "65a1.question_abc.comment";
    const { container } = wrap(<ThreadColumn
      threads={[
        thread({ key: `forms:${ORG}`, target: { type: "forms", id: ORG, path: null }, title: "Le formulaire" }),
        thread({ key: `forms:${ORG}:${chemin}`, target: { type: "forms", id: ORG, path: chemin }, title: "Une question" }),
      ]}
      selected={`forms:${ORG}:${chemin}`} onSelect={() => {}} />);
    const lignes = [...container.querySelectorAll("[data-thread-row]")];
    expect(lignes.map(l => l.getAttribute("data-selected"))).toEqual(["false", "true"]);
  });

  it("DIT que l'affichage est partiel au lieu de le taire", () => {
    wrap(<ThreadColumn threads={[thread()]} selected={null} onSelect={() => {}} truncated />);
    expect(screen.getByText(/Affichage partiel/)).toBeTruthy();
  });

  it("ne dit rien de tel quand tout est là", () => {
    wrap(<ThreadColumn threads={[thread()]} selected={null} onSelect={() => {}} truncated={false} />);
    expect(screen.queryByText(/Affichage partiel/)).toBeNull();
  });

  it("remonte le fil cliqué avec sa cible complète, `path` compris", () => {
    const onSelect = vi.fn();
    const chemin = "65a1.question_abc.comment";
    wrap(<ThreadColumn threads={[thread({ target: { type: "forms", id: ORG, path: chemin } })]}
      selected={null} onSelect={onSelect} />);
    screen.getByRole("button").click();
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      target: { type: "forms", id: ORG, path: chemin },
    }));
  });

  it("nomme un fil sans titre plutôt que de laisser un vide cliquable", () => {
    wrap(<ThreadColumn threads={[thread({ title: null })]} selected={null} onSelect={() => {}} />);
    expect(screen.getByText("Sans titre")).toBeTruthy();
  });

  /**
   * Le grief du 24/09 — « des textes qui se mettent sur deux lignes » — venait d'un flex sans
   * `whitespace-nowrap` ni `shrink-0` : chaque segment était écrasé à son `min-content`, d'où
   * « 1 / message ». Les trois tests qui suivent sont ce qui empêche ce défaut de revenir.
   */
  it("tient la métadonnée sur UNE ligne, et ne la replie pas", () => {
    const { container } = wrap(<ThreadColumn threads={[thread()]} selected={null} onSelect={() => {}} />);
    const meta = container.querySelector("[data-thread-meta]")!;
    expect(meta).toBeTruthy();
    expect(meta.className).toContain("[&>*]:shrink-0");
    expect(meta.className).toContain("[&>*]:whitespace-nowrap");
    expect(meta.className).toContain("overflow-hidden");
    // Replier, ce serait reproduire le défaut sous un autre nom.
    expect(meta.className).not.toContain("flex-wrap");
  });

  it("sacrifie le seul libellé du type, et le garde lisible à la voix", () => {
    const { container } = wrap(<ThreadColumn
      threads={[thread({ target: { type: "organizations", id: ORG, path: null }, total: 128 })]}
      selected={null} onSelect={() => {}} />);
    const meta = container.querySelector("[data-thread-meta]")!;
    // « Organisation » est le plus long des dix libellés, en français comme en anglais.
    const libelle = meta.querySelector('[title="Organisation"] span')!;
    // `sr-only` et non `hidden` : masqué à l'œil sur colonne étroite, toujours annoncé.
    expect(libelle.className).toContain("@max-[16rem]/fils:sr-only");
    expect(libelle.className).not.toContain("hidden");
    // Le compteur n'affiche que « 128 », mais énonce toujours l'unité.
    expect(meta.textContent).toContain("128 messages");
  });

  /**
   * Même règle que dans le rail, et pour la même raison : un porteur peut avoir trois fils
   * vivants et quarante actions ouvertes. Les mélanger noierait les discussions.
   */
  it("replie les fils où personne n'a encore écrit", () => {
    const { container } = wrap(<ThreadColumn
      threads={[
        thread({ key: "a", title: "Une vraie discussion" }),
        thread({ key: "b", virtual: true, total: 0, last: null, title: "Budget prévisionnel" }),
      ]}
      selected={null} onSelect={() => {}} />);
    const section = container.querySelector(".comment-collapsible")!;
    expect(section.getAttribute("data-open")).toBe("false");
    expect(section.hasAttribute("inert")).toBe(true);
    // Le fil vierge est dans la section repliée, pas dans la liste principale.
    expect(section.contains(screen.getByText("Budget prévisionnel"))).toBe(true);
    expect(container.querySelector('ul[aria-label="Fils"]')!.textContent).not.toContain("Budget prévisionnel");
    // Et cette liste-là a un nom, elle aussi : celui du pli.
    expect(section.querySelector("ul")!.getAttribute("aria-label")).toBe("Sans discussion (1)");
    fireEvent.click(screen.getByRole("button", { name: /sans discussion/i }));
    expect(section.getAttribute("data-open")).toBe("true");
  });

  it("n'affiche ni compteur ni date sur un fil qui n'existe pas encore", () => {
    const { container } = wrap(<ThreadColumn
      threads={[thread({ virtual: true, total: 0, last: null, title: "Budget prévisionnel" })]}
      selected={null} onSelect={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /sans discussion/i }));
    const meta = container.querySelector("[data-thread-meta]")!;
    expect(meta.textContent).toContain("Démarrer la discussion");
    // « 0 message » laisserait croire à un fil dont on aurait tout effacé.
    expect(meta.textContent).not.toContain("0 message");
  });

  it("borne le titre à deux lignes et le redonne entier en infobulle", () => {
    const long = "Critères d'éligibilité — questions des porteurs de projet du territoire";
    const { container } = wrap(<ThreadColumn threads={[thread({ title: long })]}
      selected={null} onSelect={() => {}} />);
    const titre = container.querySelector(`span[title="${long}"]`)!;
    expect(titre.className).toContain("line-clamp-2");
    expect(titre.textContent).toBe(long);
  });

  it("nomme l'espace de chaque résultat quand on le lui donne, et se tait sinon", () => {
    // En mode transverse les fils viennent de TOUS les espaces : sans cette ligne, deux
    // titres voisins peuvent appartenir à deux structures sans que rien ne le dise.
    const { container } = wrap(<ThreadColumn threads={[thread()]}
      selected={null} onSelect={() => {}} carrierName={() => "Toitures solaires"} />);
    expect(container.querySelector("[data-thread-space]")!.textContent)
      .toContain("Toitures solaires");

    // Hors recherche, tous les fils partagent l'espace nommé dans l'en-tête : le répéter à
    // chaque ligne serait du bruit.
    const { container: sans } = wrap(
      <ThreadColumn threads={[thread()]} selected={null} onSelect={() => {}} />);
    expect(sans.querySelector("[data-thread-space]")).toBeNull();

    // Un fil sans porteur n'a aucun espace à nommer : la ligne disparaît, elle ne se vide pas.
    const { container: orphelin } = wrap(<ThreadColumn threads={[thread({ carrier: null })]}
      selected={null} onSelect={() => {}} carrierName={ref => (ref ? "Toitures solaires" : null)} />);
    expect(orphelin.querySelector("[data-thread-space]")).toBeNull();
  });

  it("dit où la recherche n'est jamais allée quand rien ne correspond", () => {
    // Aucun texte de message ne transite par l'endpoint et la base n'a aucun index texte :
    // sans cette phrase, l'absence de résultat se lit « il n'y a rien » au lieu de « pas
    // dans les titres ».
    const { container } = wrap(
      <ThreadColumn threads={[]} selected={null} onSelect={() => {}} query="capot" />);
    expect(container.textContent).toContain("Aucun fil ne correspond à « capot »");
    expect(container.querySelector("[data-search-hint]")!.textContent)
      .toBe("La recherche ne porte pas sur le contenu des messages.");

    const { container: sans } = wrap(
      <ThreadColumn threads={[]} selected={null} onSelect={() => {}} />);
    expect(sans.querySelector("[data-search-hint]")).toBeNull();
    expect(sans.textContent).toContain("Aucun fil dans cet espace");
  });
});

/**
 * Ce que l'ESPACE d'un commun demande à la colonne : cinq props facultatives. Sans elles la
 * colonne rend le panneau général à l'identique — c'est ce que garantit la suite ci-dessus, où
 * aucune n'est passée.
 */
describe("ThreadColumn — rangée par l'espace d'un commun", () => {
  /** Un fil de l'appel : le TYPE du contexte dit « Formulaire », quelle que soit sa nature. */
  const fil = (cle: string, over: Partial<DiscussionThread> = {}) =>
    thread({ key: cle, target: { type: "forms", id: ORG, path: cle }, title: `Fil ${cle}`, ...over });
  const cles = (racine: ParentNode) =>
    [...racine.querySelectorAll("[data-thread-row]")].map(l => l.getAttribute("data-thread-key"));

  it("remplace l'étiquette de type par celle qu'on lui donne, icône comprise", () => {
    // « Formulaire » ne distinguerait pas une question d'une discussion réservée.
    const { container } = wrap(<ThreadColumn threads={[fil("a")]} selected={null} onSelect={() => {}}
      chip={() => ({ icon: Globe, label: "Publique" })} />);
    const meta = container.querySelector("[data-thread-meta]")!;
    expect(meta.querySelector('[title="Publique"]')!.textContent).toBe("Publique");
    expect(meta.querySelector("svg")!.getAttribute("class")).toContain("lucide-globe");
    expect(meta.textContent).not.toContain("Formulaire");
  });

  it("garde l'étiquette de type quand on ne lui en donne pas pour ce fil", () => {
    const { container } = wrap(<ThreadColumn threads={[fil("a"), fil("b")]} selected={null} onSelect={() => {}}
      chip={th => (th.key === "a" ? { icon: Globe, label: "Publique" } : null)} />);
    const metas = [...container.querySelectorAll("[data-thread-meta]")];
    expect(metas[0].textContent).toContain("Publique");
    expect(metas[1].textContent).toContain("Formulaire");
  });

  it("nomme un fil que le serveur ne titre pas, sans jamais remplacer un vrai titre", () => {
    wrap(<ThreadColumn
      threads={[fil("a", { title: null }), fil("b", { title: "Budget prévisionnel" }), fil("c", { title: null })]}
      selected={null} onSelect={() => {}}
      titleFallback={th => (th.key === "c" ? null : "Discussion générale")} />);
    // Proposé pour « a » comme pour « b » : seul le fil sans titre le prend.
    expect(screen.getAllByText("Discussion générale")).toHaveLength(1);
    expect(screen.getByText("Budget prévisionnel")).toBeTruthy();
    // Sans nom proposé pour ce fil-là, la colonne garde son repli : jamais un vide cliquable.
    expect(screen.getByText("Sans titre")).toBeTruthy();
  });

  /**
   * Les questions d'un appel se lisent étape par étape, dans l'ordre de l'appel. La colonne ne
   * retrie donc RIEN : elle pose un intertitre à chaque changement, ce qui laisse deux groupes
   * du même nom si le serveur y revient — fusionner déplacerait un fil.
   */
  it("range les fils sous leurs intertitres, dans l'ordre reçu, sans fusionner ni retrier", () => {
    const etapes: Record<string, string | null> = { a: null, b: "Proposition", c: "Proposition", d: "Bilan", e: "Proposition" };
    const { container } = wrap(<ThreadColumn
      threads={["a", "b", "c", "d", "e"].map(cle => fil(cle))}
      selected={null} onSelect={() => {}} groupLabel={th => etapes[th.key]} />);

    const groupes = [...container.querySelectorAll("[data-thread-group]")];
    expect(groupes.map(g => g.getAttribute("data-thread-group"))).toEqual(["", "Proposition", "Bilan", "Proposition"]);
    expect(groupes.map(g => cles(g))).toEqual([["a"], ["b", "c"], ["d"], ["e"]]);
    expect(cles(container)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("fait de chaque groupe une liste nommée par son intertitre — annoncée comme telle", () => {
    const { container } = wrap(<ThreadColumn threads={[fil("a"), fil("b")]} selected={null} onSelect={() => {}}
      groupLabel={th => (th.key === "a" ? null : "Proposition")} />);
    const listes = [...container.querySelectorAll("[data-thread-group] > ul")];
    // Le groupe sans intertitre garde le nom de la liste du panneau général.
    expect(listes.map(l => l.getAttribute("aria-label"))).toEqual(["Fils", "Proposition"]);
    // L'intertitre visible est décoratif : le nom de la liste le dit déjà, il ne se lit pas deux fois.
    const intertitres = [...container.querySelectorAll("[data-thread-group] > p")];
    expect(intertitres.map(i => i.textContent)).toEqual(["Proposition"]);
    expect(intertitres[0].getAttribute("aria-hidden")).toBe("true");
    // Deux groupes, deux listes : aucune liste « à plat » — celle du panneau général — en plus.
    expect(container.querySelectorAll("ul")).toHaveLength(2);
  });

  it("garde les rangées d'un groupe quand un autre apparaît au-dessus — le focus n'est pas perdu", () => {
    // Une discussion qu'on vous ouvre, une étape qui reçoit son premier message : un groupe de plus
    // en tête de liste. Les groupes suivants ne doivent pas être remontés pour autant.
    const etapes: Record<string, string | null> = { nouveau: "Proposition", b: "Bilan", c: "Bilan" };
    const colonne = (cles: string[]) => (
      <ThreadColumn threads={cles.map(cle => fil(cle))} selected={null} onSelect={() => {}} groupLabel={th => etapes[th.key]} />
    );
    const { container, rerender } = wrap(colonne(["b", "c"]));
    const rangee = () => container.querySelector<HTMLElement>('[data-thread-key="c"]')!;
    const avant = rangee();
    avant.focus();
    expect(document.activeElement).toBe(avant);

    rerender(<LocalizationProvider>{colonne(["nouveau", "b", "c"])}</LocalizationProvider>);
    expect(cles(container)).toEqual(["nouveau", "b", "c"]);
    // Le même nœud, pas un remplaçant : c'est ce qui garde le focus où il était.
    expect(rangee()).toBe(avant);
    expect(document.activeElement).toBe(avant);
  });

  it("garde les rangées d'un groupe quand un fil y prend la TÊTE — la clé du groupe ne suit pas son premier fil", () => {
    // La première question d'une étape reçoit son premier message et passe devant les autres.
    const colonne = (cles: string[]) => (
      <ThreadColumn threads={cles.map(cle => fil(cle))} selected={null} onSelect={() => {}} groupLabel={() => "Proposition"} />
    );
    const { container, rerender } = wrap(colonne(["b", "c"]));
    const rangee = () => container.querySelector<HTMLElement>('[data-thread-key="c"]')!;
    const avant = rangee();
    avant.focus();

    rerender(<LocalizationProvider>{colonne(["a", "b", "c"])}</LocalizationProvider>);
    expect(cles(container)).toEqual(["a", "b", "c"]);
    expect(container.querySelectorAll("[data-thread-group]")).toHaveLength(1);
    expect(rangee()).toBe(avant);
    expect(document.activeElement).toBe(avant);
  });

  it("deux groupes du MÊME intertitre gardent chacun leurs rangées quand le premier change de tête", () => {
    const etapes: Record<string, string | null> = { a: "Proposition", b: "Proposition", d: "Bilan", e: "Proposition" };
    const colonne = (cles: string[]) => (
      <ThreadColumn threads={cles.map(cle => fil(cle))} selected={null} onSelect={() => {}} groupLabel={th => etapes[th.key]} />
    );
    // Deux groupes de même nom sous une même clé : React le dit sur la console, et rien d'autre ne le montre.
    const console_ = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { container, rerender } = wrap(colonne(["b", "d", "e"]));
      const noeud = (cle: string) => container.querySelector<HTMLElement>(`[data-thread-key="${cle}"]`)!;
      const [b, d, e] = [noeud("b"), noeud("d"), noeud("e")];

      rerender(<LocalizationProvider>{colonne(["a", "b", "d", "e"])}</LocalizationProvider>);
      expect([...container.querySelectorAll("[data-thread-group]")].map(g => cles(g))).toEqual([["a", "b"], ["d"], ["e"]]);
      expect(noeud("b")).toBe(b);
      expect(noeud("d")).toBe(d);
      expect(noeud("e")).toBe(e);
      expect(console_.mock.calls.filter(appel => String(appel[0]).includes("same key"))).toEqual([]);
    } finally {
      console_.mockRestore();
    }
  });

  it("sous intertitres, le pli range lui aussi ses fils vierges par groupe, chacun nommé", () => {
    const etapes: Record<string, string | null> = { reel: "Proposition", v0: null, v1: "Proposition", v2: "Bilan" };
    const vierge = (cle: string) => fil(cle, { virtual: true, total: 0, last: null });
    const { container } = wrap(<ThreadColumn
      threads={[fil("reel"), vierge("v0"), vierge("v1"), vierge("v2")]}
      selected={null} onSelect={() => {}} groupLabel={th => etapes[th.key]} />);
    const pli = container.querySelector(".comment-collapsible")!;
    const groupes = [...pli.querySelectorAll("[data-thread-group]")];
    expect(groupes.map(g => [g.getAttribute("data-thread-group"), cles(g)])).toEqual([["", ["v0"]], ["Proposition", ["v1"]], ["Bilan", ["v2"]]]);
    // Le groupe sans intertitre prend le nom du pli ; les autres, le leur.
    expect([...pli.querySelectorAll("ul")].map(ul => ul.getAttribute("aria-label"))).toEqual(["Sans discussion (3)", "Proposition", "Bilan"]);
    expect([...pli.querySelectorAll("[data-thread-group] > p")].map(p => p.textContent)).toEqual(["Proposition", "Bilan"]);
  });

  it("sépare les groupes d'un filet, sauf le premier", () => {
    const { container } = wrap(<ThreadColumn threads={[fil("a"), fil("b")]} selected={null} onSelect={() => {}}
      groupLabel={th => (th.key === "a" ? null : "Proposition")} />);
    const [premier, second] = [...container.querySelectorAll("[data-thread-group]")];
    expect(premier.className).not.toContain("border-t");
    expect(second.className).toContain("border-t");
  });

  it("garde dans la liste un fil vierge ÉPINGLÉ, et replie les autres", () => {
    // Le fil général d'un commun : vierge ou non, c'est là qu'on arrive.
    const { container } = wrap(<ThreadColumn
      threads={[fil("general", { virtual: true, total: 0, last: null }), fil("question", { virtual: true, total: 0, last: null })]}
      selected={null} onSelect={() => {}} pinned={th => th.key === "general"} />);
    const pli = container.querySelector(".comment-collapsible")!;
    expect(cles(pli)).toEqual(["question"]);
    expect(cles(container.querySelector('ul[aria-label="Fils"]')!)).toEqual(["general"]);
    // Le pli ne compte que ce qu'il contient.
    expect(screen.getByRole("button", { name: "Sans discussion (1)" })).toBeTruthy();
  });

  it("épingle aussi sous intertitres : le fil vierge épinglé reste dans son groupe", () => {
    const { container } = wrap(<ThreadColumn
      threads={[fil("general", { virtual: true, total: 0, last: null }), fil("question", { virtual: true, total: 0, last: null })]}
      selected={null} onSelect={() => {}} pinned={th => th.key === "general"} groupLabel={() => null} />);
    expect(cles(container.querySelector("[data-thread-group]")!)).toEqual(["general"]);
    expect(cles(container.querySelector(".comment-collapsible")!)).toEqual(["question"]);
  });

  it("invite à démarrer un fil vierge par défaut, avec les mots qu'on lui donne sinon", () => {
    const vierge = fil("a", { virtual: true, total: 0, last: null });
    const { container: defaut } = wrap(
      <ThreadColumn threads={[vierge]} selected={null} onSelect={() => {}} pinned={() => true} />);
    expect(defaut.querySelector("[data-thread-meta]")!.textContent).toContain("Démarrer la discussion");

    const { container: autre } = wrap(
      <ThreadColumn threads={[vierge]} selected={null} onSelect={() => {}} pinned={() => true} startLabel="Écrire le premier message" />);
    expect(autre.querySelector("[data-thread-meta]")!.textContent).toContain("Écrire le premier message");
    expect(autre.querySelector("[data-thread-meta]")!.textContent).not.toContain("Démarrer la discussion");
  });

  it("se tait sur un fil vierge quand le lecteur ne peut pas écrire (`startLabel` nul)", () => {
    // Un visiteur n'a rien à démarrer : ni invitation, ni « 0 message » qui ferait croire à un fil vidé.
    const { container } = wrap(<ThreadColumn
      threads={[fil("a", { virtual: true, total: 0, last: null })]}
      selected={null} onSelect={() => {}} pinned={() => true} startLabel={null} />);
    const meta = container.querySelector("[data-thread-meta]")!;
    expect(meta.textContent).toBe("Formulaire");
    expect(meta.textContent).not.toContain("Démarrer");
    expect(meta.textContent).not.toContain("0");
  });
});
