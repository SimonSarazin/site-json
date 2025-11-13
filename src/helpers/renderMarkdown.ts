import { sanitize } from "@/lib/sanitize";
import MarkdownIt from "markdown-it";

  export const renderMarkdown = (text: string, section: { markdownEnabled?: boolean }) => {
    const md = new MarkdownIt();
    if (section.markdownEnabled !== false) {
      const html = md.render(text);
      return sanitize(html);
    }
    return text;
  };