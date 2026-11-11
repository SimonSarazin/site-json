// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import i18next from "i18next";
import MapPopupResourcePlace from "./MapPopupResourcePlace";
import fr from "../../i18n/fr.json";

// Vrai i18next sur le vrai fr.json : c'est lui qui choisit le pluriel à partir de `count`.
const i18n = i18next.createInstance();
void i18n.init({ lng: "fr", resources: { fr: { translation: fr } }, initImmediate: false, interpolation: { escapeValue: false } });
const t = (k: string, _fallback?: string, params?: Record<string, unknown>) => i18n.t(k, params);

const salle = { id: "s1" };
const coworking = { id: "s2" };
const lieu = {
  id: "p1",
  serverData: { name: "La Coroutine", address: { streetAddress: "16 allée de la Filature", postalCode: "59000", addressLocality: "Lille" } },
  resources: [
    { entry: salle, name: "Grande salle", typeLabel: "Salle de réunion" },
    { entry: coworking, name: "Espace de coworking", typeLabel: "Coworking" },
  ],
};

describe("MapPopupResourcePlace — popup d'un lieu de l'annuaire", () => {
  it("nom, adresse, nombre et liste des services du lieu", () => {
    render(<MapPopupResourcePlace item={lieu as never} t={t} />);
    expect(screen.getByText("La Coroutine")).toBeTruthy();
    expect(screen.getByText("16 allée de la Filature, 59000, Lille")).toBeTruthy();
    expect(screen.getByText("2 services")).toBeTruthy();
    expect(screen.getByText("Grande salle")).toBeTruthy();
    expect(screen.getByText("Coworking")).toBeTruthy();
  });

  it("un clic sur un service ouvre CE service", () => {
    const onOpenItem = vi.fn();
    render(<MapPopupResourcePlace item={lieu as never} t={t} onOpenItem={onOpenItem} />);
    fireEvent.click(screen.getByText("Espace de coworking"));
    expect(onOpenItem).toHaveBeenCalledTimes(1);
    expect(onOpenItem.mock.calls[0][0]).toBe(coworking);
  });

  it("un seul service : libellé au singulier", () => {
    render(<MapPopupResourcePlace item={{ ...lieu, resources: [lieu.resources[0]] } as never} t={t} />);
    expect(screen.getByText("1 service")).toBeTruthy();
  });
});
