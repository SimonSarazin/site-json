import { useRef, useEffect, useCallback } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { Label } from "@/components/ui/label";

const LANG_MAP: Record<string, () => ReturnType<typeof html>> = {
  html: html,
  css: css,
  js: javascript,
  customCSS: css,
  customJS: javascript,
  style: css,
  script: javascript,
};

interface CodeFieldProps {
  label: string;
  fieldKey: string;
  value: unknown;
  onChange: (v: unknown) => void;
  isOptional: boolean;
  compact?: boolean;
}

export function CodeField({
  label,
  fieldKey,
  value,
  onChange,
  isOptional,
  compact,
}: CodeFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  const initEditor = useCallback(() => {
    if (!containerRef.current) return;

    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const langFn = LANG_MAP[fieldKey];
    const extensions = [
      basicSetup,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newVal = update.state.doc.toString();
          onChangeRef.current(newVal || undefined);
        }
      }),
      EditorView.theme({
        "&": { fontSize: compact ? "11px" : "12px" },
        ".cm-scroller": {
          minHeight: compact ? "100px" : "140px",
          maxHeight: "400px",
          overflow: "auto",
        },
        ".cm-editor": { borderRadius: "6px" },
      }),
    ];

    if (langFn) extensions.push(langFn());
    if (isDark) extensions.push(oneDark);

    const state = EditorState.create({
      doc: (value as string) ?? "",
      extensions,
    });

    viewRef.current = new EditorView({
      state,
      parent: containerRef.current,
    });
  }, [fieldKey, isDark, compact]); 

  useEffect(() => {
    initEditor();
    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [initEditor]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    const incoming = (value as string) ?? "";
    if (current !== incoming) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: incoming },
      });
    }
  }, [value]);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label}{" "}
        {isOptional && (
          <span className="text-muted-foreground">(optionnel)</span>
        )}
      </Label>
      <div
        ref={containerRef}
        className="rounded-md border overflow-hidden [&_.cm-editor]:outline-none"
      />
    </div>
  );
}
