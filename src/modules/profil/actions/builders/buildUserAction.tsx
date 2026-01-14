/**
 * Factory pour construire des objets UserAction depuis la configuration
 * Utilisé pour les actions admin sur les membres d'une entité
 */
import type { UseMutationResult } from "@tanstack/react-query";
import type { User } from "@communecter/cocolight-api-client";
import { MEMBER_ACTION_CONFIG, type MemberActionConfigKey, type MemberActionConfig } from "../config/member-actions";
import { getActionIcon } from "../config/icons";
import type { UserAction } from "../../types";

type TFunction = (key: string, defaultValue?: string, params?: Record<string, string>) => string;

type ShowConfirmationFn = (config: {
  title: string;
  description: string;
  action: () => void;
  isDestructive?: boolean;
}) => void;

interface BuildUserActionOptions {
  /** Clé de la configuration d'action */
  configKey: MemberActionConfigKey;
  /** Fonction de traduction i18n */
  t: TFunction;
  /** Mutation React Query associée */
  mutation: UseMutationResult<void, Error, User, unknown>;
  /** Utilisateur cible de l'action */
  user: User;
  /** Fonction pour afficher le dialogue de confirmation */
  showConfirmation?: ShowConfirmationFn;
}

/**
 * Construit un objet UserAction à partir de la configuration
 *
 * @example
 * const action = buildUserAction({
 *   configKey: "promote",
 *   t,
 *   mutation: promoteMutation,
 *   user: targetUser,
 *   showConfirmation,
 * });
 */
export function buildUserAction({
  configKey,
  t,
  mutation,
  user,
  showConfirmation,
}: BuildUserActionOptions): UserAction {
  const config = MEMBER_ACTION_CONFIG[configKey] as MemberActionConfig;
  const Icon = getActionIcon(config.icon);
  const userName = user.serverData?.name || "Unknown";

  const executeAction = () => mutation.mutate(user);

  // Déterminer le onClick selon que l'action nécessite une confirmation ou non
  let onClick: () => void;
  if (config.requiresConfirmation && config.confirmation && showConfirmation) {
    onClick = () =>
      showConfirmation({
        title: t(config.confirmation!.titleKey),
        description: t(config.confirmation!.descriptionKey, undefined, { name: userName }),
        action: executeAction,
        isDestructive: config.isDestructive,
      });
  } else {
    onClick = executeAction;
  }

  return {
    id: config.id,
    label: t(config.i18nKey),
    icon: <Icon className="w-3 h-3" />,
    variant: config.variant,
    onClick,
    requiresConfirmation: config.requiresConfirmation,
  };
}

interface BuildDisabledUserActionOptions {
  /** Clé de la configuration d'action */
  configKey: MemberActionConfigKey;
  /** Fonction de traduction i18n */
  t: TFunction;
}

/**
 * Construit un objet UserAction désactivé (badge de statut)
 *
 * @example
 * const badge = buildDisabledUserAction({
 *   configKey: "inviting",
 *   t,
 * });
 */
export function buildDisabledUserAction({
  configKey,
  t,
}: BuildDisabledUserActionOptions): UserAction {
  const config = MEMBER_ACTION_CONFIG[configKey] as MemberActionConfig;
  const Icon = getActionIcon(config.icon);

  return {
    id: config.id,
    label: t(config.i18nKey),
    icon: <Icon className="w-3 h-3" />,
    variant: config.variant,
    onClick: () => {},
    disabled: true,
  };
}

interface BuildInviteActionOptions {
  /** Clé de la configuration d'action */
  configKey: MemberActionConfigKey;
  /** Fonction de traduction i18n */
  t: TFunction;
  /** Mutation React Query associée */
  mutation: UseMutationResult<void, Error, User, unknown>;
  /** Utilisateur à inviter */
  user: User;
}

/**
 * Construit un objet UserAction pour une invitation (sans confirmation)
 *
 * @example
 * const action = buildInviteAction({
 *   configKey: "inviteMember",
 *   t,
 *   mutation: inviteMemberMutation,
 *   user: targetUser,
 * });
 */
export function buildInviteAction({
  configKey,
  t,
  mutation,
  user,
}: BuildInviteActionOptions): UserAction {
  const config = MEMBER_ACTION_CONFIG[configKey] as MemberActionConfig;
  const Icon = getActionIcon(config.icon);

  return {
    id: config.id,
    label: t(config.i18nKey),
    icon: <Icon className="w-3 h-3" />,
    variant: config.variant,
    onClick: () => mutation.mutate(user),
  };
}
