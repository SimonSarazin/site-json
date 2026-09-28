import { Suspense } from "react";
import { lazy } from "vite-preload";
import { PreviewProps } from "../../schema";

const PreviewResourceCard = lazy(() => import("./resource/PreviewResourceCard"));

/** Coque « resource » (preview) — dispatch sur le DESIGN (`resource.design`). Partage le contrat de la card.
 *  `document` retombe sur la preview `card`, qu'il n'ouvre que pour une fiche sans fichier ni lien ;
 *  `portrait` n'ouvre jamais de preview (toute la fiche est sur la carte). */
export default function PreviewResource({ item, list, onClose }: PreviewProps) {
  const resource = list?.resource;
  switch (resource?.design ?? "card") {
    case "card":
    default:
      return (
        <Suspense fallback={null}>
          <PreviewResourceCard item={item} list={list} onClose={onClose} />
        </Suspense>
      );
  }
}
