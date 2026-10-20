// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import type { SearchEntity } from "@communecter/cocolight-api-client";

/**
 * Relais `onEdited` : une correction enregistrée depuis le détail `coform-answer` doit prévenir
 * l'HÔTE (la table admin y invalide ses clés `admin-*`), puis fermer le détail. La prop traverse
 * quatre composants (SwitchDetailsMode → conteneur → Preview → PreviewCoformAnswer) ; optionnelle,
 * elle peut tomber à n'importe quel maillon sans erreur de compilation — d'où ce test de la VRAIE
 * chaîne, dans les deux conteneurs. Seuls le réseau et la modale CoForm sont doublés.
 */
const ctx = vi.hoisted(() => ({ calls: [] as string[] }));

vi.mock("@/modules/search/i18n", () => ({}));
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => undefined }));
// Super-admin : le bouton « Modifier » du détail lui est proposé (règle `isCoformAnswerManager` réelle).
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ entity: null, me: { id: "u1", isSuperAdmin: () => true } }),
}));
// Réponse fraîche déjà chargée : le formulaire s'ouvre sans attendre le réseau.
vi.mock("@/modules/coform/hooks/useCoFormQuery", () => ({
  useCoFormAnswerQuery: () => ({ answerData: { step1: { champ: "valeur" } }, isLoading: false, error: null }),
}));
// Modale CoForm : « enregistrer » rejoue `CoFormModal.handleAfterSubmit` (onAfterSubmit attendu).
vi.mock("@/modules/coform/components/CoFormModal", () => ({
  default: ({ onAfterSubmit }: { onAfterSubmit?: () => void | Promise<void> }) => (
    <button type="button" onClick={() => void onAfterSubmit?.()}>enregistrer la réponse</button>
  ),
}));
// Tiroir réduit à son contenu : on teste le relais de DetailsModeDrawer, pas l'animation du tiroir.
vi.mock("@/components/layout/CustomDrawer", () => ({
  default: ({ isOpenDrawer, children }: { isOpenDrawer: boolean; children: ReactNode }) => (isOpenDrawer ? <div>{children}</div> : null),
}));

import { SwitchDetailsMode } from "./SwitchDetailsMode";

const item = {
  id: "answer1",
  serverData: { form: "6a85af345d898a57cb49f029", name: "Marche nordique" },
} as unknown as SearchEntity;

// Conteneurs et contenu sont chargés en `lazy()` : leur PREMIÈRE transformation, sous la charge de la
// suite complète, dépassait le délai d'un test. Chargés une fois ici, `lazy()` les résout ensuite du cache.
beforeAll(async () => {
  await Promise.all([
    import("./detailsMode/DetailsModeDialog"),
    import("./detailsMode/DetailsModeDrawer"),
    import("./preview/PreviewCoformAnswer"),
  ]);
}, 60_000);

beforeEach(() => {
  ctx.calls = [];
});

/** Conteneur ET contenu sont chargés en `lazy()` : la première résolution dépasse la seconde par défaut. */
const LAZY = { timeout: 5000 };

/** Le vrai détail invalide ses propres caches (listes search, réponse coform) : un client est requis. */
function renderWithClient(ui: ReactElement) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
}

describe("SwitchDetailsMode — relais `onEdited` jusqu'à PreviewCoformAnswer", () => {
  for (const detailsMode of ["dialog", "drawer"] as const) {
    it(`conteneur ${detailsMode} : une correction enregistrée prévient l'hôte, PUIS ferme le détail`, async () => {
      const { findByRole, findByText } = renderWithClient(
        <SwitchDetailsMode
          openDetails
          setOpenDetails={(open) => ctx.calls.push(`setOpenDetails(${open})`)}
          onEdited={() => ctx.calls.push("onEdited")}
          item={item}
          card={{ detailsMode }}
          preview={{ type: "coform-answer", editButton: true }}
        />,
      );
      fireEvent.click(await findByRole("button", { name: /coformAnswer\.edit/ }, LAZY));
      fireEvent.click(await findByText("enregistrer la réponse", {}, LAZY));
      // L'hôte invalide AVANT la fermeture : fermer d'abord démonterait le détail et son rappel.
      expect(ctx.calls).toEqual(["onEdited", "setOpenDetails(false)"]);
    });
  }

  it("ouvrir puis fermer sans enregistrer ne prévient pas l'hôte", async () => {
    const { findByRole } = renderWithClient(
      <SwitchDetailsMode
        openDetails
        setOpenDetails={(open) => ctx.calls.push(`setOpenDetails(${open})`)}
        onEdited={() => ctx.calls.push("onEdited")}
        item={item}
        card={{ detailsMode: "dialog" }}
        preview={{ type: "coform-answer", editButton: true }}
      />,
    );
    await findByRole("button", { name: /coformAnswer\.edit/ }, LAZY);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(ctx.calls).toEqual(["setOpenDetails(false)"]); // fermé, et l'hôte n'a rien à invalider
  });
});
