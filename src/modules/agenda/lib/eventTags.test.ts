import { describe, it, expect } from "vitest";
import type { Event } from "@communecter/cocolight-api-client";
import { eventTags, distinctTags, filterByTags } from "./eventTags";

const ev = (tags: unknown) => ({ serverData: { tags } }) as unknown as Event;

describe("eventTags", () => {
  it("array de strings", () => expect(eventTags(ev(["a", "b"]))).toEqual(["a", "b"]));
  it("objet {tag:true} → clés", () => expect(eventTags(ev({ a: true, b: true }))).toEqual(["a", "b"]));
  it("absent → []", () => expect(eventTags(ev(undefined))).toEqual([]));
});

describe("distinctTags", () => {
  it("union triée dédupliquée", () => {
    expect(distinctTags([ev(["b", "a"]), ev(["a", "c"]), ev(undefined)])).toEqual(["a", "b", "c"]);
  });
});

describe("filterByTags", () => {
  const events = [ev(["a"]), ev(["b"]), ev(["a", "c"]), ev([])];
  it("sélection vide → tout", () => expect(filterByTags(events, [])).toHaveLength(4));
  it("OR : au moins un tag sélectionné", () => expect(filterByTags(events, ["a"])).toHaveLength(2));
  it("OR multi", () => expect(filterByTags(events, ["b", "c"])).toHaveLength(2));
});
