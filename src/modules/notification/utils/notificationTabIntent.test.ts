import { describe, it, expect } from "vitest";
import { notificationTabIntent } from "./notificationTabIntent";
import type { NotificationItemData } from "@communecter/cocolight-api-client";

const data = (verb?: string, objectType?: string): NotificationItemData =>
  ({ verb, notify: { objectType } }) as unknown as NotificationItemData;

describe("notificationTabIntent", () => {
  it("post → journal", () => {
    expect(notificationTabIntent(data("post"), "organizations")).toBe("journal");
  });

  it("ask sur projet/organisation → community", () => {
    expect(notificationTabIntent(data("ask"), "projects")).toBe("community");
    expect(notificationTabIntent(data("ask"), "organizations")).toBe("community");
  });

  it("ask hors projet/organisation → root", () => {
    expect(notificationTabIntent(data("ask"), "citoyens")).toBe("root");
    expect(notificationTabIntent(data("ask"), "events")).toBe("root");
  });

  it("add + asMember → community", () => {
    expect(notificationTabIntent(data("add", "asMember"), "organizations")).toBe("community");
  });

  it("add sans asMember → root", () => {
    expect(notificationTabIntent(data("add", "asComment"), "organizations")).toBe("root");
    expect(notificationTabIntent(data("add"), "organizations")).toBe("root");
  });

  it("verbe inconnu / absent → root", () => {
    expect(notificationTabIntent(data("comment"), "projects")).toBe("root");
    expect(notificationTabIntent(undefined, "projects")).toBe("root");
  });
});
