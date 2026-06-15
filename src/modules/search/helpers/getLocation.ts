import type { SearchEntity } from "@communecter/cocolight-api-client";

/**
 * Localité d'affichage d'une entité de recherche : `address.addressLocality`
 * (sinon `null`). Source UNIQUE des cartes search (était dupliquée à l'identique
 * dans CardEventFeatured / CardImageCover / CardResourceBooking).
 *
 * NB : `CardFunding` garde sa variante locale (repli supplémentaire sur
 * `codePostal`) — comportement volontairement différent, non fusionné ici.
 */
export function getLocation(item: SearchEntity): string | null {
  const serverData = item?.serverData;
  if (serverData?.address?.addressLocality) {
    return serverData.address.addressLocality;
  }
  return null;
}
