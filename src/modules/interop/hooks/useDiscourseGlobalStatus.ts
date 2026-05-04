import { useCocolight } from "@/hooks/useCocolight";
import { useInteropConfig } from "./useInteropConfigQuery";

type InteropData = Record<string, Record<string, string | false>>;

/**
 * Hook global (sans ProfileEntityContext) pour savoir si l'utilisateur connecté
 * doit voir la modal de liaison Discourse.
 */
export function useDiscourseGlobalStatus() {
  const { me } = useCocolight();
  const { costumSlug, hasDiscourse } = useInteropConfig();

  const interop = me?.serverData?.interop as InteropData | undefined;
  const discourseVal = costumSlug
    ? (interop?.discourse?.[costumSlug] as string | false | undefined)
    : undefined;

  const isLinked = typeof discourseVal === "string";
  const isDismissed = discourseVal === false;

  return {
    shouldShowModal: !!me && hasDiscourse && !isLinked && !isDismissed,
  };
}
