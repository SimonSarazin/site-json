import { useCocolight } from "@/hooks/useCocolight";
import { useInteropConfig } from "./useInteropConfigQuery";
import { useProfileEntity } from "@/modules/profil";

type InteropData = Record<string, Record<string, string | false>>;

export function useInteropUserLinks() {
  const { entity } = useProfileEntity();
  const { me } = useCocolight();
  const { costumSlug } = useInteropConfig();
  const interop = entity ?  entity?.serverData?.interop as InteropData | undefined : me?.serverData?.interop as InteropData | undefined;

  const discourseVal = costumSlug
    ? (interop?.discourse?.[costumSlug] as string | false | undefined)
    : undefined;

  const wikiVal = costumSlug
    ? (interop?.mediawiki?.[costumSlug] as string | undefined)
    : undefined;

  // Guard contre `undefined === undefined === true` (cas user déconnecté + entité absente).
  const isOwnProfile = Boolean(me?.slug && entity?.slug && me.slug === entity.slug);

  return {
    /** Username Discourse lié ou undefined */
    discourseUsername:
      typeof discourseVal === "string" ? discourseVal : undefined,
    isDiscourseLinked: typeof discourseVal === "string",
    isDiscourseDismissed: discourseVal === false,
    wikiUsername: wikiVal,
    isWikiLinked: typeof wikiVal === "string",
    isOwnProfile,
  };
}
