import { useState, useMemo } from "react";

interface SiteInfo {
  slug: string;
  title: string;
  description?: string;
  logo?: string;
}

interface SiteListProps {
  sites: SiteInfo[];
}

const CSS_THEMES = [
  { value: "index-rezo-la-mer", label: "Rezo la Mer" },
  { value: "index-cyber-reunion", label: "Cyber Reunion" },
  { value: "index-jardin-ocean", label: "Jardin Ocean" },
  { value: "index-commune-transparente", label: "Commune Transparente" },
  { value: "index-nos-communes", label: "Nos Communes" },
  { value: "index-sport-sante-bien-etre", label: "Sport Sante Bien-Etre" },
  { value: "index-tiers-lieux", label: "Tiers-Lieux" },
  { value: "index-julie-pot-vin", label: "Julie Pot Vin" },
  { value: "index-institut-bleu", label: "Institut Bleu" },
];

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function getInitials(title: string): string {
  return title
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

const CARD_COLORS = [
  "from-blue-500/20 to-cyan-500/20",
  "from-violet-500/20 to-purple-500/20",
  "from-emerald-500/20 to-teal-500/20",
  "from-orange-500/20 to-amber-500/20",
  "from-pink-500/20 to-rose-500/20",
  "from-indigo-500/20 to-sky-500/20",
];

function getCardColor(index: number) {
  return CARD_COLORS[index % CARD_COLORS.length];
}

export default function SiteListSection({ props }: { id?: string; props: SiteListProps }) {
  const { sites: initialSites } = props;
  const [sites, setSites] = useState(initialSites);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [css, setCss] = useState(CSS_THEMES[0].value);
  const [slugManual, setSlugManual] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return sites;
    const q = search.toLowerCase();
    return sites.filter(
      (s) => s.title.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)
    );
  }, [sites, search]);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugManual) setSlug(slugify(v));
  };

  const handleCreate = async () => {
    if (!slug || !name) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/admin/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, configFile: `config.prod.${slugify(name)}.json`, css }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erreur lors de la creation"); return; }
      setSites((prev) => [...prev, { slug, title: name }]);
      setShowForm(false);
      setName("");
      setSlug("");
      setSlugManual(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Hero header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
        <div className="relative container mx-auto max-w-7xl px-6 pt-16 pb-12">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  SiteForge
                </h1>
              </div>
              <p className="text-muted-foreground text-sm max-w-md">
                Gerez et accedez a l'ensemble de vos sites depuis un seul endroit.
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-sm hover:shadow-md"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nouveau site
            </button>
          </div>
        </div>
      </header>

      {/* Search + stats bar */}
      <div className="container mx-auto max-w-7xl px-6 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un site..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border/60 bg-card/50 text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">
              {filtered.length} site{filtered.length > 1 ? "s" : ""}
            </span>
            {/* Mobile add button */}
            <button
              onClick={() => setShowForm(true)}
              className="sm:hidden inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nouveau
            </button>
          </div>
        </div>
      </div>

      {/* Sites grid */}
      <div className="container mx-auto max-w-7xl px-6 pb-20">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <p className="text-muted-foreground text-sm">Aucun site ne correspond a votre recherche.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((site, i) => (
              <a
                key={site.slug}
                href={`/s/${site.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm hover:bg-card hover:border-border hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 block overflow-hidden"
              >
                {/* Gradient accent top */}
                <div className={`h-1 bg-gradient-to-r ${getCardColor(i)}`} />

                <div className="p-5">
                  <div className="flex items-start gap-3.5 mb-3">
                    {site.logo ? (
                      <img
                        src={site.logo}
                        alt={site.title}
                        className="h-10 w-10 rounded-lg object-contain shrink-0 bg-muted/30 p-1"
                      />
                    ) : (
                      <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${getCardColor(i)} flex items-center justify-center shrink-0`}>
                        <span className="text-xs font-bold text-foreground/70">
                          {getInitials(site.title)}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {site.title}
                      </h2>
                      <p className="text-xs text-muted-foreground/70 font-mono truncate">
                        {site.slug}
                      </p>
                    </div>
                  </div>

                  {site.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {site.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      En ligne
                    </span>
                    <svg className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Create site modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowForm(false); setError(""); }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-card border border-border rounded-2xl p-0 w-full max-w-lg mx-4 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-foreground">Nouveau site</h3>
              </div>
              <button
                onClick={() => { setShowForm(false); setError(""); }}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-destructive text-sm">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Nom du site <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Mon nouveau site"
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border/60 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all placeholder:text-muted-foreground/50"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Slug <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/50 font-mono">/s/</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
                    placeholder="mon-nouveau-site"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-border/60 bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              {/* Theme CSS */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Theme CSS</label>
                <select
                  value={css}
                  onChange={(e) => setCss(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border/60 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                >
                  {CSS_THEMES.map((theme) => (
                    <option key={theme.value} value={theme.value}>{theme.label}</option>
                  ))}
                </select>
              </div>

              {/* Config file preview */}
              {name && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/30">
                  <svg className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="text-xs text-muted-foreground font-mono truncate">
                    config.prod.{slugify(name)}.json
                  </span>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/50 bg-muted/20">
              <button
                onClick={() => { setShowForm(false); setError(""); }}
                className="px-4 py-2 rounded-lg border border-border/60 text-sm text-foreground hover:bg-muted/50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !slug || !name}
                className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" /></svg>
                    Creation...
                  </span>
                ) : "Creer le site"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
