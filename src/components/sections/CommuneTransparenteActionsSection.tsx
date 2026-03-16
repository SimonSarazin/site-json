import { useState } from "react";
import { Link } from "react-router";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { toast } from "sonner";
import { useLocalization } from "@/hooks/useLocalization";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import { DynamicModal } from "@/modules/profil/components/add/ModalRegistry";
import type {
  CommuneTransparenteActionsSectionProps as CommuneTransparenteActionsProps,
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

interface CommuneTransparenteActionsComponentProps {
  id?: string;
  props: CommuneTransparenteActionsProps;
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
    return "inline-block px-4 py-2 bg-indigo-100 text-indigo-700 text-sm md:text-base font-semibold rounded-md hover:bg-indigo-200 transition-all";
  }

  return "inline-block px-4 py-2 bg-indigo-600 text-white text-sm md:text-base font-semibold rounded-md hover:bg-indigo-700 transition-all";
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

export function CommuneTransparenteActionsSection({ id, props }: CommuneTransparenteActionsComponentProps) {
  const { t } = useLocalization();
  const items = (props.items ?? []) as ActionItem[];

  return (
    <section id={id} className="py-16 px-4 bg-white">
      <div className="container mx-auto max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-stretch">
          <div className="flex flex-col items-center justify-center h-full text-center">
            {props.imageSrc && (
              <img
                src={props.imageSrc}
                alt={props.imageAlt ? t(props.imageAlt) : "Commune Transparente"}
                className="w-64 h-auto mb-6 rounded-xl"
              />
            )}
            {props.brandTitle && (
              <h3 className="text-2xl md:text-3xl font-bold text-indigo-700 uppercase tracking-wide mb-4">
                {t(props.brandTitle)}
              </h3>
            )}
            {props.description && (
              <p className="text-base md:text-lg text-slate-600 text-center mb-3">{t(props.description)}</p>
            )}
            {props.highlightText && (
              <p className="text-base md:text-lg font-semibold text-slate-800 text-center italic">
                {t(props.highlightText)}
              </p>
            )}
          </div>

          <div className="flex flex-col divide-y divide-slate-200">
            {items.map((item, index) => (
              <details key={`${id || "commune-transparente-actions"}-${index}`} className="py-6 group">
                <summary className="flex items-center gap-3 cursor-pointer list-none select-none">
                  <div
                    className={`w-8 h-8 rounded-lg ${getIconBgClass(item.iconBg)} flex items-center justify-center shrink-0`}
                  >
                    <DynamicIcon name={item.icon as IconName} className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-base md:text-lg uppercase tracking-wide text-slate-700">
                    {t(item.title)}
                  </span>
                  <span className="ml-auto text-slate-400 transition-transform group-open:rotate-90">›</span>
                </summary>
                <div className="pt-2 pb-1 pl-11">
                  <p className="text-sm md:text-base text-slate-500 mb-3">{t(item.description)}</p>
                  <div className="flex gap-2 flex-wrap">
                    {item.buttons.map((button, buttonIndex) => (
                      <ActionButtonRenderer
                        key={`${id || "commune-transparente-actions"}-${index}-${buttonIndex}`}
                        button={button}
                      />
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default CommuneTransparenteActionsSection;
