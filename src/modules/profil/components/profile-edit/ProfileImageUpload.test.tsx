// @vitest-environment jsdom
/**
 * Envoi de la bannière et de la photo de profil. Ce qui est protégé : le recadrage propose un choix de
 * format (photo d'origine en premier) et « Utiliser l'image entière » envoie le fichier D'ORIGINE —
 * pour la bannière, avec une zone de recadrage couvrant toute la photo (le backend en tire sa copie
 * `profilBannerUrl` à la même taille). Un recadrage, lui, envoie l'image recadrée et ses dimensions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { EntityTypes } from "@communecter/cocolight-api-client";

const state = vi.hoisted(() => ({
  uploadImage: vi.fn().mockResolvedValue(undefined),
  uploadBanner: vi.fn().mockResolvedValue(undefined),
  formats: [] as string[],
}));

vi.mock("@/hooks/useT", () => ({ useT: () => (k: string) => k }));
vi.mock("@/components/ui/OptimizedImage", () => ({ OptimizedImage: () => null }));
vi.mock("../../hooks/useProfileMutations", () => ({
  useUploadProfileImage: () => ({ mutateAsync: state.uploadImage, isPending: false }),
  useUploadProfileBanner: () => ({ mutateAsync: state.uploadBanner, isPending: false }),
}));
vi.mock("../../lib/imageNaturalSize", () => ({
  imageNaturalSize: vi.fn().mockResolvedValue({ width: 1200, height: 400 }),
}));
// Le vrai dialogue monte un recadreur canvas : on n'en garde que ses commandes et les formats reçus.
vi.mock("@/modules/news", () => ({
  ImageCropDialog: ({
    open,
    onCrop,
    onUseOriginal,
    aspectOptions,
  }: {
    open: boolean;
    onCrop: (blob: Blob, area: { x: number; y: number; width: number; height: number }) => void;
    onUseOriginal?: () => void;
    aspectOptions?: { label: string }[];
  }) => {
    state.formats = (aspectOptions ?? []).map((o) => o.label);
    return open ? (
      <div>
        <button type="button" onClick={() => onCrop(new Blob(["x"], { type: "image/jpeg" }), { x: 5, y: 5, width: 300, height: 100 })}>
          appliquer
        </button>
        {onUseOriginal && (
          <button type="button" onClick={onUseOriginal}>
            image entière
          </button>
        )}
      </div>
    ) : null;
  },
}));

import { ProfileImageUpload } from "./ProfileImageUpload";

const entity = {} as EntityTypes;
const photo = new File(["photo"], "photo.png", { type: "image/png" });

async function choisirPhoto(type: "profile" | "banner") {
  const { container } = render(<ProfileImageUpload entity={entity} type={type} />);
  fireEvent.change(container.querySelector("input[type=file]")!, { target: { files: [photo] } });
  await screen.findByText("appliquer");
}

describe("ProfileImageUpload — envoi de la bannière et de la photo de profil", () => {
  beforeEach(() => {
    state.uploadImage.mockClear();
    state.uploadBanner.mockClear();
  });

  it("propose les formats, la photo d'origine en premier, pour les deux types", async () => {
    await choisirPhoto("profile");
    expect(state.formats[0]).toBe("ProfileEdit.imageFormat.original");
    expect(state.formats).toHaveLength(5);
  });

  it("bannière, image entière : fichier d'origine et zone de recadrage = toute la photo", async () => {
    await choisirPhoto("banner");
    fireEvent.click(screen.getByText("image entière"));
    await waitFor(() => expect(state.uploadBanner).toHaveBeenCalled());
    expect(state.uploadBanner).toHaveBeenCalledWith({ file: photo, cropX: 0, cropY: 0, cropW: 1200, cropH: 400 });
  });

  it("photo de profil, image entière : le fichier d'origine part tel quel", async () => {
    await choisirPhoto("profile");
    fireEvent.click(screen.getByText("image entière"));
    await waitFor(() => expect(state.uploadImage).toHaveBeenCalledWith(photo));
  });

  it("bannière recadrée : l'image recadrée et ses dimensions, sans décalage", async () => {
    await choisirPhoto("banner");
    fireEvent.click(screen.getByText("appliquer"));
    await waitFor(() => expect(state.uploadBanner).toHaveBeenCalled());
    const envoi = state.uploadBanner.mock.calls[0][0];
    expect(envoi.file).not.toBe(photo);
    expect(envoi).toMatchObject({ cropX: 0, cropY: 0, cropW: 300, cropH: 100 });
  });
});
