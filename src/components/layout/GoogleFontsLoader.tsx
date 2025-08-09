
import { useSite } from "@/hooks/useSite";
import { useEffect, useMemo } from "react";

function extractFontFamilies(families?: string[]): string[] {
  if (!families) return [];
  return families
    .map(f => f.trim().replace(/['"]/g, "").split(",")[0]) // on garde juste le nom de la police
    .filter(f => !["sans-serif", "serif", "monospace"].includes(f));
}

function buildGoogleFontURL(font: string): string {
  const encoded = font.replace(/ /g, "+");
  return `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;500;600;700&display=swap`;
}

export function GoogleFontsLoader() {
  const { config } = useSite();
  const fontFamily = config?.theme?.typography?.fontFamily;

  const fontsUsed = useMemo(() => {
    const fonts = new Set<string>();
    
    if (fontFamily) {
      extractFontFamilies(fontFamily.sans).forEach(f => fonts.add(f));
      extractFontFamilies(fontFamily.serif).forEach(f => fonts.add(f));
      extractFontFamilies(fontFamily.mono).forEach(f => fonts.add(f));
    }
    
    return fonts;
  }, [fontFamily]);

  useEffect(() => {

    fontsUsed.forEach(font => {
      const id = `google-font-${font.replace(/\s+/g, "-").toLowerCase()}`;
      if (document.getElementById(id)) return;

      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = buildGoogleFontURL(font);

      document.head.appendChild(link);
    });
  }, [fontsUsed]);

  if (!fontFamily) return null;
  return null;
}
