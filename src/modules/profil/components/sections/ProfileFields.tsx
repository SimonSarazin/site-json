import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { buildProfileFieldRows, fieldHref } from "../../lib/profileFields";
import type { ProfileFieldsSection } from "../../schema";

interface ProfileFieldsProps {
  section: ProfileFieldsSection;
}

/**
 * Section **générique** d'affichage de champs d'entité (`profile-fields`) : le
 * pendant profil de `preview.type: "facets"`. Rend les champs déclarés en config
 * — y compris les champs costum — sans une ligne de code par site. Les champs
 * absents ou vides sont omis ; si aucun n'a de valeur, la section ne rend rien.
 */
export default function ProfileFields({ section }: ProfileFieldsProps) {
  const { entity } = useProfileEntity();
  const t = useT("modules/profil");

  const { title, variant = "card", columns = 1, fields = [] } = section;
  const serverData = (entity?.serverData ?? {}) as Record<string, unknown>;
  const rows = buildProfileFieldRows(serverData, fields);

  if (rows.length === 0) return null;

  const list = (
    <dl className={columns === 2 ? "grid gap-4 sm:grid-cols-2" : "space-y-4"}>
      {rows.map(({ field, tokens, labels }) => (
        <div key={field.field} className="flex items-start">
          <DynamicIcon
            name={(field.icon ?? "tag") as IconName}
            className="mt-1 h-5 w-5 shrink-0 text-accent"
            aria-hidden
          />
          <div className="ml-3 min-w-0">
            <dt className="text-sm font-medium text-muted-foreground">
              {field.label ? t(field.label) : field.field}
            </dt>
            <dd className="text-sm break-words">
              {tokens.map((token, index) => {
                const href = fieldHref(field.format, token);
                const text = labels?.[index] ?? token;
                return (
                  <span key={`${token}-${index}`}>
                    {index > 0 && ", "}
                    {href ? (
                      <a
                        href={href}
                        target={field.format === "email" || field.format === "tel" ? undefined : "_blank"}
                        rel="noopener noreferrer"
                        className="font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:text-primary/80 hover:decoration-primary"
                      >
                        {text}
                      </a>
                    ) : (
                      text
                    )}
                  </span>
                );
              })}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );

  if (variant === "plain") {
    return (
      <div className="mb-8">
        {title && <h2 className="mb-4 text-2xl font-bold text-foreground">{t(title)}</h2>}
        {list}
      </div>
    );
  }

  return (
    <Card className="mb-8">
      {title && (
        <CardHeader>
          <CardTitle>{t(title)}</CardTitle>
        </CardHeader>
      )}
      <CardContent>{list}</CardContent>
    </Card>
  );
}
