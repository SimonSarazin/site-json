// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommunSectionNavContext, tabbedSectionNav, useShowSection } from "./useCommunSectionNav";

/** Navigation vers une section, défilement simple et onglets (vrais onglets Radix : contenu fermé non rendu). */

/** Les éléments sur lesquels `scrollIntoView` a été appelé, dans l'ordre. */
const scrolled: Element[] = [];

beforeEach(() => {
  scrolled.length = 0;
  Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
    scrolled.push(this);
  });
});
afterEach(cleanup);

/** Un bloc qui demande une section — la carte de financement, réduite à ses liens. */
function Liens({ ids }: { ids: string[] }) {
  const showSection = useShowSection();
  return (
    <>
      {ids.map((id) => (
        <button key={id} type="button" onClick={() => showSection(id)}>{`vers-${id}`}</button>
      ))}
    </>
  );
}

type Onglet = "a" | "b";
const ONGLET_DE: Record<string, Onglet> = { "dans-a": "a", "dans-b": "b" };

function FicheAOnglets() {
  const [tab, setTab] = useState<Onglet>("a");
  const showSection = tabbedSectionNav<Onglet>(setTab, (id) => ONGLET_DE[id] ?? null);
  return (
    <CommunSectionNavContext.Provider value={showSection}>
      <div id="hors-onglets" />
      <Liens ids={["dans-a", "dans-b", "hors-onglets", "inconnue"]} />
      <Tabs value={tab} onValueChange={(value) => setTab(value as Onglet)}>
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">
          <section id="dans-a" />
        </TabsContent>
        <TabsContent value="b">
          <section id="dans-b" />
        </TabsContent>
      </Tabs>
    </CommunSectionNavContext.Provider>
  );
}

describe("useShowSection — fiche verticale (sans fournisseur)", () => {
  it("défile jusqu'à l'ancre, déjà dans la page", () => {
    render(
      <>
        <section id="cofinanceurs" />
        <Liens ids={["cofinanceurs"]} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "vers-cofinanceurs" }));
    expect(scrolled.map((el) => el.id)).toEqual(["cofinanceurs"]);
  });

  it("une ancre absente : rien, sans erreur", () => {
    render(<Liens ids={["absente"]} />);
    fireEvent.click(screen.getByRole("button", { name: "vers-absente" }));
    expect(scrolled).toEqual([]);
  });
});

describe("tabbedSectionNav — interface à onglets", () => {
  it("l'ancre d'un onglet FERMÉ : l'onglet s'ouvre, puis on y défile", () => {
    render(<FicheAOnglets />);
    expect(document.getElementById("dans-b")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "vers-dans-b" }));

    expect(screen.getByRole("tab", { name: "B" }).getAttribute("aria-selected")).toBe("true");
    expect(scrolled.map((el) => el.id)).toEqual(["dans-b"]);
  });

  it("l'ancre de l'onglet déjà ouvert : défilement seul", () => {
    render(<FicheAOnglets />);
    fireEvent.click(screen.getByRole("button", { name: "vers-dans-a" }));

    expect(screen.getByRole("tab", { name: "A" }).getAttribute("aria-selected")).toBe("true");
    expect(scrolled.map((el) => el.id)).toEqual(["dans-a"]);
  });

  it("une ancre hors des onglets : défilement seul, l'onglet ouvert ne bouge pas", () => {
    render(<FicheAOnglets />);
    fireEvent.click(screen.getByRole("button", { name: "vers-hors-onglets" }));

    expect(screen.getByRole("tab", { name: "A" }).getAttribute("aria-selected")).toBe("true");
    expect(scrolled.map((el) => el.id)).toEqual(["hors-onglets"]);
  });

  it("une ancre inconnue : ni onglet, ni défilement", () => {
    render(<FicheAOnglets />);
    fireEvent.click(screen.getByRole("button", { name: "vers-inconnue" }));

    expect(screen.getByRole("tab", { name: "A" }).getAttribute("aria-selected")).toBe("true");
    expect(scrolled).toEqual([]);
  });
});
