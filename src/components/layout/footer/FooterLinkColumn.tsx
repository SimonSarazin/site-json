import { useLocalization } from "@/hooks/useLocalization";
import type { FooterLink } from "@/types/site-schema";
import NavLink from "../NavLink";
import type { FooterColumn } from "./useFooterLinks";

interface FooterLinkColumnProps {
  column: FooterColumn;
  /** Liens déjà filtrés par `useFooterColumns`. */
  links: FooterLink[];
  headingLevel?: "h3" | "h4";
  linkClassName: string;
}

/** Une colonne de liens de footer : son titre et sa liste. */
export function FooterLinkColumn({ column, links, headingLevel: Heading = "h3", linkClassName }: FooterLinkColumnProps) {
  const { t } = useLocalization();

  return (
    <div>
      <Heading className="font-semibold mb-4 text-foreground">{t(column.title)}</Heading>
      <ul className="space-y-2">
        {links.map((link, index) => (
          <li key={index}>
            <NavLink to={link.href} external={link.external} className={linkClassName}>
              {t(link.label)}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
