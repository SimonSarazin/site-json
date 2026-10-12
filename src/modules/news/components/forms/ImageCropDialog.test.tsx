// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageCropDialog } from "./ImageCropDialog";

vi.mock("@/hooks/useT", () => ({ useT: () => (k: string) => k }));

// Le vrai Cropper a besoin d'un rendu d'image réel : on n'en garde que le ratio reçu.
vi.mock("react-easy-crop", () => ({
  default: ({
    aspect,
    onMediaLoaded,
  }: {
    aspect: number;
    onMediaLoaded?: (m: { naturalWidth: number; naturalHeight: number }) => void;
  }) => (
    <div data-testid="cropper" data-aspect={String(aspect)}>
      <button type="button" onClick={() => onMediaLoaded?.({ naturalWidth: 400, naturalHeight: 800 })}>
        photo portrait chargée
      </button>
    </div>
  ),
}));

// jsdom n'a pas de ResizeObserver, requis par le Slider Radix du dialogue.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const base = { imageUrl: "data:image/png;base64,x", open: true, onOpenChange: () => {}, onCrop: () => {} };

describe("ImageCropDialog — sélecteur de format", () => {
  it("sans `aspectOptions` : aucun sélecteur, ratio fixe `aspect` (comportement des actus inchangé)", () => {
    render(<ImageCropDialog {...base} aspect={16 / 9} />);
    expect(screen.queryByRole("group", { name: "forms.imageCrop.format" })).toBeNull();
    expect(screen.getByTestId("cropper").dataset.aspect).toBe(String(16 / 9));
  });

  it("avec `aspectOptions` : la première option est active, en changer change le ratio du cadre", async () => {
    render(
      <ImageCropDialog
        {...base}
        aspect={16 / 9}
        aspectOptions={[
          { label: "3:1", value: 3 },
          { label: "Carré", value: 1 },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: "forms.imageCrop.format" })).toBeTruthy();
    expect(screen.getByTestId("cropper").dataset.aspect).toBe("3");
    await userEvent.click(screen.getByRole("radio", { name: "Carré" }));
    expect(screen.getByTestId("cropper").dataset.aspect).toBe("1");
  });

  it("`original` sans photo chargée retombe sur `aspect`", () => {
    render(<ImageCropDialog {...base} aspect={16 / 9} aspectOptions={[{ label: "Original", value: "original" }]} />);
    expect(screen.getByTestId("cropper").dataset.aspect).toBe(String(16 / 9));
  });

  it("« Utiliser l'image entière » ferme le dialogue dès le clic : pas de second envoi possible", async () => {
    const onUseOriginal = vi.fn();
    const onOpenChange = vi.fn();
    render(<ImageCropDialog {...base} onOpenChange={onOpenChange} onUseOriginal={onUseOriginal} />);
    await userEvent.click(screen.getByRole("button", { name: "forms.imageCrop.useOriginal" }));
    expect(onUseOriginal).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  describe("nouvelle photo ou réouverture : rien n'est gardé de la photo précédente", () => {
    const formats = [
      { label: "Original", value: "original" as const },
      { label: "Carré", value: 1 },
    ];

    it("nouvelle `imageUrl` : ratio de la photo précédente oublié, retour à « Original »", async () => {
      const { rerender } = render(<ImageCropDialog {...base} aspect={16 / 9} aspectOptions={formats} />);
      await userEvent.click(screen.getByText("photo portrait chargée"));
      expect(screen.getByTestId("cropper").dataset.aspect).toBe("0.5");
      await userEvent.click(screen.getByRole("radio", { name: "Carré" }));
      rerender(<ImageCropDialog {...base} imageUrl="data:image/png;base64,y" aspect={16 / 9} aspectOptions={formats} />);
      expect(screen.getByTestId("cropper").dataset.aspect).toBe(String(16 / 9));
      expect(screen.getByRole("radio", { name: "Original" }).getAttribute("aria-checked")).toBe("true");
    });

    it("réouverture sur la même photo : format remis à « Original »", async () => {
      const { rerender } = render(<ImageCropDialog {...base} aspect={16 / 9} aspectOptions={formats} />);
      await userEvent.click(screen.getByRole("radio", { name: "Carré" }));
      rerender(<ImageCropDialog {...base} open={false} aspect={16 / 9} aspectOptions={formats} />);
      rerender(<ImageCropDialog {...base} aspect={16 / 9} aspectOptions={formats} />);
      expect(screen.getByTestId("cropper").dataset.aspect).toBe(String(16 / 9));
    });
  });
});
