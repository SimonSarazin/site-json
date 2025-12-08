import type { ElementType } from "react";
import { useT } from "@/hooks/useT";
import type { LocalizedString } from "@/types/locale-schema";

interface TProps {
  /** Clé de traduction : string pour i18next, LocalizedString pour JSON */
  k: string | LocalizedString;
  /** Namespace i18next (optionnel, ex: "modules/profil") */
  ns?: string;
  /** Texte de fallback */
  fallback?: string;
  /** Paramètres d'interpolation pour i18next */
  params?: Record<string, unknown>;
  /** Classes CSS */
  className?: string;
  /** Tag HTML à utiliser (défaut: span) */
  as?: ElementType;
}

export function T({
  k,
  ns,
  fallback,
  params,
  className,
  as: Tag = "span"
}: TProps) {
  const t = useT(ns);

  return (
    <Tag className={className} suppressHydrationWarning>
      {t(k, fallback, params)}
    </Tag>
  );
}
