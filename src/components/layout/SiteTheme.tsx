import { useSite } from "@/contexts/SiteContext";

// ------------------------------------------
// Utils : camelCase / digits  →  kebab-case
// ------------------------------------------
function toKebab(key: string) {
  return key
    // camelCase → kebab-case (primaryForeground → primary-foreground)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    // lettres + chiffres  (shadow2xs → shadow-2xs, chart1 → chart-1)
    .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
    .toLowerCase();
}

function toVarsExact(obj?: Record<string, string | number | string[]>) {
  if (!obj) return "";
  return Object.entries(obj)
    .map(([key, value]) => {
      const val = Array.isArray(value) ? value.join(", ") : value;
      return `--${toKebab(key)}: ${val};`;
    })
    .join("\n");
}

export function SiteTheme() {
  const { config } = useSite();
  const theme = config.theme;
  if (!theme) return null;

  let lightVars = "";
  let darkVars = "";

  if (theme.colors?.light) {
    lightVars += toVarsExact(theme.colors.light);
  }

  if (theme.colors?.dark) {
    darkVars += toVarsExact(theme.colors.dark);
  }

  if (theme.typography?.fontFamily) {
    lightVars += "\n" + toVarsExact(
      Object.fromEntries(
        Object.entries(theme.typography.fontFamily).map(([k, v]) => [`font-${k}`, v])
      )
    );
    darkVars += "\n" + toVarsExact(
      Object.fromEntries(
        Object.entries(theme.typography.fontFamily).map(([k, v]) => [`font-${k}`, v])
      )
    );
  }

  if (theme.spacing?.base) {
      lightVars += `\n--spacing: ${theme.spacing.base};`;
  }


  if (theme.borderRadius?.base) {
    lightVars += `\n--radius: ${theme.borderRadius.base};`;
  }

  if (theme.shadows?.light) {
    lightVars += "\n" + toVarsExact(theme.shadows.light);
  }
  if (theme.shadows?.dark) {
    darkVars += "\n" + toVarsExact(theme.shadows.dark);
  }

  let css = `:root {\n${lightVars}\n}`;
  if (darkVars.trim()) css += `\n.dark {\n${darkVars}\n}`;
  if (theme.customCSS) css += `\n${theme.customCSS}`;

  return <style id="site-theme" dangerouslySetInnerHTML={{ __html: css }} />;
}
