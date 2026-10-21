// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { ReportCommentDialog } from "./ReportCommentDialog";
import "../i18n";

/**
 * Le dialogue de signalement ne se vide plus à l'envoi (revue du 29/09) : il se fermait et se
 * vidait AVANT la réponse du serveur, si bien qu'un refus obligeait à tout ressaisir. C'est le fil
 * qui le ferme, au succès seulement — et le démontage le vide.
 */

// Le `Select` de Radix s'appuie sur des API que jsdom n'a pas : pointeur et défilement.
const manquantes = ["hasPointerCapture", "releasePointerCapture", "scrollIntoView"] as const;
beforeAll(() => {
  for (const nom of manquantes) {
    (Element.prototype as unknown as Record<string, unknown>)[nom] ??= () => false;
  }
});
afterAll(() => {
  for (const nom of manquantes) delete (Element.prototype as unknown as Record<string, unknown>)[nom];
});

describe("ReportCommentDialog", () => {
  it("garde le motif et le détail après l'envoi — un refus ne les efface plus", async () => {
    const onSubmit = vi.fn();
    render(createElement(LocalizationProvider, null,
      createElement(ReportCommentDialog, { open: true, onOpenChange: () => {}, onSubmit })));
    const user = userEvent.setup();

    await user.click(screen.getByRole("combobox"));
    const options = await screen.findAllByRole("option");
    await user.click(options[0]!);
    await user.type(screen.getByRole("textbox"), "propos injurieux");
    await user.click(screen.getByRole("button", { name: "Envoyer le signalement" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![1]).toBe("propos injurieux");
    // Toujours là : si le serveur refuse, on renvoie sans rien ressaisir.
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("propos injurieux");
    expect(screen.getByRole("combobox").textContent).not.toBe("");
  });
});
