/**
 * Factory pour construire des objets EntityAction depuis la configuration
 */
import type { UseMutationResult } from "@tanstack/react-query";
import { ENTITY_ACTION_CONFIG, type EntityActionConfigKey, type EntityActionConfig } from "../config/entity-actions";
import { getActionIcon } from "../config/icons";
import type { EntityAction } from "../../types";

type TFunction = (key: string) => string;

interface BuildEntityActionOptions {
  /** Clé de la configuration d'action */
  configKey: EntityActionConfigKey;
  /** Fonction de traduction i18n */
  t: TFunction;
  /** Mutation React Query associée */
  mutation: UseMutationResult<void, Error, void, unknown>;
  /** Surcharges optionnelles */
  overrides?: Partial<EntityAction>;
  /** Ajouter une marge à l'icône (true pour dropdown, false pour boutons séparés) */
  iconMargin?: boolean;
}

/**
 * Construit un objet EntityAction à partir de la configuration
 *
 * @example
 * const action = buildEntityAction({
 *   configKey: "follow",
 *   t,
 *   mutation: followMutation,
 * });
 */
export function buildEntityAction({
  configKey,
  t,
  mutation,
  overrides = {},
  iconMargin = true,
}: BuildEntityActionOptions): EntityAction {
  // Cast explicite vers l'interface pour accéder aux propriétés optionnelles
  const config = ENTITY_ACTION_CONFIG[configKey] as EntityActionConfig;
  const Icon = getActionIcon(config.icon);
  const iconClassName = iconMargin ? "w-4 h-4 mr-2" : "w-4 h-4";

  const action: EntityAction = {
    id: config.id,
    type: config.type,
    label: t(config.i18nKey),
    icon: <Icon className={iconClassName} />,
    variant: config.variant,
    onClick: () => mutation.mutate(),
    requiresConfirmation: config.requiresConfirmation,
    isPending: mutation.isPending,
    show: true,
    isDestructive: config.isDestructive,
  };

  // Ajouter les textes de confirmation si nécessaire
  if (config.confirmation) {
    action.confirmationTitle = t(config.confirmation.titleKey);
    action.confirmationDescription = t(config.confirmation.descriptionKey);
    action.confirmationConfirm = t(config.confirmation.confirmKey);
    action.confirmationCancel = t(config.confirmation.cancelKey);
  }

  // Appliquer les surcharges
  return { ...action, ...overrides };
}

interface BuildPendingActionOptions {
  /** Clé de la configuration d'action */
  configKey: EntityActionConfigKey;
  /** Fonction de traduction i18n */
  t: TFunction;
  /** Ajouter une marge à l'icône */
  iconMargin?: boolean;
}

/**
 * Construit un objet EntityAction "pending" (désactivé, non cliquable)
 *
 * @example
 * const pendingAction = buildPendingAction({
 *   configKey: "membershipPending",
 *   t,
 * });
 */
export function buildPendingAction({
  configKey,
  t,
  iconMargin = true,
}: BuildPendingActionOptions): EntityAction {
  const config = ENTITY_ACTION_CONFIG[configKey] as EntityActionConfig;
  const Icon = getActionIcon(config.icon);
  const iconClassName = iconMargin ? "w-4 h-4 mr-2" : "w-4 h-4";

  return {
    id: config.id,
    type: config.type,
    label: t(config.i18nKey),
    icon: <Icon className={iconClassName} />,
    variant: config.variant,
    onClick: () => {},
    requiresConfirmation: false,
    disabled: true,
    show: true,
  };
}

interface BuildEntityActionWithParamsOptions<TParams> {
  /** Clé de la configuration d'action */
  configKey: EntityActionConfigKey;
  /** Fonction de traduction i18n */
  t: TFunction;
  /** Mutation React Query associée (avec paramètres) */
  mutation: UseMutationResult<void, Error, TParams, unknown>;
  /** Paramètres à passer à la mutation */
  params: TParams;
  /** Surcharges optionnelles */
  overrides?: Partial<EntityAction>;
  /** Ajouter une marge à l'icône */
  iconMargin?: boolean;
}

/**
 * Construit un objet EntityAction pour une mutation avec paramètres
 *
 * @example
 * const action = buildEntityActionWithParams({
 *   configKey: "removeFriend",
 *   t,
 *   mutation: removeFriendMutation,
 *   params: { user: targetUser },
 * });
 */
export function buildEntityActionWithParams<TParams>({
  configKey,
  t,
  mutation,
  params,
  overrides = {},
  iconMargin = true,
}: BuildEntityActionWithParamsOptions<TParams>): EntityAction {
  const config = ENTITY_ACTION_CONFIG[configKey] as EntityActionConfig;
  const Icon = getActionIcon(config.icon);
  const iconClassName = iconMargin ? "w-4 h-4 mr-2" : "w-4 h-4";

  const action: EntityAction = {
    id: config.id,
    type: config.type,
    label: t(config.i18nKey),
    icon: <Icon className={iconClassName} />,
    variant: config.variant,
    onClick: () => mutation.mutate(params),
    requiresConfirmation: config.requiresConfirmation,
    isPending: mutation.isPending,
    show: true,
    isDestructive: config.isDestructive,
  };

  if (config.confirmation) {
    action.confirmationTitle = t(config.confirmation.titleKey);
    action.confirmationDescription = t(config.confirmation.descriptionKey);
    action.confirmationConfirm = t(config.confirmation.confirmKey);
    action.confirmationCancel = t(config.confirmation.cancelKey);
  }

  return { ...action, ...overrides };
}
