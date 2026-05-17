import { describe, expect, it } from "vitest";
import type { FundingAction } from "@/modules/cagnotte/types";
import {
  isValidEntityId,
  resolveActionEntityId,
  resolveCreatedActionId,
} from "./actionIdResolvers";

describe("isValidEntityId", () => {
  it("retourne true pour une string non-vide", () => {
    expect(isValidEntityId("abc123")).toBe(true);
    expect(isValidEntityId("  trimmable  ")).toBe(true);
  });

  it("retourne false pour string vide / whitespace", () => {
    expect(isValidEntityId("")).toBe(false);
    expect(isValidEntityId("   ")).toBe(false);
  });

  it("retourne false pour non-string", () => {
    expect(isValidEntityId(null)).toBe(false);
    expect(isValidEntityId(undefined)).toBe(false);
    expect(isValidEntityId(42)).toBe(false);
    expect(isValidEntityId({ id: "abc" })).toBe(false);
  });
});

describe("resolveCreatedActionId", () => {
  const buildEnvelope = (actions: Array<Record<string, unknown>>) => ({
    projects: [
      {
        serverData: {
          id: "projectABC",
          actions,
        },
      },
    ],
  });

  it("retourne fallbackId si fourni et valide (short-circuit)", () => {
    const result = resolveCreatedActionId({
      rawEnvelope: buildEnvelope([]),
      projectId: "projectABC",
      milestoneId: "milestone1",
      name: "MyAction",
      credits: 5,
      expectedStatus: "todo",
      fallbackId: "shortcut123",
    });
    expect(result).toBe("shortcut123");
  });

  it("trouve l'action par match strict (name + credits + status + milestoneId)", () => {
    const envelope = buildEnvelope([
      {
        id: "action123",
        name: "TestAction",
        credits: 10,
        status: "todo",
        milestone: { milestoneId: "milestone1" },
      },
    ]);
    expect(
      resolveCreatedActionId({
        rawEnvelope: envelope,
        projectId: "projectABC",
        milestoneId: "milestone1",
        name: "TestAction",
        credits: 10,
        expectedStatus: "todo",
      }),
    ).toBe("action123");
  });

  it("match insensible à la casse sur le name", () => {
    const envelope = buildEnvelope([
      {
        id: "actionCase",
        name: "MixedCase",
        credits: 5,
        status: "todo",
        milestone: { milestoneId: "m1" },
      },
    ]);
    expect(
      resolveCreatedActionId({
        rawEnvelope: envelope,
        projectId: "projectABC",
        milestoneId: "m1",
        name: "mixedcase",
        credits: 5,
        expectedStatus: "todo",
      }),
    ).toBe("actionCase");
  });

  it("retourne '' si aucun match", () => {
    const envelope = buildEnvelope([
      {
        id: "wrong",
        name: "OtherAction",
        credits: 1,
        status: "todo",
        milestone: { milestoneId: "m1" },
      },
    ]);
    expect(
      resolveCreatedActionId({
        rawEnvelope: envelope,
        projectId: "projectABC",
        milestoneId: "m1",
        name: "Searching",
        credits: 99,
        expectedStatus: "done",
      }),
    ).toBe("");
  });

  it("retourne '' si rawEnvelope est vide ou invalide", () => {
    expect(
      resolveCreatedActionId({
        rawEnvelope: null,
        projectId: "p",
        milestoneId: "m",
        name: "n",
        credits: 1,
        expectedStatus: "todo",
      }),
    ).toBe("");
  });

  it("filtre par projectId : ignore les actions d'autres projets", () => {
    const envelope = {
      projects: [
        { serverData: { id: "otherProject", actions: [{ id: "wrong", name: "X", credits: 1, status: "todo", milestone: { milestoneId: "m1" } }] } },
        { serverData: { id: "myProject", actions: [{ id: "correct", name: "X", credits: 1, status: "todo", milestone: { milestoneId: "m1" } }] } },
      ],
    };
    expect(
      resolveCreatedActionId({
        rawEnvelope: envelope,
        projectId: "myProject",
        milestoneId: "m1",
        name: "X",
        credits: 1,
        expectedStatus: "todo",
      }),
    ).toBe("correct");
  });
});

describe("resolveActionEntityId", () => {
  const baseAction: FundingAction = {
    id: "existingActionId",
    name: "Action",
    credits: 10,
    status: "todo",
    tags: [],
    contributors: [],
  };

  it("retourne action.id si valide (short-circuit, pas de fallback resolve)", () => {
    expect(
      resolveActionEntityId({
        action: baseAction,
        milestoneId: "m1",
        projectId: "p1",
        rawEnvelope: null, // pas consulté
      }),
    ).toBe("existingActionId");
  });

  it("fallback sur resolveCreatedActionId si action.id invalide", () => {
    const envelope = {
      projects: [
        {
          serverData: {
            id: "p1",
            actions: [
              {
                id: "resolved",
                name: "Action",
                credits: 10,
                status: "todo",
                milestone: { milestoneId: "m1" },
              },
            ],
          },
        },
      ],
    };
    expect(
      resolveActionEntityId({
        action: { ...baseAction, id: "" },
        milestoneId: "m1",
        projectId: "p1",
        rawEnvelope: envelope,
      }),
    ).toBe("resolved");
  });

  it("retourne '' si fallback échoue aussi", () => {
    expect(
      resolveActionEntityId({
        action: { ...baseAction, id: "" },
        milestoneId: "m1",
        projectId: "p1",
        rawEnvelope: null,
      }),
    ).toBe("");
  });
});
