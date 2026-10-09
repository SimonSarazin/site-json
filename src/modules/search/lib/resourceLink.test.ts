import { describe, it, expect } from "vitest";
import { formatDocument, lienPrincipal } from "./resourceLink";

const doc = (url: string, ext = "pdf") => ({ url, name: "inforeso.pdf", ext });

describe("lienPrincipal", () => {
  it("ouvre le document hébergé", () => {
    expect(lienPrincipal({ documents: [doc("/upload/communecter/poi/x/inforeso.pdf")], urls: [] })).toEqual({
      href: "/upload/communecter/poi/x/inforeso.pdf",
      nature: "document",
      ext: "pdf",
    });
  });

  it("ouvre le lien externe quand il n'y a pas de document", () => {
    expect(lienPrincipal({ documents: [], urls: ["https://www.calameo.com/books/008264182a31adb6c6465"] })).toEqual({
      href: "https://www.calameo.com/books/008264182a31adb6c6465",
      nature: "lien",
      ext: "",
    });
  });

  it("préfère le document hébergé au lien — la copie durable gagne", () => {
    expect(lienPrincipal({ documents: [doc("/doc.pdf")], urls: ["https://ancien-site.org/doc.pdf"] })?.nature).toBe("document");
  });

  it("ignore les valeurs vides au lieu de produire un lien mort", () => {
    expect(lienPrincipal({ documents: [doc("  ")], urls: ["", "https://x.org"] })?.href).toBe("https://x.org");
    expect(lienPrincipal({ documents: [], urls: [] })).toBeNull();
    expect(lienPrincipal({ documents: [doc("")], urls: ["  "] })).toBeNull();
  });
});

describe("formatDocument", () => {
  it("annonce le format réel du document, en capitales", () => {
    expect(formatDocument({ href: "/a.pdf", nature: "document", ext: "pdf" })).toBe("PDF");
    expect(formatDocument({ href: "/a.docx", nature: "document", ext: "docx" })).toBe("DOCX");
  });

  it("rend null sans extension connue, ou pour un lien externe", () => {
    expect(formatDocument({ href: "/fichier", nature: "document", ext: "" })).toBeNull();
    expect(formatDocument({ href: "https://x.org/a.pdf", nature: "lien", ext: "" })).toBeNull();
  });
});
