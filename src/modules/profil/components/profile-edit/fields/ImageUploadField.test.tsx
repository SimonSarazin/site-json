// @vitest-environment jsdom
/**
 * Champ d'upload d'image. Sous `allowOriginal` (opt-in), l'image déposée part ENTIÈRE, sans modale, et
 * « Recadrer » la cadre ensuite — toujours depuis l'original, jamais depuis une version déjà recadrée.
 * Sans l'option, le recadrage reste obligatoire au dépôt, comme sur les sites qui ne l'ont pas demandée.
 */
import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/hooks/useT", () => ({ useT: () => (k: string) => k }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
// La modale réelle monte un recadreur canvas : on la remplace par ses seules commandes, en exposant
// l'image qu'elle a reçue à recadrer.
vi.mock("@/modules/news", () => ({
  ImageCropDialog: ({
    open,
    imageUrl,
    onCrop,
    onUseOriginal,
  }: {
    open: boolean;
    imageUrl: string;
    onCrop: (blob: Blob) => void;
    onUseOriginal?: () => void;
  }) =>
    open ? (
      <div data-testid="modale" data-src={imageUrl}>
        <button type="button" onClick={() => onCrop(new Blob(["recadree"], { type: "image/jpeg" }))}>
          appliquer
        </button>
        {onUseOriginal && (
          <button type="button" onClick={onUseOriginal}>
            image entière
          </button>
        )}
      </div>
    ) : null,
}));

import { ImageUploadField } from "./ImageUploadField";

// « photo » : 5 octets, lu par la modale comme `data:image/png;base64,cGhvdG8=`.
const ORIGINALE = "data:image/png;base64,cGhvdG8=";
const fichier = () => new File(["photo"], "affiche.png", { type: "image/png" });

/** Champ contrôlé, comme dans un formulaire : la valeur transmise revient en `value`. */
function Formulaire({ onChange, allowOriginal }: { onChange: (f: File | null) => void; allowOriginal?: boolean }) {
  const [valeur, setValeur] = useState<File | null>(null);
  return (
    <ImageUploadField
      value={valeur}
      allowOriginal={allowOriginal}
      onChange={(f) => {
        onChange(f);
        setValeur(f);
      }}
    />
  );
}

async function deposer(conteneur: HTMLElement) {
  const input = conteneur.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.upload(input, fichier());
}

const derniereValeur = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as File;

describe("ImageUploadField — `allowOriginal`", () => {
  it("l'image déposée part entière, sans passer par la modale", async () => {
    const onChange = vi.fn();
    const { container } = render(<Formulaire onChange={onChange} allowOriginal />);
    await deposer(container);

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(derniereValeur(onChange).name).toBe("affiche.png");
    expect(derniereValeur(onChange).size).toBe(5);
    expect(screen.queryByTestId("modale")).toBeNull();
  });

  it("« Recadrer » repart de l'original, et « image entière » y revient", async () => {
    const onChange = vi.fn();
    const { container } = render(<Formulaire onChange={onChange} allowOriginal />);
    await deposer(container);

    await userEvent.click(await screen.findByRole("button", { name: /ImageUploadField\.crop/ }));
    expect((await screen.findByTestId("modale")).dataset.src).toBe(ORIGINALE);
    await userEvent.click(screen.getByRole("button", { name: "appliquer" }));
    await waitFor(() => expect(derniereValeur(onChange).size).toBe("recadree".length));

    // Second recadrage : la modale reçoit l'ORIGINAL, pas la version déjà recadrée.
    await userEvent.click(await screen.findByRole("button", { name: /ImageUploadField\.crop/ }));
    expect((await screen.findByTestId("modale")).dataset.src).toBe(ORIGINALE);
    await userEvent.click(screen.getByRole("button", { name: "image entière" }));
    await waitFor(() => expect(derniereValeur(onChange).size).toBe(5));
  });

  it("champ remonté, original perdu : « Recadrer » part de l'image en place, sans « image entière » morte", async () => {
    render(<ImageUploadField value={fichier()} onChange={vi.fn()} allowOriginal />);

    await userEvent.click(screen.getByRole("button", { name: /ImageUploadField\.crop/ }));
    expect((await screen.findByTestId("modale")).dataset.src).toBe(ORIGINALE);
    expect(screen.queryByRole("button", { name: "image entière" })).toBeNull();
  });
});

describe("ImageUploadField — par défaut", () => {
  it("le recadrage reste obligatoire au dépôt : modale ouverte, ni « image entière » ni « Recadrer »", async () => {
    const onChange = vi.fn();
    const { container } = render(<Formulaire onChange={onChange} />);
    await deposer(container);

    await screen.findByTestId("modale");
    expect(screen.queryByRole("button", { name: "image entière" })).toBeNull();
    expect(screen.queryByRole("button", { name: /ImageUploadField\.crop/ })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
