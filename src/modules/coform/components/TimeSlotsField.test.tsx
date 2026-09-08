// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

// useT sort du LocalizationProvider (absent en test) → mock clé/fallback,
// même convention que SmartCoForm.test.tsx.
vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, _fallback?: string) => key,
}));

import { TimeSlotsField } from "./TimeSlotsField";
import { DynamicFieldsField } from "./DynamicFieldsField";
import type { DynamicFieldsRow, FormFieldMapping, TimeSlotValue } from "../types";

/**
 * Rendu + interactions des deux répéteurs (`timeSlots` / `dynamicFields`) :
 * le contrat testé est le FORMAT DE DONNÉES émis par onChange — celui des
 * answers legacy réelles (cf. utils/timeSlots.test.ts pour la logique pure).
 */

function makeField(overrides: Partial<FormFieldMapping>): FormFieldMapping {
  return {
    name: "field1",
    label: "Champ",
    type: "tpls.forms.cplx.timeSlots",
    componentType: "timeSlots",
    isRequired: false,
    ...overrides,
  };
}

const REAL_SLOT: TimeSlotValue = { day: "Monday", startHour: "08", startMinute: "00", endHour: "09", endMinute: "00" };

describe("TimeSlotsField", () => {
  it("rend un slot existant (format answers SSBE) dans les inputs time", () => {
    const { container } = render(
      <TimeSlotsField field={makeField({})} errors={{}} value={[REAL_SLOT]} />,
    );
    const times = container.querySelectorAll('input[type="time"]');
    expect(times).toHaveLength(2);
    expect((times[0] as HTMLInputElement).value).toBe("08:00");
    expect((times[1] as HTMLInputElement).value).toBe("09:00");
  });

  it("ajoute un slot pré-rempli des défauts config au format legacy", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <TimeSlotsField
        field={makeField({ timeSlotsConfig: { defaultStartTime: "09:00", defaultEndTime: "17:00" } })}
        errors={{}}
        value={[]}
        onChange={onChange}
      />,
    );
    fireEvent.click(getByRole("button", { name: /addSlot/ }));
    expect(onChange).toHaveBeenCalledWith([
      { day: "", startHour: "09", startMinute: "00", endHour: "17", endMinute: "00" },
    ]);
  });

  it("émet le patch au format legacy quand une heure change", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TimeSlotsField field={makeField({})} errors={{}} value={[REAL_SLOT]} onChange={onChange} />,
    );
    const end = container.querySelectorAll('input[type="time"]')[1] as HTMLInputElement;
    fireEvent.change(end, { target: { value: "10:30" } });
    expect(onChange).toHaveBeenCalledWith([{ ...REAL_SLOT, endHour: "10", endMinute: "30" }]);
  });

  it("signale inline un slot désordonné (fin <= début)", () => {
    const { container } = render(
      <TimeSlotsField
        field={makeField({})}
        errors={{}}
        value={[{ ...REAL_SLOT, endHour: "07" }]}
      />,
    );
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("masque le bouton d'ajout quand enableMultipleSlots=false et 1 slot existe", () => {
    const { queryByRole } = render(
      <TimeSlotsField
        field={makeField({ timeSlotsConfig: { enableMultipleSlots: false } })}
        errors={{}}
        value={[REAL_SLOT]}
      />,
    );
    expect(queryByRole("button", { name: /addSlot/ })).toBeNull();
  });
});

const DYN_FIELD = makeField({
  type: "tpls.forms.cplx.dynamicFields",
  componentType: "dynamicFields",
  dynamicFieldsConfig: {
    enableMultipleRows: true,
    minRows: 1,
    maxRows: 2,
    fieldsConfig: [
      { key: "partnerName", label: "Nom du partenaire", type: "text", required: true },
      { key: "postalCode", label: "Code postal", type: "select", options: { "97430": "97430 - LE TAMPON" } },
    ],
  },
});

describe("DynamicFieldsField", () => {
  it("n'écrit PAS dans le formulaire au montage", () => {
    // Les `minRows` lignes viennent de `generateDefaultValues` (cf.
    // formParser.test.ts). Les semer ici par `onChange` rendait le formulaire
    // `isDirty` avant toute saisie — alerte « modifications non enregistrées »
    // et autosave sur un formulaire jamais touché.
    const onChange = vi.fn();
    render(<DynamicFieldsField field={DYN_FIELD} errors={{}} value={[]} onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rend les sous-champs configurés avec leurs labels et valeurs", () => {
    const rows: DynamicFieldsRow[] = [{ partnerName: "ADAPTETONSPORT", postalCode: "97430" }];
    const { container, getByText } = render(
      <DynamicFieldsField field={DYN_FIELD} errors={{}} value={rows} />,
    );
    getByText("Nom du partenaire");
    expect((container.querySelector('input[type="text"]') as HTMLInputElement).value).toBe("ADAPTETONSPORT");
  });

  it("émet la ligne éditée au format legacy {clé: valeur}", () => {
    const onChange = vi.fn();
    const rows: DynamicFieldsRow[] = [{ partnerName: "", postalCode: "" }];
    const { container } = render(
      <DynamicFieldsField field={DYN_FIELD} errors={{}} value={rows} onChange={onChange} />,
    );
    fireEvent.change(container.querySelector('input[type="text"]') as HTMLInputElement, {
      target: { value: "ADAPTE" },
    });
    expect(onChange).toHaveBeenCalledWith([{ partnerName: "ADAPTE", postalCode: "" }]);
  });

  it("bloque l'ajout au-delà de maxRows", () => {
    const rows: DynamicFieldsRow[] = [
      { partnerName: "A", postalCode: "" },
      { partnerName: "B", postalCode: "" },
    ];
    const { queryByRole } = render(<DynamicFieldsField field={DYN_FIELD} errors={{}} value={rows} />);
    expect(queryByRole("button", { name: /addRow/ })).toBeNull();
  });

  it("ne rend rien sans fieldsConfig (champ inconfiguré côté admin)", () => {
    const empty = makeField({ componentType: "dynamicFields" });
    const { container } = render(<DynamicFieldsField field={empty} errors={{}} value={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

/**
 * Libellé de la question et nommage a11y — filet de RENDU.
 *
 * Ces deux champs sont arrivés par le merge `main` → `jdev` (f2f92ae2) avec le
 * bloc `<Label>` inline pré-refactor, sur une branche où `FieldLabel` n'existait
 * pas. Le garde-fou statique `tests/preflight/coform-field-label.test.ts`
 * surveille le TEXTE SOURCE ; il ne voit pas un libellé rendu via une variable
 * ou un sous-composant. Ici on vérifie le DOM réellement produit.
 */

/**
 * Le groupe et son libellé, ou un échec net.
 *
 * ⚠️ Ne PAS remplacer par de l'optional chaining : `expect(undefined).not.toBeNull()`
 * PASSE. Avec `libelle?.querySelector(...)`, l'assertion « il y a un sr-only »
 * restait verte alors que le libellé n'existait plus du tout — un test incapable
 * d'échouer. La recherche est aussi scopée au `container` (les deux champs
 * partagent `field.name`, donc le même id).
 */
function groupeEtLibelle(container: HTMLElement) {
  const groupe = container.querySelector('[role="group"]');
  if (!groupe) throw new Error("aucun élément role=\"group\" rendu");
  const labelId = groupe.getAttribute("aria-labelledby");
  if (!labelId) throw new Error("le groupe ne porte pas d'aria-labelledby");
  const libelle = container.querySelector(`[id="${labelId}"]`);
  if (!libelle) throw new Error(`aria-labelledby pointe « ${labelId} », introuvable dans le rendu`);
  return { groupe, libelle };
}

describe.each([
  ["TimeSlotsField", TimeSlotsField, makeField({ label: "Horaires" })],
  ["DynamicFieldsField", DynamicFieldsField, { ...DYN_FIELD, label: "Horaires" }],
] as const)("%s — libellé de la question", (_nom, Composant, champ) => {
  it("nomme le groupe par le libellé, rendu dans la hiérarchie « question »", () => {
    const { container } = render(<Composant field={champ} errors={{}} value={[]} />);
    const { libelle } = groupeEtLibelle(container);
    expect(libelle.textContent).toContain("Horaires");
    // L'écart d'un cran de taille ET de graisse est ce qui distingue « ce qui
    // est demandé » de « ce avec quoi on répond ». C'est ce que la copie
    // inline (text-sm font-medium) cassait.
    expect(libelle.className).toContain("text-base");
    expect(libelle.className).toContain("font-semibold");
  });

  it("porte le caractère obligatoire en texte lecteur d'écran, pas en astérisque seule", () => {
    const { container } = render(
      <Composant field={{ ...champ, isRequired: true }} errors={{}} value={[]} />,
    );
    const { libelle } = groupeEtLibelle(container);
    // Sans ce `sr-only`, l'astérisque s'annonce « étoile ».
    expect(libelle.querySelector(".sr-only")).not.toBeNull();
  });

  it("rattache le message d'erreur au groupe, et le libellé passe en rouge", () => {
    const { container } = render(
      <Composant
        field={champ}
        errors={{ field1: { type: "custom", message: "Créneau incomplet" } }}
        value={[]}
      />,
    );
    const { groupe, libelle } = groupeEtLibelle(container);
    const decritPar = groupe.getAttribute("aria-describedby");
    expect(decritPar).not.toBeNull();
    // La cible doit EXISTER : un aria-describedby pendant ne dit rien à personne.
    expect(container.querySelector(`[id="${decritPar}"]`)?.textContent).toContain(
      "Créneau incomplet",
    );
    expect(libelle.className).toContain("text-destructive");
  });

  it("ne pointe aucune description quand l'erreur n'a pas de message", () => {
    // Erreur zod imbriquée (donnée legacy au mauvais type dans un sous-champ) :
    // `hasError` est vrai mais `FieldError` ne rend rien. Dériver l'id de
    // `hasError` produirait un `aria-describedby` vers un élément inexistant.
    const { container } = render(
      <Composant field={champ} errors={{ field1: { type: "custom" } }} value={[]} />,
    );
    const { groupe } = groupeEtLibelle(container);
    expect(groupe.getAttribute("aria-describedby")).toBeNull();
  });

  it("n'expose pas de groupe anonyme quand la question n'a pas de libellé", () => {
    const { container } = render(
      <Composant field={{ ...champ, label: "" }} errors={{}} value={[]} />,
    );
    expect(container.querySelector('[role="group"]')).toBeNull();
  });
});
