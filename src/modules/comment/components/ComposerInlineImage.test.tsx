// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { getBaseUrl } from "@/lib/constant/common";
import { ComposerInlineImage, type ComposerInlineImageProps } from "./ComposerInlineImage";
import "../i18n";

/**
 * Le bouton « Image » du composer : une image DANS le texte (décision de l'user, 14/10/2026), par
 * un fichier importé ou par l'adresse d'une image en ligne, avec une description exigée.
 *
 * Le téléversement est la frontière (`onUpload`, branché sur le SDK par `useInlineImageUpload`) :
 * sa doublure rend une adresse, ou LÈVE, comme lui.
 */

const PNG = (nom = "chat.png", taille = 10) => new File([new Uint8Array(taille)], nom, { type: "image/png" });

function monter(props: Partial<ComposerInlineImageProps> = {}) {
  const onInsert = vi.fn();
  const onClosed = vi.fn();
  render(
    <LocalizationProvider>
      <ComposerInlineImage onInsert={onInsert} onClosed={onClosed} {...props} />
    </LocalizationProvider>,
  );
  return { onInsert, onClosed };
}

const ouvrir = () => userEvent.click(screen.getByRole("button", { name: "Insérer une image dans le texte" }));
const champFichier = () => document.querySelector<HTMLInputElement>("[data-inline-image] input[type=file]")!;
const inserer = () => screen.getByRole("button", { name: "Insérer" });
const description = () => screen.getByLabelText("Description");
const statut = () => screen.getByRole("status");

/** Une promesse qu'on résout ou rejette à la main : l'ordre des réponses se règle dans le test. */
function differee() {
  let resoudre!: (valeur: string) => void;
  let rejeter!: (erreur: Error) => void;
  const promesse = new Promise<string>((ok, ko) => { resoudre = ok; rejeter = ko; });
  return { promesse, resoudre, rejeter };
}

describe("ComposerInlineImage — importer", () => {
  it("le fichier choisi part, sa description est proposée, « Insérer » pose l'adresse rendue", async () => {
    const onUpload = vi.fn(async () => "/upload/communecter/comments/u/chat.png");
    const { onInsert, onClosed } = monter({ onUpload });
    await ouvrir();
    await userEvent.upload(champFichier(), PNG());
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(statut().textContent).toContain("chat.png");
    expect(description()).toHaveProperty("value", "chat");
    await userEvent.click(inserer());
    expect(onInsert).toHaveBeenCalledWith({ src: "/upload/communecter/comments/u/chat.png", alt: "chat" });
    // Refermée, la fenêtre rend la main au texte.
    expect(onClosed).toHaveBeenCalled();
    expect(document.querySelector("[data-inline-image]")).toBeNull();
  });

  it("pendant l'envoi, « Insérer » attend", async () => {
    const envoi = differee();
    monter({ onUpload: () => envoi.promesse });
    await ouvrir();
    await userEvent.upload(champFichier(), PNG());
    expect(statut().textContent).toMatch(/Envoi de chat\.png/);
    expect(inserer()).toHaveProperty("disabled", true);
    await act(async () => { envoi.resoudre("/upload/a.png"); });
    expect(inserer()).toHaveProperty("disabled", false);
  });

  it("une description déjà écrite n'est pas remplacée par le nom du fichier", async () => {
    monter({ onUpload: async () => "/upload/a.png" });
    await ouvrir();
    await userEvent.type(description(), "Le chat de la voisine");
    await userEvent.upload(champFichier(), PNG());
    expect(description()).toHaveProperty("value", "Le chat de la voisine");
  });

  it("refusés AVANT l'envoi : un type que le SDK n'accepte pas, une image de plus de 8 Mo", async () => {
    const onUpload = vi.fn(async () => "/upload/a.png");
    monter({ onUpload });
    await ouvrir();
    fireEvent.change(champFichier(), { target: { files: [new File(["x"], "anim.gif", { type: "image/gif" })] } });
    expect(statut().textContent).toBe("Seuls les fichiers JPEG et PNG sont acceptés.");
    fireEvent.change(champFichier(), { target: { files: [PNG("grande.png", 8 * 1024 * 1024 + 1)] } });
    expect(statut().textContent).toBe("Une image ne doit pas dépasser 8 Mo.");
    expect(onUpload).not.toHaveBeenCalled();
    expect(inserer()).toHaveProperty("disabled", true);
  });

  it("un refus du serveur se dit, et rien ne s'insère", async () => {
    const onInsert = vi.fn();
    render(
      <LocalizationProvider>
        <ComposerInlineImage onUpload={async () => { throw new Error("500"); }} onInsert={onInsert} onClosed={() => {}} />
      </LocalizationProvider>,
    );
    await ouvrir();
    await userEvent.upload(champFichier(), PNG());
    expect(statut().textContent).toBe("L'image n'a pas pu être envoyée. Réessayez.");
    expect(inserer()).toHaveProperty("disabled", true);
  });

  it("la réponse d'un envoi DÉPASSÉ est ignorée — un autre fichier a été choisi", async () => {
    const premier = differee();
    const second = differee();
    const reponses = [premier.promesse, second.promesse];
    const onInsert = vi.fn();
    render(
      <LocalizationProvider>
        <ComposerInlineImage onUpload={() => reponses.shift()!} onInsert={onInsert} onClosed={() => {}} />
      </LocalizationProvider>,
    );
    await ouvrir();
    await userEvent.upload(champFichier(), PNG("a.png"));
    await userEvent.upload(champFichier(), PNG("b.png"));
    await act(async () => { second.resoudre("/upload/b.png"); });
    await act(async () => { premier.resoudre("/upload/a.png"); });
    await userEvent.click(inserer());
    expect(onInsert).toHaveBeenCalledWith({ src: "/upload/b.png", alt: "a" });
  });

  it("refermée pendant l'envoi, la fenêtre se rouvre vierge, et la réponse tardive n'y entre pas", async () => {
    const envoi = differee();
    monter({ onUpload: () => envoi.promesse });
    await ouvrir();
    await userEvent.upload(champFichier(), PNG());
    await userEvent.keyboard("{Escape}");
    await ouvrir();
    await act(async () => { envoi.resoudre("/upload/a.png"); });
    expect(description()).toHaveProperty("value", "");
    expect(statut().textContent).toBe("JPEG ou PNG, 8 Mo au plus.");
  });
});

describe("ComposerInlineImage — adresse", () => {
  it("une image d'un autre site : l'auteur sait que les lecteurs l'afficheront d'un clic", async () => {
    const { onInsert } = monter({ onUpload: async () => "" });
    await ouvrir();
    await userEvent.click(screen.getByRole("tab", { name: "Adresse" }));
    await userEvent.type(screen.getByLabelText("Adresse de l'image"), "https://images.example.org/chat.jpg");
    expect(screen.getByText("Elle vient d'un autre site : les lecteurs l'afficheront d'un clic.")).toBeTruthy();
    // La description est exigée, comme dans le legacy.
    expect(inserer()).toHaveProperty("disabled", true);
    await userEvent.type(description(), "  Un chat {Enter}");
    expect(onInsert).toHaveBeenCalledWith({ src: "https://images.example.org/chat.jpg", alt: "Un chat" });
  });

  it("une adresse du serveur n'est pas annoncée comme tierce", async () => {
    monter();
    await ouvrir();
    await userEvent.type(screen.getByLabelText("Adresse de l'image"), new URL("/upload/a.png", getBaseUrl()).href);
    expect(screen.queryByText("Elle vient d'un autre site : les lecteurs l'afficheront d'un clic.")).toBeNull();
  });

  it("refusées : un chemin, `javascript:`, `data:` — il faut l'adresse complète d'une image en ligne", async () => {
    monter();
    await ouvrir();
    const champ = screen.getByLabelText("Adresse de l'image");
    await userEvent.type(description(), "x");
    for (const adresse of ["chat.png", "javascript:alert(1)", "data:image/png;base64,AAAA"]) {
      await userEvent.clear(champ);
      await userEvent.type(champ, adresse);
      expect(screen.getByText("Donnez l'adresse complète d'une image en ligne (https://…).")).toBeTruthy();
      expect(champ.getAttribute("aria-invalid")).toBe("true");
      expect(inserer()).toHaveProperty("disabled", true);
    }
  });

  it("sans téléversement possible, seule l'adresse se propose — pas d'onglets", async () => {
    monter();
    await ouvrir();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getByLabelText("Adresse de l'image")).toBeTruthy();
  });

  it("désactivé, le bouton n'ouvre rien", async () => {
    monter({ disabled: true });
    expect(screen.getByRole("button", { name: "Insérer une image dans le texte" })).toHaveProperty("disabled", true);
  });
});
