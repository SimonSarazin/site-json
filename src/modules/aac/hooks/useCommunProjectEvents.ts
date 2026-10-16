/**
 * Les événements du PROJET d'un commun — ceux dont il est organisateur ou
 * participant (`project.getEvents`) — en deux flux bornés côté serveur :
 * « à venir » (en cours en tête) et « passés » (du plus récent).
 */
import { useMemo, useState } from "react";
import type { Event } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { useInfiniteQueryScrollNext } from "@/hooks/useInfiniteQueryScroll";
import { AAC_QUERY_KEYS } from "../constants/queryKeys";
import { useCommunProjectEntityQuery } from "./useCommunProjectEntity";

export type CommunEventsBucket = "upcoming" | "past";

export const COMMUN_EVENTS_PAGE_SIZE = 5;

/** Bornes du flux `bucket`, sur le modèle des deux flux de l'agenda. */
export function communEventsBounds(bucket: CommunEventsBucket, now: Date) {
  return bucket === "upcoming"
    ? { from: now.toISOString(), order: "asc" as const }
    : { to: now.toISOString(), order: "desc" as const, recurrency: false };
}

export function useCommunProjectEvents(projectId: string | null | undefined, bucket: CommunEventsBucket) {
  const { me } = useCocolight();
  const { project, isUnresolved: isProjectUnresolved } = useCommunProjectEntityQuery(projectId);
  // Ancre figée au montage : `next()` la rejoue à chaque page.
  const [now] = useState(() => new Date());

  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQueryScrollNext<Event>({
    queryKey: AAC_QUERY_KEYS.COMMUN_EVENTS(project?.id ?? null, bucket, me?.id ?? null),
    queryFn: async () => {
      if (!project) throw new Error("Projet du commun non résolu");
      return project.getEvents({ indexMin: 0, indexStep: COMMUN_EVENTS_PAGE_SIZE, ...communEventsBounds(bucket, now) });
    },
    options: { enabled: !!project, staleTime: 60 * 1000, initialPageParam: undefined },
  });

  const events = useMemo<Event[]>(() => data?.pages?.flatMap((page) => page?.results ?? []) ?? [], [data?.pages]);
  const isProjectPending = !project && !isProjectUnresolved;

  return {
    events,
    now,
    /** Projet en attente, puis événements en vol. */
    isLoading: isProjectPending || isLoading,
    /** Projet non résolu, ou échec de la requête des événements. */
    isError: isProjectUnresolved || !!error,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  };
}
