import MarkdownIt from "markdown-it";
import { sanitize } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { MarkdownSectionProps } from "@/types/site-schema";

// 1) Initialiser le parseur Markdown une seule fois :
const mdParser = new MarkdownIt({
  html: true,        // autorise le HTML dans le markdown
  linkify: true,     // transforme les URL en <a>
  typographer: true, // guillemets français, —, …, etc.
});

export function MarkdownSection({
  id,
  props,
}: {
  id?: string;
  props: MarkdownSectionProps;
}) {
  const { md, sourceType = "inline", animation } = props;

  // 2) Si le contenu est « inline », on le rend en HTML.
  //    Sinon, on suppose que `md` pointe vers un fichier ou une URL.
  const rawHtml =
    sourceType === "inline" ? mdParser.render(md) : `<p>Content from: ${md}</p>`;

  // 3) Désinfection XSS :
  const safeHtml = sanitize(rawHtml);

  return (
    <section
      id={id}
      className={cn(
        "py-16 bg-background text-foreground",
        animation && `animate-in ${animation}`,
      )}
      data-animation={animation}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* `prose-theme` (styles/shared.css) branche les `--tw-prose-*` sur les
            jetons du thème, injectés au runtime par `SiteTheme`. Remplace
            `prose-gray dark:prose-invert`, dont les gris sont codés en dur dans
            le plugin et juraient avec l'identité des sites ; le mode sombre est
            porté par les jetons eux-mêmes, qui basculent déjà via `.dark`. */}
        <div className="max-w-4xl mx-auto prose prose-theme">
          <div dangerouslySetInnerHTML={{ __html: safeHtml }} suppressHydrationWarning />
        </div>
      </div>
    </section>
  );
}

export default MarkdownSection;
