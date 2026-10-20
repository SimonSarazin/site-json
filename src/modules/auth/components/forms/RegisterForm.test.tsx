// @vitest-environment jsdom
/**
 * Inscription config-driven (docs/33 étape 5) : les champs `auth.register.fields` sont rendus après
 * les champs standards, `showIf` masque/affiche, `required` bloque, et `register` reçoit `mode` +
 * `fields` (valeurs non vides des champs visibles). Le toast de succès dit la vérité selon le mode.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { AuthRegisterConfig } from "../../schema";

const register = vi.fn();
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ userApi: { register }, loading: false, me: null, contextId: "682b", contextType: "organizations" }),
}));
let registerConfig: AuthRegisterConfig | undefined;
vi.mock("@/hooks/useSite", () => ({ useSite: () => ({ config: { auth: { register: registerConfig } } }) }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("@/modules/auth/i18n", () => ({}));
// `useT` : clé string rendue telle quelle (interpolation {{field}} résolue), LocalizedString → `.fr`.
vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string | { fr?: string }, _fb?: string, params?: Record<string, unknown>) => {
    if (typeof key !== "string") return key.fr ?? "";
    return params ? key.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k])) : key;
  },
}));
vi.mock("@/lib/siteCostum", () => ({ getSiteCostumContext: () => ({ costumSlug: "sportSanteBienetre", costumId: "682b", costumType: "organizations" }) }));
// `vi.mock` est hissé : le faux `toast` est créé via `vi.hoisted` pour être visible de la factory.
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import RegisterForm from "./RegisterForm";

const FIELDS: NonNullable<AuthRegisterConfig["fields"]> = [
  {
    name: "typepro", label: { fr: "Profession", en: "Profession" }, widget: "select", required: true,
    placeholder: { fr: "Choisir votre profession", en: "Choose" },
    options: [
      { value: "Médecins", label: { fr: "Médecins", en: "Physicians" } },
      { value: "autres", label: { fr: "Autres à préciser", en: "Other" } },
    ],
  },
  {
    name: "othersTypepro", label: { fr: "Précisez votre profession", en: "Specify" }, widget: "text", required: true,
    showIf: { field: "typepro", equals: "autres" },
  },
];

function monter() {
  return render(<MemoryRouter><RegisterForm onSwitchToLogin={() => {}} /></MemoryRouter>);
}

async function remplirStandard(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("Nom complet"), "Jean Test");
  await user.type(screen.getByPlaceholderText("Nom d'utilisateur"), "jeantest");
  await user.type(screen.getByPlaceholderText("Adresse e-mail"), "jean@test.re");
  await user.type(screen.getByPlaceholderText("Mot de passe"), "secret123");
  await user.type(screen.getByPlaceholderText("Confirmer le mot de passe"), "secret123");
}

beforeEach(() => {
  register.mockReset();
  register.mockResolvedValue({ result: true });
  toast.success.mockReset();
  toast.error.mockReset();
});

describe("RegisterForm — champs supplémentaires de la config", () => {
  it("rend le select depuis la config, après les champs standards ; othersTypepro masqué par défaut", () => {
    registerConfig = { mode: "single_step_register", fields: FIELDS };
    monter();
    const select = screen.getByLabelText(/Profession/) as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["", "Médecins", "autres"]);
    expect(screen.queryByLabelText(/Précisez votre profession/)).toBeNull();
    // Ordre : le select vient APRÈS la confirmation du mot de passe.
    const confirm = screen.getByPlaceholderText("Confirmer le mot de passe");
    expect(confirm.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("required : un champ visible vide bloque l'envoi, sans appel à register", async () => {
    registerConfig = { mode: "single_step_register", fields: FIELDS };
    const user = userEvent.setup();
    monter();
    await remplirStandard(user);
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    expect(register).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Erreur", { description: "Le champ « Profession » est requis" });
  });

  it("passe mode + fields à register (valeurs non vides des champs visibles) et dit « connectez-vous » en single_step", async () => {
    registerConfig = { mode: "single_step_register", fields: FIELDS };
    const user = userEvent.setup();
    monter();
    await remplirStandard(user);
    await user.selectOptions(screen.getByLabelText(/Profession/), "autres");
    // showIf : la précision apparaît, et devient exigible.
    await user.type(screen.getByLabelText(/Précisez votre profession/), "Ostéopathe");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith({
      name: "Jean Test", username: "jeantest", email: "jean@test.re", pwd: "secret123",
      costumSlug: "sportSanteBienetre", costumId: "682b", costumType: "organizations",
      mode: "single_step_register",
      fields: { typepro: "autres", othersTypepro: "Ostéopathe" },
    });
    expect(toast.success).toHaveBeenCalledWith("Succès", {
      description: "Votre compte a été créé avec succès ! Vous pouvez maintenant vous connecter.",
    });
  });

  it("mode normal (défaut) : ni mode ni fields vides dans l'appel, et le toast annonce la validation de l'e-mail", async () => {
    registerConfig = undefined;
    const user = userEvent.setup();
    monter();
    await remplirStandard(user);
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    const appel = register.mock.calls[0][0] as Record<string, unknown>;
    expect(appel).not.toHaveProperty("mode");
    expect(appel).not.toHaveProperty("fields");
    expect(toast.success).toHaveBeenCalledWith("Succès", {
      description: expect.stringContaining("validé votre adresse e-mail") as unknown as string,
    });
  });

  it("un refus serveur (champ hors règle costum) est affiché tel quel", async () => {
    registerConfig = { fields: FIELDS };
    // Contrat RÉEL de la lib : UserApi.register LÈVE ApiResponseError(msg) dès que result===false — elle ne
    // renvoie jamais {result:false}. On reproduit cette forme (la classe n'est pas exportée à la racine).
    const refus = Object.assign(new Error("Contenu Invalide typepro : Person"), {
      name: "ApiResponseError", status: 200, data: { result: false, msg: "Contenu Invalide typepro : Person" },
    });
    register.mockRejectedValue(refus);
    const user = userEvent.setup();
    monter();
    await remplirStandard(user);
    await user.selectOptions(screen.getByLabelText(/Profession/), "Médecins");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erreur", { description: "Contenu Invalide typepro : Person" }));
    expect(toast.success).not.toHaveBeenCalled();
  });
});
