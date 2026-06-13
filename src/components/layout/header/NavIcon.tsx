import { DynamicIcon, type IconName } from "lucide-react/dynamic";

/**
 * Icône optionnelle d'un item de nav (`NavItem.icon` — nom lucide kebab-case,
 * ex. "house", "chart-column"). Rend `null` sans icône : les headers la posent
 * systématiquement devant le libellé, le config décide.
 */
export default function NavIcon({ icon, className = "h-4 w-4 shrink-0" }: { icon?: string; className?: string }) {
  if (!icon) return null;
  return <DynamicIcon name={icon as IconName} className={className} />;
}
