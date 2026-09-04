// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CoFormData } from "../types";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));

import { MultiStepCoForm } from "./MultiStepCoForm";

// jsdom n'implémente pas scrollIntoView, que le composant appelle au changement d'étape.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

/**
 * Navigation directe entre étapes depuis l'en-tête.
 *
 * Le point dur n'est pas d'afficher des pastilles cliquables : c'est que quitter
 * une étape sans l'avoir soumise ne perde pas la saisie. `react-hook-form` est
 * remonté à zéro à chaque changement d'étape (`form.reset` dans `useCoFormStep`),
 * donc sans sauvegarde explicite du brouillon AVANT le saut, tout ce qui a été
 * tapé disparaît sans un mot.
 */
const FORM: CoFormData = {
  _id: { $id: "form1" },
  id: "form1",
  name: "Formulaire de test",
  created: 0,
  creator: "u1",
  type: "form",
  inputs: {
    etape1: { step: 1, name: "Identité", id: "etape1", formParent: "form1", inputs: { nom: { type: "text", label: "Nom", position: "0" } } },
    etape2: { step: 2, name: "Activités", id: "etape2", formParent: "form1", inputs: { activite: { type: "text", label: "Activité", position: "0" } } },
    etape3: { step: 3, name: "Gouvernance", id: "etape3", formParent: "form1", inputs: { gouv: { type: "text", label: "Mode de décision", position: "0" } } },
  },
} as unknown as CoFormData;

const stepButton = (name: string) => {
  const nav = screen.getByRole("navigation");
  return within(nav).getByTitle(name);
};

/** Formulaire dont la 2e étape a un champ obligatoire. */
const FORM_REQUIS: CoFormData = {
  ...FORM,
  inputs: {
    etape1: { step: 1, name: "Identité", id: "etape1", formParent: "form1", inputs: { nom: { type: "text", label: "Nom", position: "0" } } },
    etape2: { step: 2, name: "Activités", id: "etape2", formParent: "form1", inputs: { activite: { type: "text", label: "Activité", position: "0", isRequired: true } } },
    etape3: { step: 3, name: "Gouvernance", id: "etape3", formParent: "form1", inputs: { gouv: { type: "text", label: "Mode de décision", position: "0" } } },
  },
} as unknown as CoFormData;

describe("MultiStepCoForm — en-tête d'étapes", () => {
  it("rend un en-tête navigable dès qu'il y a plusieurs étapes", () => {
    render(<MultiStepCoForm formData={FORM} enableDraft={false} />);

    const nav = screen.getByRole("navigation");
    expect(within(nav).getByTitle("Identité")).toBeTruthy();
    expect(within(nav).getByTitle("Gouvernance")).toBeTruthy();
  });

  it("saute à l'étape choisie sans passer par les intermédiaires", async () => {
    const user = userEvent.setup();
    render(<MultiStepCoForm formData={FORM} enableDraft={false} />);

    await user.click(stepButton("Gouvernance"));

    // Le formulaire de l'étape 3 est rendu — c'est son champ qui le prouve.
    expect(screen.getByLabelText(/Mode de décision/)).toBeTruthy();
  });

  it("marque complétée l'étape qu'on quitte quand elle est valide", async () => {
    const user = userEvent.setup();
    const { container } = render(<MultiStepCoForm formData={FORM} enableDraft={false} />);

    await user.type(screen.getByLabelText(/Nom/), "Les Ateliers");
    await user.click(stepButton("Activités"));

    // La pastille de l'étape 1 porte la coche, pas son numéro.
    const premier = within(screen.getByRole("navigation")).getByTitle("Identité");
    expect(premier.textContent).not.toContain("1");
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("ne laisse pas partir une réponse dont une étape sautée est incomplète", async () => {
    const user = userEvent.setup();
    const onFinalSubmit = vi.fn().mockResolvedValue(undefined);
    render(<MultiStepCoForm formData={FORM_REQUIS} enableDraft={false} onFinalSubmit={onFinalSubmit} />);

    // On saute directement à la dernière étape et on envoie : l'étape 2 et son
    // champ obligatoire n'ont jamais été affichés.
    await user.click(stepButton("Gouvernance"));
    await user.click(screen.getByRole("button", { name: "coform.navigation.submit" }));

    expect(onFinalSubmit).not.toHaveBeenCalled();
    // Et on est ramené sur l'étape fautive.
    expect(screen.getByLabelText(/Activité/)).toBeTruthy();
  });

  it("laisse partir la réponse quand toutes les étapes tiennent", async () => {
    const user = userEvent.setup();
    const onFinalSubmit = vi.fn().mockResolvedValue(undefined);
    render(<MultiStepCoForm formData={FORM_REQUIS} enableDraft={false} onFinalSubmit={onFinalSubmit} />);

    await user.click(stepButton("Activités"));
    await user.type(screen.getByLabelText(/Activité/), "Ateliers partagés");
    await user.click(stepButton("Gouvernance"));
    await user.click(screen.getByRole("button", { name: "coform.navigation.submit" }));

    await waitFor(() => expect(onFinalSubmit).toHaveBeenCalled());
  });

  it("envoie du premier coup quand c'est la DERNIÈRE étape qui portait le requis", async () => {
    // La garde lisait `stepState` capturé au rendu : après `submitStep()`, les
    // valeurs de l'étape courante n'y étaient pas encore, donc le premier
    // « Envoyer » accusait à tort l'étape qu'on venait de remplir.
    const user = userEvent.setup();
    const onFinalSubmit = vi.fn().mockResolvedValue(undefined);
    const FORM_DERNIER = {
      ...FORM,
      inputs: {
        etape1: { step: 1, name: "Identité", id: "etape1", formParent: "form1", inputs: { nom: { type: "text", label: "Nom", position: "0" } } },
        etape2: { step: 2, name: "Gouvernance", id: "etape2", formParent: "form1", inputs: { gouv: { type: "text", label: "Mode de décision", position: "0", isRequired: true } } },
      },
    } as unknown as CoFormData;
    render(<MultiStepCoForm formData={FORM_DERNIER} enableDraft={false} onFinalSubmit={onFinalSubmit} />);

    await user.click(stepButton("Gouvernance"));
    await user.type(screen.getByLabelText(/Mode de décision/), "Collégiale");
    await user.click(screen.getByRole("button", { name: "coform.navigation.submit" }));

    await waitFor(() => expect(onFinalSubmit).toHaveBeenCalledTimes(1));
  });

  it("bloque AVANT d'écrire au serveur quand une étape sautée est incomplète", async () => {
    // En mode "step", `submitStep()` persiste l'étape courante : refuser après
    // coup laisserait une écriture derrière soi.
    const user = userEvent.setup();
    const onStepSubmit = vi.fn().mockResolvedValue(undefined);
    const onFinalSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <MultiStepCoForm
        formData={FORM_REQUIS}
        enableDraft={false}
        submitMode="step"
        onStepSubmit={onStepSubmit}
        onFinalSubmit={onFinalSubmit}
      />
    );

    await user.click(stepButton("Gouvernance"));
    await user.click(screen.getByRole("button", { name: "coform.navigation.submit" }));

    expect(onStepSubmit).not.toHaveBeenCalled();
    expect(onFinalSubmit).not.toHaveBeenCalled();
  });

  it("ne perd pas la saisie en cours quand on change d'étape", async () => {
    const user = userEvent.setup();
    render(<MultiStepCoForm formData={FORM} enableDraft={false} />);

    await user.type(screen.getByLabelText(/Nom/), "Les Ateliers");
    await user.click(stepButton("Activités"));
    await user.click(stepButton("Identité"));

    expect(screen.getByLabelText(/Nom/)).toHaveValue("Les Ateliers");
  });
});
