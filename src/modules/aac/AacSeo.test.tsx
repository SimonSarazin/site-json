// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { HelmetProvider, type HelmetDataContext } from "@dr.pogodin/react-helmet";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";

/**
 * Le SEO des routes du module AAC (review MR 53, lot 2 — M12).
 *
 * Les balises sont lues dans le CONTEXTE serveur de Helmet — ce que
 * `entry-server.tsx` injecte dans le `<head>` — et non dans le DOM de jsdom :
 * c'est la sortie SSR qui était vide.
 */

vi.mock("@/hooks/useSite", () => ({
  useSite: () => ({
    config: {
      meta: {
        title: { fr: "Fédération des CAE", en: "CAE Federation" },
        description: { fr: "Le réseau des CAE" },
        ogImage: "/og-default.png",
      },
    },
  }),
}));
vi.mock("@/lib/constant/common", () => ({ getSitePublicUrl: () => "https://cae.example.org/" }));

const { AacSeo } = await import("./AacSeo");

function renderSeo(ui: React.ReactElement): HelmetDataContext {
  const ctx: HelmetDataContext = {};
  render(
    <HelmetProvider context={ctx}>
      <LocalizationProvider>{ui}</LocalizationProvider>
    </HelmetProvider>,
  );
  return ctx;
}

describe("AacSeo", () => {
  it("titre « page — site », description, og:* et canonical absolutisés sur l'URL publique", () => {
    const ctx = renderSeo(
      <AacSeo
        title="Une instance peertube"
        description="Partage vidéo auto-hébergé"
        image="/upload/x.png"
        path="/aac/commun/000000000000000000000001"
      />,
    );

    const title = String(ctx.helmet?.title);
    const meta = String(ctx.helmet?.meta);
    const link = String(ctx.helmet?.link);

    expect(title).toContain("Une instance peertube — Fédération des CAE");
    expect(meta).toContain('name="description" content="Partage vidéo auto-hébergé"');
    expect(meta).toContain('property="og:title" content="Une instance peertube — Fédération des CAE"');
    expect(meta).toContain('property="og:image" content="https://cae.example.org/upload/x.png"');
    expect(meta).toContain('property="og:url" content="https://cae.example.org/aac/commun/000000000000000000000001"');
    expect(meta).toContain('property="og:site_name" content="Fédération des CAE"');
    expect(link).toContain('rel="canonical" href="https://cae.example.org/aac/commun/000000000000000000000001"');
  });

  it("sans titre ni description propres, retombe sur ceux du site — jamais un <title> vide", () => {
    const ctx = renderSeo(<AacSeo path="/aac" />);

    expect(String(ctx.helmet?.title)).toContain(">Fédération des CAE<");
    const meta = String(ctx.helmet?.meta);
    expect(meta).toContain('name="description" content="Le réseau des CAE"');
    expect(meta).toContain('property="og:image" content="https://cae.example.org/og-default.png"');
  });
});
