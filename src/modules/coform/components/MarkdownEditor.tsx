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

  return (
    <div data-color-mode="light">
      <MDEditor
        value={value}
        onChange={(val) => onChange?.(val || "")}
        height={height}
        preview={preview}
      />
    </div>
  );
}
