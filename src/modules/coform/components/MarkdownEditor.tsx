import { useTheme } from "next-themes";

import { renderMarkdown } from "@/helpers/renderMarkdown";
import { useClientModule } from "@/hooks/useClientModule";

interface MarkdownEditorProps {
  value: string;
  onChange?: (value: string) => void;
  height?: number;
  preview?: "edit" | "live" | "preview";
}

/**
 * Wrapper client-only autour de `@uiw/react-md-editor`.
 *
 * Pourquoi `useClientModule` plutôt que `lazy(() => import(...))` :
 * la lib `@uiw/react-md-editor` importe son propre CSS via un `import "*.css"`
 * dans son ESM. Node SSR ne sait pas charger les fichiers `.css` → erreur
 * `ERR_UNKNOWN_FILE_EXTENSION` au boot du serveur quand `preloadAll()`
 * tente de pré-charger tous les chunks lazy.
 *
 * `useClientModule` charge le module uniquement après `useIsMounted()` côté
 * client → le SSR ne touche jamais à ce module et son CSS. Pendant le mount
 * initial (1er render client), un skeleton est rendu.
 */
export function MarkdownEditor({ value, onChange, height = 200, preview = "edit" }: MarkdownEditorProps) {
  // `@uiw/react-md-editor` se thème via l'attribut `data-color-mode="light"|"dark"` sur un wrapper (ou <html>).
  // On le branche sur le thème GLOBAL du site (next-themes) au lieu d'un "light" figé → l'éditeur suit
  // le clair/sombre. `resolvedTheme` résout aussi le mode "system".
  const { resolvedTheme } = useTheme();
  const colorMode: "light" | "dark" = resolvedTheme === "dark" ? "dark" : "light";
  const [mounted, mod] = useClientModule(() => import("@uiw/react-md-editor"));

  if (!mounted || !mod) {
    return (
      <div
        className="min-h-50 border rounded-md p-4 bg-muted/20 flex items-center justify-center text-sm text-muted-foreground"
        style={{ minHeight: height }}
      >
        Chargement de l&apos;éditeur...
      </div>
    );
  }

  const MDEditor = mod.default;
  const c = mod.commands;

  // Barre d'outils RÉDUITE à l'essentiel article (la barre par défaut a ~25 boutons : titres 1-6, table,
  // code block, comment, fullscreen…). `fullscreen` volontairement RETIRÉ (c'est lui qui manipule
  // `document.body.style.overflow` — cf. overflow={false}).
  const toolbar = [
    c.bold, c.italic, c.strikethrough,
    c.divider,
    c.title, c.link, c.quote,
    c.divider,
    c.unorderedListCommand, c.orderedListCommand, c.checkedListCommand,
    c.divider,
    c.image, c.code,
  ];
  // À droite : bascule édition / aperçu (pas de plein écran).
  const extraToolbar = [c.codeEdit, c.codePreview];

  return (
    <div data-color-mode={colorMode}>
      <MDEditor
        value={value}
        onChange={(val) => onChange?.(val || "")}
        height={height}
        preview={preview}
        commands={toolbar}
        extraCommands={extraToolbar}
        // Aperçu SANITISÉ, identique au rendu public de l'article (helpers/renderMarkdown = markdown-it +
        // DOMPurify via lib/sanitize). Évite le rendu rehype non assaini par défaut de la lib, et garantit un
        // WYSIWYG fidèle à ce qui sera publié.
        components={{
          preview: (source) => (
            <div
              className="wmde-markdown"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(String(source ?? ""), {}) }}
            />
          ),
        }}
        // overflow={false} : l'éditeur gère le scroll du <body> pour son plein écran via un useEffect SANS
        // cleanup au démontage (Toolbar : `document.body.style.overflow = ...`). Dans une modale, à la
        // fermeture l'éditeur est démonté et laisse `<body>` avec `overflow:hidden` inline → scroll de page
        // perdu. On désactive cette gestion (inutile dans une modale) pour éviter la fuite.
        overflow={false}
      />
    </div>
  );
}
