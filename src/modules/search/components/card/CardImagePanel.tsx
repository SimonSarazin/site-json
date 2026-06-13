import { SearchCardProps } from "../../schema";
import useItem from "../../hooks/useItem";

export default function CardImagePanel({
  item,
  onClick,
  card = {
    tagLimit: 5,
    showDescription: false,
    showAddress: true,
  },
}: SearchCardProps) {
  const data = useItem(item);

  const {
    name,
    addressString,
    profilImageUrl,
    profilMediumImageUrl,
    profilThumbImageUrl,
    address,
  } = data;

  // Résolution de l'image : priorité profilImageUrl > medium > thumb
  const bgImage = profilImageUrl || profilMediumImageUrl || profilThumbImageUrl || "";

  // Adresse affichable : on préfère addressString, sinon on compose depuis address
  const displayAddress =
    addressString ||
    [address?.streetAddress, address?.postalCode, address?.addressLocality]
      .filter(Boolean)
      .join(" ") ||
    "";

  return (
    <div
      className="group relative overflow-hidden rounded-xl cursor-pointer aspect-4/3 bg-muted shadow-lg hover:shadow-2xl transition-all duration-300"
      onClick={onClick}
      title={name}
    >
      {/* Image de fond */}
      {bgImage ? (
        <img
          src={bgImage}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        /* Fond dégradé quand pas d'image */
        <div className="absolute inset-0 bg-gradient-to-br from-muted to-secondary" />
      )}

      {/* Panneau blanc flottant avec écart visible sur les bords */}
      <div className="absolute bottom-2 left-2 right-2 rounded-xl bg-card shadow-md px-3 py-2">
        <h3 className="font-bold text-sm text-card-foreground leading-tight line-clamp-2">
          {name}
        </h3>

        {card.showAddress !== false && displayAddress && (
          <p className="text-xs text-muted-foreground leading-tight line-clamp-2 mt-0.5">
            {displayAddress}
          </p>
        )}
      </div>
    </div>
  );
}