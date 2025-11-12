import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

  export const renderMarkdown = (text: string, section: { markdownEnabled?: boolean }) => {
    const md = new MarkdownIt();
    if (section.markdownEnabled !== false) {
      const html = md.render(text);
      return DOMPurify.sanitize(html);
    }
    return text;
  };