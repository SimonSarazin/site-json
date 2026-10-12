// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageCropDialog } from "./ImageCropDialog";

vi.mock("@/hooks/useT", () => ({ useT: () => (k: string) => k }));

// Le vrai Cropper a besoin d'un rendu d'image réel : on n'en garde que le ratio reçu.
vi.mock("react-easy-crop", () => ({
  default: ({ aspect }: { aspect: number }) => <div data-testid="cropper" data-aspect={String(aspect)} />,
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
});
