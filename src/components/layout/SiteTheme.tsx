import { useSite } from "@/contexts/SiteContext";

function toVars(obj: Record<string, string>): string {
  return Object.entries(obj)
    .map(([k, v]) => `--${k}: ${v};`)
    .join("\n");
}

export function SiteTheme() {
  const { config } = useSite();
  const theme = config.theme;
  if (!theme) return null;

  let css = "";
  if (theme.colors) {
    if (theme.colors.light) {
      css += `:root {\n${toVars(theme.colors.light)}\n}`;
    }
    if (theme.colors.dark) {
      css += `\n.dark {\n${toVars(theme.colors.dark)}\n}`;
    }
  }

  if (theme.typography?.fontFamily?.sans) {
    css += `\nbody { font-family: ${theme.typography.fontFamily.sans.join(", ")}; }`;
  }

  if (theme.customCSS) {
    css += `\n${theme.customCSS}`;
  }

  return <style id="site-theme" dangerouslySetInnerHTML={{ __html: css }} />;
}
