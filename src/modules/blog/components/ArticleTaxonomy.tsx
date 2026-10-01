import type { LucideIcon } from "lucide-react";
import { MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/hooks/useT";
import type { ArticleData } from "../hooks/useArticle";
import { stringArray } from "../lib/articleTaxonomy";

/** Une ligne de pastilles étiquetée par une icône + un libellé — masquée si `values` est vide. */
function TaxonomyRow({ icon: Icon, label, values }: { icon: LucideIcon; label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </span>
      {values.map((v) => <Badge key={v} variant="secondary">{v}</Badge>)}
    </div>
  );
}

/**
 * Pied de lecture d'article : territoires et publics (étiquetés, icône + libellé), puis mots-clés
 * (pastilles seules, SANS étiquette — rendu historique, inchangé pour ne rien déplacer sur les sites
 * qui n'ont que des `tags`). Chaque groupe est optionnel, masqué individuellement si vide ; tout le
 * bloc disparaît si les trois le sont. Partagé par les variants `default`/`poster` du reader (cf.
 * `READER_VARIANTS`) : `territoires`/`publics` sont des champs POI parent62 (`costumForms.
 * parent62-article`), absents (donc invisibles, sans régression) sur les sites qui n'en déclarent pas.
 */
export function ArticleTaxonomy({ article }: { article: ArticleData }) {
  const t = useT("modules/blog");
  const territoires = stringArray(article.territoires);
  const publics = stringArray(article.publics);
  const tags = stringArray(article.tags);
  if (territoires.length === 0 && publics.length === 0 && tags.length === 0) return null;

  return (
    <div className="mt-8 flex flex-col gap-3 border-t pt-6">
      <TaxonomyRow icon={MapPin} label={t("article.territories")} values={territoires} />
      <TaxonomyRow icon={Users} label={t("article.audiences")} values={publics} />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
        </div>
      )}
    </div>
  );
}
export default ArticleTaxonomy;
