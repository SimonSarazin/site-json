import { lazy, Suspense } from "react";
import { PreviewProps } from "../../schema";

const PreviewResourceCard = lazy(() => import("./resource/PreviewResourceCard"));

/** Coque « resource » (preview) — dispatch sur le DESIGN (`resource.design`). Partage le contrat de la card. */
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
