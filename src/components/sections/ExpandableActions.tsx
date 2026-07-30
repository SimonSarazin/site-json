import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { useLocalization } from "@/hooks/useLocalization";
import { useCocolight } from "@/hooks/useCocolight";
import { DynamicModal } from "@/modules/profil/components/add/ModalRegistry";
import { useAuthModal } from "@/modules/auth";
import type {
  ExpandableActionsProps,
  JsonFormModalConfig,
  LocalizedString,
} from "@/types/site-schema";

type ActionButton = {
  label: LocalizedString;
  href?: string;
  variant?: "primary" | "secondary";
  action?: "add-project" | "add-event" | "add-poi";
  modal?: string;
  formConfig?: JsonFormModalConfig;
  requiresAuth?: boolean;
};

type ActionItem = {
  title: LocalizedString;
  description: LocalizedString;
  icon: string;
  iconBg?: "blue" | "slate" | "purple" | "green" | "blue-dark" | "orange" | "lime";
  buttons: ActionButton[];
};

interface ExpandableActionsComponentProps {
  id?: string;
  props: ExpandableActionsProps;
}

/**
 * Pastilles d'icône : couleurs LITTÉRALES assumées, et conservées telles quelles.
 *
 * Ce sont des accents décoratifs choisis teinte par teinte par l'auteur de la
 * config, pas des rôles sémantiques. Les rabattre sur `chart-1..5` ferait
 * coïncider des entrées que l'auteur voulait distinctes — l'erreur commise puis
 * annulée sur `ActionTiles` (cf. 28aa052e). Elles portent une icône blanche sur
 * fond saturé : le contraste ne dépend pas du thème.
 */
function getIconBgClass(iconBg?: ActionItem["iconBg"]) {
  switch (iconBg) {
    case "slate":
      return "bg-slate-600";
    case "purple":
      return "bg-purple-500";
    case "green":
      return "bg-green-500";
    case "blue-dark":
      return "bg-blue-700";
    case "orange":
      return "bg-orange-500";
    case "lime":
      return "bg-green-400";
    case "blue":
    default:
      return "bg-blue-500";
  }
}

/** Le `variant` de config se lit directement comme un variant de `Button`. */
function buttonVariantOf(variant?: ActionButton["variant"]) {
  return variant === "secondary" ? "secondary" : "default";
}

function ActionButtonRenderer({ button }: { button: ActionButton }) {
  const { t } = useLocalization();
  const { me, entity } = useCocolight();
  const { openLogin } = useAuthModal();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const modalName = button.action || button.modal;
  const shouldOpenModal = !!modalName;
  const requiresAuth = button.requiresAuth ?? shouldOpenModal;

  const handleClick = (e: React.MouseEvent) => {
    // La carte parente porte `onClick={onToggle}` et les boutons vivent DEDANS,
    // dans la branche `isExpanded &&` : sans cet arrêt de propagation, tout clic
    // sur un bouton repliait la carte — donc DÉMONTAIT ce composant, son état
    // `isModalOpen` et le `onSuccess` ci-dessous avec. La modale demandée ne
    // s'ouvrait jamais, et l'utilisateur retrouvait sa carte fermée.
    e.stopPropagation();

    // Non connecté : on OUVRE le modal de login au lieu d'un `toast.error` qui
    // constatait le blocage sans offrir d'issue — c'est la règle appliquée
    // partout ailleurs (news, profil, search, CoForm). `onSuccess` rejoue
    // l'ouverture demandée, si bien que le clic aboutit à ce qu'il annonçait.
    if (requiresAuth && !me) {
      openLogin({ onSuccess: shouldOpenModal ? () => setIsModalOpen(true) : undefined });
      return;
    }

    if (shouldOpenModal) {
      setIsModalOpen(true);
    }
  };

  if (button.href) {
    return (
      <Button asChild variant={buttonVariantOf(button.variant)} size="sm">
        {/* Même arrêt de propagation : sans lui, la carte se replie sous le
            doigt au moment où la navigation part. */}
        <Link to={button.href} onClick={(e) => e.stopPropagation()}>
          {t(button.label)}
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant={buttonVariantOf(button.variant)}
        size="sm"
        onClick={handleClick}
      >
        {t(button.label)}
      </Button>
      {shouldOpenModal && (
        <DynamicModal
          modalName={modalName}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          parent={entity}
          formConfig={button.formConfig}
        />
      )}
    </>
  );
}

function ActionCardItem({
  item,
  index,
  id,
  isExpanded,
  onToggle,
}: {
  item: ActionItem;
  index: number;
  id?: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useLocalization();
  const cardKey = `${id || "expandable-actions"}-${index}`;

  return (
    <div
      key={cardKey}
      className="flex flex-col p-6 rounded-lg bg-muted/50 border border-border hover:border-foreground/20 transition-all cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex items-start gap-4 mb-3">
        <div
          className={`w-10 h-10 rounded-lg ${getIconBgClass(item.iconBg)} flex items-center justify-center shrink-0`}
        >
          <DynamicIcon name={item.icon as IconName} className="w-5 h-5 text-white" />
        </div>
        <div className="flex-grow">
          <h3 className="font-bold text-base md:text-lg text-foreground">
            {t(item.title)}
          </h3>
        </div>
        <div
          className={`text-muted-foreground shrink-0 transition-transform duration-300 ${
            isExpanded ? "rotate-180" : ""
          }`}
        >
          <DynamicIcon name="chevron-down" className="w-5 h-5" />
        </div>
      </div>

      {isExpanded && (
        <>
          <p className="text-sm md:text-base text-muted-foreground mb-4 flex-grow">{t(item.description)}</p>
          <div className="flex gap-2 flex-wrap">
            {item.buttons.map((button, buttonIndex) => (
              <ActionButtonRenderer
                key={`${cardKey}-${buttonIndex}`}
                button={button}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ExpandableActions({ id, props }: ExpandableActionsComponentProps) {
  const { t } = useLocalization();
  const items = (props.items ?? []) as ActionItem[];
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <section id={id} className="py-12 px-4 bg-background">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-10">
          {props.brandTitle && (
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              {t(props.brandTitle)}
            </h2>
          )}
          {props.description && (
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mb-2">{t(props.description)}</p>
          )}
          {props.highlightText && (
            <p className="text-base font-semibold text-muted-foreground italic">
              {t(props.highlightText)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {items.map((item, index) => (
            <ActionCardItem
              key={`${id || "expandable-actions"}-${index}`}
              item={item}
              index={index}
              id={id}
              isExpanded={expandedIndex === index}
              onToggle={() => setExpandedIndex(expandedIndex === index ? null : index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default ExpandableActions;
