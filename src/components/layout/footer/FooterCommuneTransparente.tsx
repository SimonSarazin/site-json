import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Facebook, Instagram, Linkedin, Mail, Twitter, Youtube } from "lucide-react";
import { useLocalization } from "@/hooks/useLocalization";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import { DynamicModal } from "@/modules/profil/components/add/ModalRegistry";
import type { Footer } from "@/types/site-schema";

const socialIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  twitter: Twitter,
  youtube: Youtube,
  mail: Mail,
};

interface FooterCommuneTransparenteProps {
  footer: Footer;
}

export default function FooterCommuneTransparente({ footer }: FooterCommuneTransparenteProps) {
  const { t } = useLocalization();

  return (
    <footer className="bg-[#030e23] text-white py-14 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
          <div className="space-y-4">
            {footer.logoTitle && (
              <p className="text-xl font-semibold text-white">{t(footer.logoTitle)}</p>
            )}

            {footer.description && (
              <p className="text-sm text-white/80 leading-relaxed">
                {t(footer.description)}
              </p>
            )}

            <FooterCtaButton footer={footer} />

            {footer.socials && footer.socials.length > 0 && (
              <div className="flex items-center gap-3 pt-2">
                {footer.socials.map((social, index) => {
                  const Icon = socialIcons[social.platform.toLowerCase()] ?? Mail;
                  return (
                    <a
                      key={`${social.platform}-${index}`}
                      href={social.url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-10 h-10 rounded-full border border-white/10 hover:border-primary/60 flex items-center justify-center transition-colors"
                      aria-label={social.platform}
                    >
                      <Icon className="w-5 h-5" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {footer.columns?.map((column, index) => (
            <div key={`column-${index}`} className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">
                {t(column.title)}
              </h3>
              <ul className="space-y-3 text-white/80 text-sm">
                {column.links?.map((link, linkIdx) => (
                  <li key={`${link.href}-${linkIdx}`}>
                    <FooterLink href={link.href} label={t(link.label)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* <div className="mt-12 pt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-sm text-white/60">
          <p className="max-w-2xl">{t(footer.copyright)}</p>
          <div className="flex flex-wrap gap-4">
            {footer.legalLinks?.map((link, index) => (
              <FooterLink key={`legal-${index}`} href={link.href} label={t(link.label)} muted />
            ))}
            {footer.bottomLinks?.map((link, index) => (
              <FooterLink key={`bottom-${index}`} href={link.href} label={t(link.label)} muted />
            ))}
          </div>
        </div> */}
      </div>
    </footer>
  );
}

function FooterLink({ href, label, muted }: { href: string; label: string; muted?: boolean }) {
  const isExternal = /^(https?:\/\/|mailto:|tel:)/.test(href);
  const baseClass = muted
    ? "text-white/60 hover:text-white transition-colors"
    : "hover:text-white text-white/80 transition-colors";

  if (isExternal) {
    return (
      <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={baseClass}>
        {label}
      </a>
    );
  }

  return (
    <Link to={href} className={baseClass}>
      {label}
    </Link>
  );
}

function FooterCtaButton({ footer }: { footer: Footer }) {
  const cta = footer.ctaButton;
  const { t } = useLocalization();
  const { me, entity } = useCocolight();
  const tKey = useT("modules/search");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const ctaClasses = "inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm font-semibold shadow-lg shadow-primary/30 transition-transform hover:-translate-y-0.5";

  if (!cta) {
    return null;
  }

  if (cta.href) {
    const isExternal = /^https?:\/\//.test(cta.href);
    return (
      <a
        href={cta.href}
        className={ctaClasses}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noreferrer" : undefined}
      >
        {t(cta.label)}
      </a>
    );
  }

  if (cta.path) {
    return (
      <Link
        to={cta.path}
        className={ctaClasses}
      >
        {t(cta.label)}
      </Link>
    );
  }

  const modalName = cta.action || cta.modal;
  const requiresAuth = cta.requiresAuth ?? Boolean(modalName && modalName !== "add-new-ct");

  const handleClick = () => {
    if (requiresAuth && !me) {
      toast.error(tKey("Vous devez être connecté"));
      return;
    }

    if (modalName) {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        className={ctaClasses}
        onClick={handleClick}
      >
        {t(cta.label)}
      </button>
      {modalName && (
        <DynamicModal
          modalName={modalName}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          parent={entity}
          formConfig={cta.formConfig}
        />
      )}
    </>
  );
}
