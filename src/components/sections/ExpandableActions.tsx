import { useState } from "react";
import { Link } from "react-router";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { toast } from "sonner";
import { useLocalization } from "@/hooks/useLocalization";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import { DynamicModal } from "@/modules/profil/components/add/ModalRegistry";
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

function getButtonClassName(variant?: ActionButton["variant"]) {
  if (variant === "secondary") {
    return "inline-block px-3 py-2 bg-gray-200 text-gray-700 text-xs md:text-sm font-medium rounded-md hover:bg-gray-300 transition-all";
  }

  return "inline-block px-3 py-2 bg-gray-800 text-white text-xs md:text-sm font-medium rounded-md hover:bg-gray-900 transition-all";
}

function ActionButtonRenderer({ button }: { button: ActionButton }) {
  const tKey = useT("modules/search");
  const { t } = useLocalization();
  const { me, entity } = useCocolight();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const modalName = button.action || button.modal;
  const shouldOpenModal = !!modalName;
  const requiresAuth = button.requiresAuth ?? shouldOpenModal;

  const handleClick = () => {
    if (requiresAuth && !me) {
      toast.error(tKey("Vous devez être connecté"));
      return;
    }

    if (shouldOpenModal) {
      setIsModalOpen(true);
    }
  };

  if (button.href) {
    return (
      <Link to={button.href} className={getButtonClassName(button.variant)}>
        {t(button.label)}
      </Link>
    );
  }

  return (
    <>
      <button type="button" className={getButtonClassName(button.variant)} onClick={handleClick}>
        {t(button.label)}
      </button>
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
      className="flex flex-col p-6 rounded-lg bg-gray-50 border border-gray-200 hover:border-gray-300 transition-all cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex items-start gap-4 mb-3">
        <div
          className={`w-10 h-10 rounded-lg ${getIconBgClass(item.iconBg)} flex items-center justify-center shrink-0`}
        >
          <DynamicIcon name={item.icon as IconName} className="w-5 h-5 text-white" />
        </div>
        <div className="flex-grow">
          <h3 className="font-bold text-base md:text-lg text-gray-800">
            {t(item.title)}
          </h3>
        </div>
        <div
          className={`text-gray-600 shrink-0 transition-transform duration-300 ${
            isExpanded ? "rotate-180" : ""
          }`}
        >
          <DynamicIcon name="chevron-down" className="w-5 h-5" />
        </div>
      </div>

      {isExpanded && (
        <>
          <p className="text-sm md:text-base text-gray-600 mb-4 flex-grow">{t(item.description)}</p>
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
    <section id={id} className="py-12 px-4 bg-white">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-10">
          {props.brandTitle && (
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-3">
              {t(props.brandTitle)}
            </h2>
          )}
          {props.description && (
            <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto mb-2">{t(props.description)}</p>
          )}
          {props.highlightText && (
            <p className="text-base font-semibold text-gray-700 italic">
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
