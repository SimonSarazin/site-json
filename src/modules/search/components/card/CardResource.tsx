import { Suspense } from "react";
import { lazy } from "vite-preload";
import { SearchCardProps } from "../../schema";

const CardResourceCard = lazy(() => import("./resource/CardResourceCard"));
const CardResourceDocument = lazy(() => import("./resource/CardResourceDocument"));
const CardResourcePortrait = lazy(() => import("./resource/CardResourcePortrait"));

/**
 * Coque « resource » (card) — dispatch sur le DESIGN (`resource.design`) : `card` (image-first),
 * `document` (ligne compacte qui ouvre le fichier) et `portrait` (une personne présentée en entier,
 * carte non cliquable). Données via `useResourceData` (config-driven).
 */
export default function CardResource({ item, onClick, list }: SearchCardProps) {
  const resource = list?.resource;
  switch (resource?.design ?? "card") {
    case "document":
      return (
        <Suspense fallback={null}>
          <CardResourceDocument item={item} onClick={onClick} list={list} />
        </Suspense>
      );
    case "portrait":
      return (
        <Suspense fallback={null}>
          <CardResourcePortrait item={item} onClick={onClick} list={list} />
        </Suspense>
      );
    case "card":
    default:
      return (
        <Suspense fallback={null}>
          <CardResourceCard item={item} onClick={onClick} list={list} />
        </Suspense>
      );
  }
}
