// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import TimelineListView from "./TimelineListView";
import { ListConfSchema, type ListConf } from "../schema";

/**
 * Structure de la vue timeline : bulle-date, alternance par index, repli sans date,
 * ancrage `data-item-id` (scrollIntoView de SearchListView) et remontée du clic avec
 * la conf résolue de l'item. La carte réelle est stubbée (elle a son propre test).
 */
vi.mock("./card/CardEventTimeline", () => ({
  default: ({ item, onClick }: { item: SearchEntity; onClick?: () => void }) => (
    <button onClick={onClick}>{String((item.serverData as { name?: string }).name)}</button>
  ),
}));

const event = (id: string, name: string, startDate?: string) =>
  ({ serverData: { id, name, ...(startDate ? { startDate } : {}) } } as unknown as SearchEntity);

// Dates SANS fuseau (parse local) : le jour affiché ne dépend pas du TZ du runner.
const results = [
  event("1", "Rencontre", "2026-06-26T08:00:00"),
  event("2", "Atelier", "2025-11-28T09:30:00"),
  event("3", "Sans date"),
];

const renderTimeline = (over: Partial<React.ComponentProps<typeof TimelineListView>> = {}) => {
  const onItemClick = vi.fn();
  const utils = render(
    <TimelineListView
      results={results}
      itemLists={[undefined, undefined, undefined]}
      onItemClick={onItemClick}
      containerRef={{ current: null }}
      {...over}
    />,
  );
  return { ...utils, onItemClick };
};

describe("TimelineListView", () => {
  it("rend une bulle-date jour/mois/année par item daté", () => {
    const { getByText, getAllByText } = renderTimeline();
    expect(getByText("26")).toBeInTheDocument();
    expect(getByText("2026")).toBeInTheDocument();
    expect(getByText("28")).toBeInTheDocument();
    expect(getByText("2025")).toBeInTheDocument();
    expect(getAllByText(/^\d{4}$/)).toHaveLength(2); // l'item sans date n'a PAS d'année
  });

  it("item sans startDate : bulle de repli neutre (bg-muted), sans chiffres", () => {
    const { container } = renderTimeline();
    expect(container.querySelectorAll(".bg-muted")).toHaveLength(1);
    expect(container.querySelectorAll(".bg-primary")).toHaveLength(2);
  });

  it("alterne les cartes gauche/droite PAR INDEX (stable en scroll infini)", () => {
    const { container } = renderTimeline();
    const wrappers = [...container.querySelectorAll("[data-item-id]")];
    expect(wrappers[0]?.className).toContain("md:mr-auto");
    expect(wrappers[1]?.className).toContain("md:ml-auto");
    expect(wrappers[2]?.className).toContain("md:mr-auto");
    expect(wrappers[0]?.parentElement?.className).toContain("md:flex-row");
    expect(wrappers[1]?.parentElement?.className).toContain("md:flex-row-reverse");
  });

  it("pose data-item-id et le ring sur l'item focalisé (synchro SearchListView)", () => {
    const { container } = renderTimeline({ focusedItemId: "2" });
    expect(container.querySelector('[data-item-id="2"]')?.className).toContain("ring-2");
    expect(container.querySelector('[data-item-id="1"]')?.className).not.toContain("ring-2");
  });

  it("un clic remonte l'item ET sa conf résolue (itemLists[i])", () => {
    const confs: (ListConf | undefined)[] = [{ card: { type: "event" } }, undefined, undefined];
    const { getByText, onItemClick } = renderTimeline({ itemLists: confs });
    fireEvent.click(getByText("Rencontre"));
    expect(onItemClick).toHaveBeenCalledWith(results[0], confs[0]);
  });
});

describe("ListConfSchema.layout", () => {
  it("accepte grid et timeline, rejette une valeur inconnue", () => {
    expect(ListConfSchema.safeParse({ layout: "timeline" }).success).toBe(true);
    expect(ListConfSchema.safeParse({ layout: "grid" }).success).toBe(true);
    expect(ListConfSchema.safeParse({ layout: "zigzag" }).success).toBe(false);
  });
});
