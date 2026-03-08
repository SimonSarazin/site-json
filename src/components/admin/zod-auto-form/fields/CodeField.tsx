import { useRef, useEffect, useCallback } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { keymap } from "@codemirror/view";
import { indentUnit } from "@codemirror/language";
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

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

function formatHtml(raw: string): string {
  if (!raw || /\n\s*</.test(raw)) return raw;

  let result = "";
  let indent = 0;
  const tab = "  ";
  const tokens = raw.split(/(<\/?[^>]+\/?>)/g).filter(Boolean);

  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("</")) {
      indent = Math.max(0, indent - 1);
      result += tab.repeat(indent) + trimmed + "\n";
    } else if (trimmed.startsWith("<")) {
      result += tab.repeat(indent) + trimmed + "\n";
      const match = trimmed.match(/^<([a-zA-Z][a-zA-Z0-9-]*)/);
      const tagName = match?.[1]?.toLowerCase() ?? "";
      if (!trimmed.endsWith("/>") && !VOID_TAGS.has(tagName)) {
        indent++;
      }
    } else {
      result += tab.repeat(indent) + trimmed + "\n";
    }
  }

  return result.trimEnd();
}

const HTML_KEYS = new Set(["html"]);

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
  const valueRef = useRef(value);
  valueRef.current = value;
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
    const isHtml = HTML_KEYS.has(fieldKey);

    const rawValue = (valueRef.current as string) ?? "";
    const doc = isHtml ? formatHtml(rawValue) : rawValue;

    if (isHtml && doc !== rawValue && doc) {
      setTimeout(() => onChangeRef.current(doc), 0);
    }

    const extensions = [
      basicSetup,
      keymap.of([indentWithTab]),
      indentUnit.of("  "),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newVal = update.state.doc.toString();
          onChangeRef.current(newVal || undefined);
        }
      }),
      EditorView.theme({
        "&": { fontSize: compact ? "11px" : "12px", flex: "1" },
        ".cm-scroller": {
          minHeight: "calc(100vh - 200px)",
          maxHeight: "none",
        },
      }),
    ];

    if (langFn) extensions.push(langFn());
    if (isDark) extensions.push(oneDark);

    const state = EditorState.create({
      doc,
      extensions,
    });

    viewRef.current = new EditorView({
      state,
      parent: containerRef.current,
    });
  }, [fieldKey, isDark, compact]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="flex flex-col h-full min-h-0 space-y-1.5">
      <Label className="text-xs font-medium shrink-0">
        {label}{" "}
        {isOptional && (
          <span className="text-muted-foreground">(optionnel)</span>
        )}
      </Label>
      <div
        ref={containerRef}
        className="rounded-md border [&_.cm-editor]:outline-none flex-1 min-h-0 [&_.cm-editor]:h-full"
      />
    </div>
  );
}
