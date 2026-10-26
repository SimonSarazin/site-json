// @vitest-environment jsdom
/**
 * Double authentification dans LoginForm (cocolight-backend docs/34-2FA-LOT1.md) : quand `login`
 * lève `TwoFactorRequiredError`, le formulaire laisse place à l'étape « code » ; `verifyTwoFactor`
 * termine la connexion (userLoggedIn émis, onSuccess) ; les refus serveur sont rendus lisibles ;
 * `challengeExpired` ramène au mot de passe ; le renvoi respecte le compte à rebours.
 * Un compte libre (login résolu) ne voit jamais l'étape.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import cocolightApiClient from "@communecter/cocolight-api-client";

const { TwoFactorRequiredError, ApiResponseError } = cocolightApiClient.error;

// jsdom n'a pas ResizeObserver, que la Checkbox Radix du formulaire observe au montage.
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver ??= ResizeObserverStub;
const CHALLENGE = "0123456789abcdef0123456789abcdef";

const login = vi.fn();
const verifyTwoFactor = vi.fn();
const resendTwoFactor = vi.fn();
const emit = vi.fn();
const userApi = { login, verifyTwoFactor, resendTwoFactor, isConnected: false };
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ userApi, apiClient: { emit }, loading: false, me: null, entity: null }),
}));
// Erreur « serveur injoignable » de la lib (réseau, breaker) : PAS une ApiResponseError.
const { ApiClientError } = cocolightApiClient.error;
vi.mock("@/hooks/useSite", () => ({ useSite: () => ({ config: { auth: {} } }) }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("@/modules/auth/i18n", () => ({}));
vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string | { fr?: string }, _fb?: string, params?: Record<string, unknown>) => {
    if (typeof key !== "string") return key.fr ?? "";
    return params ? key.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k])) : key;
  },
}));
vi.mock("../../hooks/useSSOAuth", () => ({ useSSOAuth: () => ({ openSSOPopup: vi.fn() }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import LoginForm from "./LoginForm";

const onSuccess = vi.fn();
function monter() {
  return render(<MemoryRouter><LoginForm onSuccess={onSuccess} hideBackButton /></MemoryRouter>);
}

async function seConnecter(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("Adresse e-mail"), "jean@test.re");
  await user.type(screen.getByPlaceholderText("Mot de passe"), "secret123");
  await user.click(screen.getByRole("button", { name: "Se connecter" }));
}

// Défi NEUF : expire dans 300 s (le formulaire en déduit « renvoi possible dans 60 s »).
const defi = (ttlSeconds = 300) => new TwoFactorRequiredError({ challenge: CHALLENGE, method: "email", sentTo: "j***@test.re", expireAt: Math.floor(Date.now() / 1000) + ttlSeconds });

beforeEach(() => {
  login.mockReset();
  verifyTwoFactor.mockReset();
  resendTwoFactor.mockReset();
  emit.mockReset();
  onSuccess.mockReset();
  toast.error.mockReset();
  userApi.isConnected = false;
});
afterEach(() => { vi.useRealTimers(); });

describe("LoginForm — double authentification", () => {
  it("compte libre : login résolu → connecté, aucune étape code", async () => {
    const user = userEvent.setup();
    login.mockImplementation(async () => { userApi.isConnected = true; return {}; });
    monter();
    await seConnecter(user);
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    // userLoggedIn est émis par les postActions du contrat (dans la lib), jamais par le formulaire.
    expect(emit).not.toHaveBeenCalled();
    expect(screen.queryByTestId("two-factor-step")).toBeNull();
    expect(verifyTwoFactor).not.toHaveBeenCalled();
  });

  it("compte libre, mauvais mot de passe (ApiResponseError 401 de la lib 1.0.204) : toast « Email ou mot de passe incorrect »", async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new ApiResponseError("L'email ou le mot de passe est incorrect.", 401, { error: "L'email ou le mot de passe est incorrect." }));
    monter();
    await seConnecter(user);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erreur", { description: "Email ou mot de passe incorrect" }));
    expect(screen.queryByTestId("two-factor-step")).toBeNull();
  });

  it("TwoFactorRequiredError → étape code avec l'adresse masquée, sans toast ; le bon code connecte", async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(defi());
    verifyTwoFactor.mockImplementation(async () => { userApi.isConnected = true; return {}; });
    monter();
    await seConnecter(user);

    const step = await screen.findByTestId("two-factor-step");
    expect(step.textContent).toContain("j***@test.re");
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText("Mot de passe")).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();

    const input = screen.getByLabelText("Code de vérification") as HTMLInputElement;
    expect(input.getAttribute("autocomplete")).toBe("one-time-code");
    const valider = screen.getByRole("button", { name: "Valider le code" });
    expect(valider).toBeDisabled(); // 6 chiffres exigés avant tout envoi
    await user.type(input, "12ab34");
    expect(input.value).toBe("1234"); // seuls les chiffres sont gardés
    await user.type(input, "56");
    expect(valider).toBeEnabled();
    await user.click(valider);

    await waitFor(() => expect(verifyTwoFactor).toHaveBeenCalledWith(CHALLENGE, "123456"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(emit).not.toHaveBeenCalled();
    expect(screen.queryByTestId("two-factor-step")).toBeNull();
  });

  it("collage d'un code avec espaces (« 123 456 ») : seuls les 6 chiffres sont gardés", async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(defi());
    monter();
    await seConnecter(user);
    const input = (await screen.findByLabelText("Code de vérification")) as HTMLInputElement;
    await user.click(input);
    await user.paste("123 456");
    expect(input.value).toBe("123456");
    expect(screen.getByRole("button", { name: "Valider le code" })).toBeEnabled();
  });

  it("erreur réseau pendant la vérification : le défi est CONSERVÉ, message en place, pas de retour au mot de passe", async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(defi());
    verifyTwoFactor.mockRejectedValueOnce(new ApiClientError("Erreur lors de l'appel de l'API : Network Error", 500));
    monter();
    await seConnecter(user);
    await user.type(await screen.findByLabelText("Code de vérification"), "123456");
    await user.click(screen.getByRole("button", { name: "Valider le code" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Impossible de se connecter pour le moment");
    expect(screen.getByTestId("two-factor-step")).toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();
    // le code saisi est encore là : l'utilisateur réessaie sans rien retaper
    expect((screen.getByLabelText("Code de vérification") as HTMLInputElement).value).toBe("123456");
  });

  it("codeInvalid{attemptsLeft} : message en place, on reste sur l'étape ; challengeExpired : retour au mot de passe + toast", async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(defi());
    verifyTwoFactor.mockRejectedValueOnce(new ApiResponseError("codeInvalid", 401, { error: "codeInvalid", attemptsLeft: 3 }));
    monter();
    await seConnecter(user);
    const input = await screen.findByLabelText("Code de vérification");
    await user.type(input, "000000");
    await user.click(screen.getByRole("button", { name: "Valider le code" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Code incorrect, il vous reste 3 essai(s)");
    expect(screen.getByTestId("two-factor-step")).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled();

    verifyTwoFactor.mockRejectedValueOnce(new ApiResponseError("challengeExpired", 401, { error: "challengeExpired" }));
    await user.click(screen.getByRole("button", { name: "Valider le code" }));
    await waitFor(() => expect(screen.queryByTestId("two-factor-step")).toBeNull());
    expect(screen.getByPlaceholderText("Mot de passe")).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith("Erreur", { description: "Ce code n'est plus valable, reconnectez-vous" });
  });

  it("renvoi : verrouillé 60 s, puis nouveau code ; resendTooSoon{retryIn} resynchronise le compte à rebours ; resendLimit informe sans toucher au défi", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    login.mockRejectedValue(defi());
    monter();
    await seConnecter(user);
    await screen.findByTestId("two-factor-step");
    const renvoyer = () => screen.getByRole("button", { name: /Renvoyer le code/ });
    expect(renvoyer()).toBeDisabled();
    expect(renvoyer().textContent).toMatch(/\(\d+ s\)/);
    expect(resendTwoFactor).not.toHaveBeenCalled();

    // 61 s plus tard : renvoi possible → nouveau code, verrou remis à 60 s
    await act(async () => { await vi.advanceTimersByTimeAsync(61_000); });
    expect(renvoyer()).toBeEnabled();
    resendTwoFactor.mockResolvedValueOnce({ result: true, expireAt: 0 });
    await user.click(renvoyer());
    await waitFor(() => expect(resendTwoFactor).toHaveBeenCalledWith(CHALLENGE));
    expect(await screen.findByRole("status")).toHaveTextContent("Un nouveau code vient d'être envoyé");
    expect(renvoyer()).toBeDisabled();

    // le serveur dit « trop tôt, 7 s » : le compte à rebours repart de 7, pas de 60
    await act(async () => { await vi.advanceTimersByTimeAsync(61_000); });
    resendTwoFactor.mockRejectedValueOnce(new ApiResponseError("resendTooSoon", 429, { error: "resendTooSoon", retryIn: 7 }));
    await user.click(renvoyer());
    expect(await screen.findByRole("status")).toHaveTextContent("Patientez encore 7 s avant de renvoyer un code");
    expect(renvoyer().textContent).toMatch(/\(7 s\)/);
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });
    expect(renvoyer()).toBeEnabled();

    // plus de renvoi possible : information, l'étape reste
    resendTwoFactor.mockRejectedValueOnce(new ApiResponseError("resendLimit", 429, { error: "resendLimit" }));
    await user.click(renvoyer());
    expect(await screen.findByRole("status")).toHaveTextContent("Plus de renvoi possible, le dernier code reçu reste valable");
    expect(screen.getByTestId("two-factor-step")).toBeTruthy();
    expect(resendTwoFactor).toHaveBeenCalledTimes(3);
  });

  it("défi RÉUTILISÉ (reconnexion < 60 s) : le délai avant renvoi vient d'expireAt, pas d'un 60 s arbitraire", async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(defi(300 - 45)); // code parti il y a 45 s → renvoi dans 15 s
    monter();
    await seConnecter(user);
    await screen.findByTestId("two-factor-step");
    const renvoyer = screen.getByRole("button", { name: /Renvoyer le code/ });
    const m = /\((\d+) s\)/.exec(renvoyer.textContent ?? "");
    expect(Number(m?.[1])).toBeGreaterThan(10);
    expect(Number(m?.[1])).toBeLessThanOrEqual(15);
    expect(screen.getByTestId("two-factor-validity").textContent).toContain("5 min");
  });

  it("défi expiré pendant l'étape : retour au mot de passe avec toast, sans appel serveur", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    login.mockRejectedValue(defi(3));
    monter();
    await seConnecter(user);
    await screen.findByTestId("two-factor-step");
    await act(async () => { await vi.advanceTimersByTimeAsync(4_000); });
    await waitFor(() => expect(screen.queryByTestId("two-factor-step")).toBeNull());
    expect(toast.error).toHaveBeenCalledWith("Erreur", { description: "Ce code n'est plus valable, reconnectez-vous" });
    expect(verifyTwoFactor).not.toHaveBeenCalled();
  });

  it("twoFactorMailFailed / twoFactorTooMany à la première étape : toast dédié, pas d'étape code", async () => {
    const user = userEvent.setup();
    login.mockRejectedValueOnce(new ApiResponseError("twoFactorMailFailed", 503, { error: "twoFactorMailFailed" }));
    monter();
    await seConnecter(user);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erreur", { description: "Le code n'a pas pu être envoyé par e-mail, réessayez plus tard" }));
    expect(screen.queryByTestId("two-factor-step")).toBeNull();

    login.mockRejectedValueOnce(new ApiResponseError("twoFactorTooMany", 429, { error: "twoFactorTooMany", retryIn: 900 }));
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erreur", { description: "Trop de tentatives, réessayez dans 15 min" }));
  });

  it("Retour : revient au formulaire, mot de passe effacé", async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(defi());
    monter();
    await seConnecter(user);
    await screen.findByTestId("two-factor-step");
    await user.click(screen.getByRole("button", { name: "Retour" }));
    expect(screen.queryByTestId("two-factor-step")).toBeNull();
    expect((screen.getByPlaceholderText("Mot de passe") as HTMLInputElement).value).toBe("");
    expect((screen.getByPlaceholderText("Adresse e-mail") as HTMLInputElement).value).toBe("jean@test.re");
  });
});
