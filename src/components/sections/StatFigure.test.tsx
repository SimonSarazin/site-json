// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "@/i18n";

/**
 * Les libellés lecteur d'écran de la tuile viennent du namespace `components/sections` (enregistré
 * par `./i18n/i18n`, importé par `StatFigure`) — ici SANS doublure d'i18n : en anglais, une clé
 * absente du namespace se lirait en français.
 */
vi.mock("@/hooks/useLocalization", () => ({ useLocalization: () => ({ t: (k: unknown) => String(k) }) }));

import { StatFigure } from "./StatFigure";

beforeAll(async () => {
  await i18n.changeLanguage("en");
});
afterAll(async () => {
  await i18n.changeLanguage("fr");
});

describe("StatFigure — namespace components/sections", () => {
  it("attente : « Loading figure » en anglais", () => {
    render(<StatFigure state={{ value: null, unavailable: false }}>{(v) => v}</StatFigure>);
    expect(screen.getByText("Loading figure")).toBeTruthy();
  });

  it("absence (après hydratation) : « Figure unavailable » en anglais", () => {
    render(<StatFigure state={{ value: null, unavailable: true }}>{(v) => v}</StatFigure>);
    expect(screen.getByText("Figure unavailable")).toBeTruthy();
  });
});
