// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
