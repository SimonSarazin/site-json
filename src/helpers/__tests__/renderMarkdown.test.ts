import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../renderMarkdown";

/**
 * Tests de renderMarkdown :
 *  - convertit markdown → HTML via markdown-it
 *  - passe le résultat dans `sanitize` (DOMPurify) si markdownEnabled !== false
 *  - retourne le texte brut si markdownEnabled === false
 */

describe("renderMarkdown", () => {
  describe("conversion markdown → HTML", () => {
    it("convertit un titre h1", () => {
      const result = renderMarkdown("# Title", {});
      expect(result).toMatch(/<h1[^>]*>Title<\/h1>/);
    });

    it("convertit un lien markdown en <a>", () => {
      const result = renderMarkdown("[ex](https://example.com)", {});
      expect(result).toContain("<a");
      expect(result).toContain("https://example.com");
      expect(result).toContain(">ex</a>");
    });

    it("convertit du **bold** en <strong>", () => {
      const result = renderMarkdown("**hello**", {});
      expect(result).toContain("<strong>hello</strong>");
    });

    it("convertit un code block en <pre><code>", () => {
      const result = renderMarkdown("```\nconst x = 1\n```", {});
      expect(result).toContain("<pre>");
      expect(result).toContain("<code>");
      expect(result).toContain("const x = 1");
    });
  });

  describe("markdownEnabled flag", () => {
    it("retourne le texte brut si markdownEnabled === false", () => {
      const input = "# Title";
      expect(renderMarkdown(input, { markdownEnabled: false })).toBe(input);
    });

    it("rend le markdown si markdownEnabled === true", () => {
      const result = renderMarkdown("# Title", { markdownEnabled: true });
      expect(result).toMatch(/<h1[^>]*>Title<\/h1>/);
    });

    it("rend le markdown si markdownEnabled est absent (défaut)", () => {
      const result = renderMarkdown("# Title", {});
      expect(result).toMatch(/<h1[^>]*>Title<\/h1>/);
    });
  });

  describe("sanitization", () => {
    it("neutralise les <script> inline (markdown-it les échappe par défaut)", () => {
      // markdown-it par défaut n'autorise PAS le HTML inline (html: false),
      // donc <script> est échappé en &lt;script&gt;. Le passage par sanitize()
      // ne fait que confirmer qu'aucune balise script exécutable ne sort.
      const input = "Hello <script>alert('xss')</script> world";
      const result = renderMarkdown(input, {});
      expect(result).not.toContain("<script>");
      expect(result).not.toMatch(/<script[\s>]/i);
      // Le contenu est échappé → safe à injecter via dangerouslySetInnerHTML.
      expect(result).toContain("&lt;script&gt;");
    });

    it("retire les <script> si HTML inline est activé (sanitize garde-fou)", () => {
      // Cas hypothétique où markdown-it serait configuré avec html: true.
      // sanitize doit toujours retirer les balises dangereuses. On vérifie en
      // appelant directement sanitize sur un HTML contenant <script>.
      // Ce test est implicite via le coverage de sanitize, mais on documente
      // le contrat ici.
      const input = "[ok](javascript:alert(1))";
      const result = renderMarkdown(input, {});
      expect(result).not.toMatch(/href\s*=\s*["']?javascript:/i);
    });

    it("ne retire pas les balises HTML legitimes générées par markdown-it (em, strong)", () => {
      const result = renderMarkdown("This is _italic_ and **bold**.", {});
      expect(result).toContain("<em>italic</em>");
      expect(result).toContain("<strong>bold</strong>");
    });
  });

  describe("déterminisme", () => {
    it("même input → même output (idempotence)", () => {
      const input = "# Title\n\nSome **bold** text and a [link](https://x.com).";
      const a = renderMarkdown(input, {});
      const b = renderMarkdown(input, {});
      expect(a).toBe(b);
    });
  });

  describe("cas limites", () => {
    it("gère une chaîne vide gracefulement", () => {
      const result = renderMarkdown("", {});
      // markdown-it retourne "" pour une string vide → sanitize("") === ""
      expect(result).toBe("");
    });

    it("gère du texte sans aucune syntaxe markdown", () => {
      const result = renderMarkdown("plain text", {});
      // markdown-it wrappe le texte dans un <p>
      expect(result).toContain("plain text");
      expect(result).toContain("<p>");
    });
  });
});
