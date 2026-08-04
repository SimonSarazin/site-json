// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { useState } from "react";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../tests/test-utils-ui";
import { DateTimePicker } from "./datetime-picker";

/**
 * Saisie de l'heure.
 *
 * Pourquoi ces tests EXISTENT : le champ heure d'une date de fin d'événement a
 * été inutilisable en production. Les segments maison composaient la valeur en
 * deux temps à partir de la valeur AFFICHÉE, tandis qu'un `clampDate` posé sur
 * le chemin de frappe annulait la première frappe sans remettre leur état :
 * taper « 15 » sur un champ à 14 donnait **23**. Le symptôme changeait avec la
 * vitesse de frappe — un minuteur de 2 s réarmait cet état — ce qui rendait le
 * défaut irreproductible à la demande et l'a fait survivre aux relectures.
 * Constaté puis reproduit au navigateur le 2026-08-03.
 *
 * Ces tests portent sur le CONTRAT — la valeur remontée au parent — et non sur
 * la structure interne. Une première version les avait écrits contre les
 * segments : ils passaient au vert parce qu'ils montaient `TimePicker` seul, en
 * contournant le `clampDate` qui vit dans `DateTimePicker`. D'où le montage du
 * composant public ici, et l'assertion sur `onChange`.
 */

/** Hôte contrôlé : le composant l'est, un montage non contrôlé ne prouverait rien. */
function HotePicker({
  initiale,
  min,
  onValeur,
}: {
  initiale: Date;
  min?: Date;
  onValeur?: (d: Date | undefined) => void;
}) {
  const [date, setDate] = useState<Date | undefined>(initiale);
  return (
    <DateTimePicker
      value={date}
      min={min}
      granularity="minute"
      onChange={(d) => {
        setDate(d);
        onValeur?.(d);
      }}
    />
  );
}

const le = (h: number, m = 30) => new Date(2026, 7, 10, h, m, 0, 0);
const champHeure = () => document.querySelector<HTMLInputElement>('input[type="time"]');

/** Le popover Radix est fermé au repos : le champ heure n'existe qu'une fois ouvert. */
function ouvrir() {
  const decl = document.querySelector("button");
  if (!decl) throw new Error("déclencheur du sélecteur introuvable");
  fireEvent.click(decl);
}

describe("DateTimePicker — saisie de l'heure", () => {
  it("expose un champ horaire natif, éditable au doigt comme au clavier", () => {
    renderWithProviders(<HotePicker initiale={le(14)} />);
    ouvrir();
    // Le patron segmenté précédent n'était pilotable qu'aux flèches du clavier :
    // inutilisable sur mobile, où elles n'existent pas.
    expect(champHeure()).not.toBeNull();
    expect(champHeure()!.value).toBe("14:30");
  });

  it("écrit l'heure saisie, même quand une borne `min` existe le MÊME jour", () => {
    // Cas réel : date de fin d'un événement, bornée par sa date de début. C'est
    // la configuration où le champ était inutilisable.
    let vue: Date | undefined;
    renderWithProviders(<HotePicker initiale={le(14)} min={le(14)} onValeur={(d) => (vue = d)} />);
    ouvrir();

    fireEvent.change(champHeure()!, { target: { value: "15:45" } });

    expect(vue?.getHours()).toBe(15);
    expect(vue?.getMinutes()).toBe(45);
  });

  it("ne fabrique JAMAIS une valeur que l'utilisateur n'a pas saisie", () => {
    // Le défaut historique : 14 + frappe « 15 » → 23, valeur sans rapport avec
    // la saisie (écrêtage de « 45 », composé sur le « 4 » resté affiché).
    let vue: Date | undefined;
    renderWithProviders(<HotePicker initiale={le(14)} min={le(14)} onValeur={(d) => (vue = d)} />);
    ouvrir();

    fireEvent.change(champHeure()!, { target: { value: "15:00" } });

    expect(vue?.getHours()).not.toBe(23);
  });

  it("permet de saisir une heure ANTÉRIEURE à la borne, sans la corriger en silence", () => {
    // L'invariant « fin ≥ début » appartient au validateur
    // (`profil/forms/validators.ts:34-36`), qui l'explique à l'utilisateur.
    // Le sélecteur ne doit pas l'appliquer une seconde fois sans rien dire :
    // c'est ce clamp muet qui rendait le champ impossible à modifier.
    let vue: Date | undefined;
    renderWithProviders(<HotePicker initiale={le(14)} min={le(14)} onValeur={(d) => (vue = d)} />);
    ouvrir();

    fireEvent.change(champHeure()!, { target: { value: "09:00" } });

    expect(vue?.getHours()).toBe(9);
  });

  it("préserve le JOUR : seule l'heure change", () => {
    let vue: Date | undefined;
    renderWithProviders(<HotePicker initiale={le(14)} onValeur={(d) => (vue = d)} />);
    ouvrir();

    fireEvent.change(champHeure()!, { target: { value: "08:15" } });

    expect(vue?.getFullYear()).toBe(2026);
    expect(vue?.getMonth()).toBe(7);
    expect(vue?.getDate()).toBe(10);
  });

  it("ignore une saisie partielle au lieu d'écrire une date bancale", () => {
    // L'input natif émet des valeurs intermédiaires pendant la frappe.
    let appels = 0;
    renderWithProviders(<HotePicker initiale={le(14)} onValeur={() => (appels += 1)} />);
    ouvrir();

    fireEvent.change(champHeure()!, { target: { value: "" } });
    fireEvent.change(champHeure()!, { target: { value: "1" } });

    expect(appels).toBe(0);
  });
});
