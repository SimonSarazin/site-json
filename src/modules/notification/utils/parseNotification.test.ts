import { describe, it, expect } from "vitest";
import { parseNotification } from "./parseNotification";
import type { Notification } from "@communecter/cocolight-api-client";

/** Construit une fausse instance Notification minimale (seul `.data` est lu). */
function notif(data: Record<string, unknown>): Notification {
  return { data } as unknown as Notification;
}

describe("parseNotification", () => {
  it("cible directe (organisation) → entity", () => {
    const t = parseNotification(
      notif({ verb: "post", target: { type: "organizations", id: "org1" } }),
    );
    expect(t).toEqual({ kind: "entity", type: "organizations", id: "org1" });
  });

  it("invitation ami → auteur", () => {
    const t = parseNotification(
      notif({
        verb: "invite",
        target: { type: "citoyens", id: "me" },
        author: { type: "citoyens", id: "friend1" },
      }),
    );
    expect(t).toEqual({ kind: "invite", type: "citoyens", id: "friend1" });
  });

  it("news avec parent supporté → news + parent", () => {
    const t = parseNotification(
      notif({
        verb: "comment",
        target: { type: "news", id: "news1", parent: { type: "projects", id: "proj1" } },
      }),
    );
    expect(t).toEqual({
      kind: "news",
      id: "news1",
      parentType: "projects",
      parentId: "proj1",
    });
  });

  it("news sans parent supporté → null", () => {
    const t = parseNotification(
      notif({ target: { type: "news", id: "news1", parent: { type: "cms", id: "x" } } }),
    );
    expect(t).toBeNull();
  });

  it("type inconnu → null", () => {
    expect(parseNotification(notif({ target: { type: "cms", id: "x" } }))).toBeNull();
  });

  it("cible absente → null", () => {
    expect(parseNotification(notif({ verb: "post" }))).toBeNull();
  });
});
