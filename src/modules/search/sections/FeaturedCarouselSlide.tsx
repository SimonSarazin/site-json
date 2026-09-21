import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { useResourceData } from "../hooks/useResourceData";
import type { FeaturedCarouselSectionProps, SearchListEntity } from "../schema";
import FeaturedCarouselCta from "./FeaturedCarouselCta";

interface FeaturedCarouselSlideProps {
  item: SearchListEntity;
  ctaLabel: FeaturedCarouselSectionProps["ctaLabel"];
  resource: FeaturedCarouselSectionProps["resource"];
  itemAction: NonNullable<FeaturedCarouselSectionProps["itemAction"]>;
  accentColor: FeaturedCarouselSectionProps["accentColor"];
  accentTextColor: FeaturedCarouselSectionProps["accentTextColor"];
  /** Habillage « carte » : le bouton n'est plus ici — la section le pose en pied, avec les points. */
  enCarte?: boolean;
  priority?: boolean;
}

/**
 * Une diapositive du carrousel « à la une », EMPILÉE : image, puis titre, description et CTA.
 * Le badge `badgeLabel` n'est PLUS ici — il défilerait avec chaque diapositive ; il est rendu une
 * seule fois, DANS LE FLUX au-dessus du carrousel, par `FeaturedCarouselSection` (il y fut absolu, ce
 * qui le faisait chevaucher les titres longs — cf. le commentaire de la section). Isolée de `FeaturedCarouselSection`
 * car `useResourceData` est un hook — impossible à appeler dans un `.map()` du parent (règle des
 * hooks), même découpage que `CardResource`/`CardResourceCard`.
 */
export default function FeaturedCarouselSlide({ item, ctaLabel, resource, itemAction, accentColor, accentTextColor, enCarte = false, priority }: FeaturedCarouselSlideProps) {
  const data = useResourceData(item, resource);

  // Colonne unique, image EN PREMIER (`order` plutôt qu'un déplacement du JSX : l'image reste après
  // le texte dans l'ordre du DOM, donc dans l'ordre de lecture d'un lecteur d'écran, où le titre doit
  // précéder son illustration). Deux colonnes auparavant — abandonné : la section vit désormais dans
  // une colonne de `gridLayout` (accueil parent62), où une mise côte à côte redevenait illisible.
  return (
    <div className="flex flex-col gap-5 xl:gap-20">
      <div className="order-2 flex flex-col items-start gap-2 xl:gap-3">
        {/* `line-clamp-3` : un titre long ne doit pas étirer la diapositive (la
            hauteur du carrousel suit la slide la plus haute) ni repousser le CTA —
            le texte complet reste lisible au survol (`title`) et via le CTA. */}
        <h2 className="line-clamp-3 text-xl font-bold md:text-2xl" title={data.title}>{data.title}</h2>
        {data.description && <p className="line-clamp-2 text-sm opacity-90 md:text-base">{data.description}</p>}
        {!enCarte && (
          <FeaturedCarouselCta
            item={item}
            ctaLabel={ctaLabel}
            itemAction={itemAction}
            accentColor={accentColor}
            accentTextColor={accentTextColor}
          />
        )}
      </div>
      {data.image && (
        // `object-contain` (plutôt que `cover`) : l'image entière reste visible, jamais
        // rognée — le fond de la section (déjà derrière) comble l'espace résiduel.
        // Le PLAFOND `max-h` borne la hauteur, `max-w-sm` la largeur : c'est le plus contraignant des
        // deux qui gagne. Trop bas, il bride l'image AVANT sa largeur utile et laisse un vide sous le
        // badge ; on le règle donc pour que la boîte reste remplie. Le palier `xl:` est le même arbitrage
        // que les gouttières : place généreuse sur grand écran, plafond bas dès que le viewport rétrécit
        // (tablette, ou desktop zoomé) — là, le mou restant passe SOUS le bloc, jamais entre le badge et
        // l'image, où il se lisait comme un trou.
        // Boîte BORNÉE (`max-w-sm`, centrée) et non pleine largeur : `contain` AGRANDIT une image
        // plus petite que sa boîte pour la remplir, si bien qu'une photo de profil ou un logo —
        // le cas courant des fiches « à la une » — s'affichait étiré et flou sur toute la colonne.
        // La borner ramène l'agrandissement à une vignette nette ; une grande photo, elle, n'y perd
        // que de la largeur. L'arrondi asymétrique du site est conservé, à l'échelle de la boîte
        // (100px de rayon sur ~380px de large mangeaient la moitié de l'image).
        // `aspect-[16/10]` (plutôt que `4/3`) : boîte moins haute à largeur égale, pour que
        // header + « à la une » tiennent ensemble au premier écran sans scroll. Le PLAFOND `max-h`
        // sert le même but une fois la slide empilée : `w-full` fait dériver la hauteur de la largeur
        // de la colonne, et l'image seule reprenait alors les ~85px que l'empilement avait coûtés —
        // assez pour ressortir du premier écran sur un 1366x768.
        <OptimizedImage
          src={data.image}
          alt={data.title}
          width={640}
          priority={priority}
          className="order-1 mx-auto aspect-[16/10] max-h-[17vh] xl:max-h-[24vh] w-full max-w-sm rounded-[0px_40px_0_40px] object-contain"
        />
      )}
    </div>
  );
}
