/**
 * Mapping centralisé des icônes pour les actions
 * Permet de référencer les icônes par clé string dans les configs
 */
import {
  UserPlus,
  UserMinus,
  UserCheck,
  UserX,
  Users,
  LogOut,
  Clock,
  Check,
  X,
  Crown,
  ShieldOff,
  Trash2,
  Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const ACTION_ICONS = {
  userPlus: UserPlus,
  userMinus: UserMinus,
  userCheck: UserCheck,
  userX: UserX,
  users: Users,
  logout: LogOut,
  clock: Clock,
  check: Check,
  x: X,
  crown: Crown,
  shieldOff: ShieldOff,
  trash: Trash2,
  mail: Mail,
} as const;

export type ActionIconKey = keyof typeof ACTION_ICONS;

export function getActionIcon(key: ActionIconKey): LucideIcon {
  return ACTION_ICONS[key];
}
