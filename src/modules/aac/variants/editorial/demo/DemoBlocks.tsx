import { ArrowRight, Handshake, MapPin, MessageSquare, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/useT";
import { formatAacAmount } from "../../../lib/aacDisplay";
import { EditorialSection } from "../EditorialSection";
import { DemoNotice } from "./DemoNotice";
import {
  DEMO_COOPERATIONS,
  DEMO_FEEDBACK,
  DEMO_IMPACT,
  DEMO_QUESTIONS,
  DEMO_SUGGESTIONS,
  DEMO_SUPPORTS,
} from "./demoContent";

/**
 * Blocs de démonstration de la fiche « editorial », alimentés par `demoContent`.
 * Chacun porte `DemoNotice` ; toutes les commandes sont désactivées, aucun lien.
 */

/** Aside de « La fiche » : indicateurs d'impact. */
export function DemoImpactBlock() {
  const t = useT("modules/aac");
  return (
    <EditorialSection title={String(t("editorial.detail.impact"))}>
      <DemoNotice />
      <dl className="mt-3 space-y-3">
        {DEMO_IMPACT.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="font-display text-xl">{item.value}</dd>
          </div>
        ))}
      </dl>
    </EditorialSection>
  );
}

/** Aside de « La fiche » : le compagnon appels à projets. */
export function DemoCallsBlock() {
  const t = useT("modules/aac");
  return (
    <EditorialSection
      title={String(t("editorial.detail.calls.title"))}
      icon={<Sparkles className="size-4 text-primary" aria-hidden="true" />}
    >
      <DemoNotice />
      <p className="mt-1 text-sm text-muted-foreground">{String(t("editorial.detail.calls.intro"))}</p>
      <Button className="mt-4" variant="outline" disabled>
        {String(t("editorial.detail.calls.cta"))}
      </Button>
    </EditorialSection>
  );
}

/** « Communauté » : avis et idées. */
export function DemoFeedbackBlock() {
  const t = useT("modules/aac");
  return (
    <EditorialSection title={String(t("editorial.detail.feedback.title", undefined, { count: DEMO_FEEDBACK.length }))}>
      <DemoNotice />
      <ul className="mt-4 space-y-3">
        {DEMO_FEEDBACK.map((item) => (
          <li key={item.body} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MessageSquare className="size-3.5" aria-hidden="true" />
              {item.author} · {item.kind} · {item.date}
              {item.rating ? ` · ${item.rating}/5` : ""}
            </div>
            <p className="mt-2 text-sm">{item.body}</p>
          </li>
        ))}
      </ul>
      <Button className="mt-4" variant="outline" disabled>
        {String(t("editorial.detail.feedback.cta"))}
      </Button>
    </EditorialSection>
  );
}

/** « Communauté » : soutiens déclarés. */
export function DemoSupportsBlock() {
  const t = useT("modules/aac");
  return (
    <EditorialSection title={String(t("editorial.detail.supports.title", undefined, { count: DEMO_SUPPORTS.length }))}>
      <DemoNotice />
      <ul className="mt-4 space-y-3">
        {DEMO_SUPPORTS.map((support) => (
          <li key={support.name} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium">
              {support.name} — {support.kind}
              {support.amount ? ` · ${formatAacAmount(support.amount)} €` : ""}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{support.message}</p>
          </li>
        ))}
      </ul>
      <Button className="mt-4" variant="outline" disabled>
        {String(t("editorial.detail.supports.cta"))}
      </Button>
    </EditorialSection>
  );
}

/** « Maturation » — tout l'onglet. */
export function DemoMaturationTab() {
  const t = useT("modules/aac");
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <EditorialSection title={String(t("editorial.detail.maturation.title"))}>
        <DemoNotice />
        <p className="mt-1 text-sm text-muted-foreground">{String(t("editorial.detail.maturation.intro"))}</p>
        <ul className="mt-5 space-y-5">
          {DEMO_QUESTIONS.map((item) => (
            <li key={item.question}>
              <p className="font-medium">{item.question}</p>
              <p className="text-xs text-muted-foreground">
                {String(t("editorial.detail.maturation.askedBy", undefined, { name: item.askedBy }))}
              </p>
              {item.answer ? (
                <p className="mt-2 text-sm leading-relaxed">{item.answer}</p>
              ) : (
                <Textarea className="mt-2" rows={3} disabled aria-label={item.question} />
              )}
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-lg border border-dashed border-border p-4">
          <h3 className="font-medium">{String(t("editorial.detail.maturation.addTitle"))}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{String(t("editorial.detail.maturation.addIntro"))}</p>
          <Textarea
            rows={2}
            className="mt-3"
            disabled
            placeholder={String(t("editorial.detail.maturation.addPlaceholder"))}
            aria-label={String(t("editorial.detail.maturation.addTitle"))}
          />
          <Input
            className="mt-2"
            disabled
            placeholder={String(t("editorial.detail.maturation.askedByPlaceholder"))}
            aria-label={String(t("editorial.detail.maturation.askedByPlaceholder"))}
          />
          <Button size="sm" className="mt-3" disabled>
            {String(t("editorial.detail.maturation.addCta"))}
          </Button>
        </div>
      </EditorialSection>

      <EditorialSection
        title={String(t("editorial.detail.maturation.assistantTitle"))}
        icon={<Sparkles className="size-4 text-primary" aria-hidden="true" />}
      >
        <DemoNotice />
        <p className="mt-1 text-sm text-muted-foreground">{String(t("editorial.detail.maturation.assistantIntro"))}</p>
        <Button className="mt-4" disabled>
          {String(t("editorial.detail.maturation.assistantCta"))}
        </Button>
        <ul className="mt-5 space-y-4">
          {DEMO_SUGGESTIONS.map((item) => (
            <li key={item.question} className="rounded-lg border border-border p-4">
              <p className="font-medium">{item.question}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.why}</p>
              <Button size="sm" variant="outline" className="mt-3" disabled>
                {String(t("editorial.detail.maturation.keep"))}
              </Button>
            </li>
          ))}
        </ul>
      </EditorialSection>
    </div>
  );
}

/** « Coopérations » — tout l'onglet. */
export function DemoCooperationsTab() {
  const t = useT("modules/aac");
  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 text-primary">
          <Handshake className="size-5" aria-hidden="true" />
          <span className="text-sm font-semibold">{String(t("editorial.detail.cooperations.kicker"))}</span>
        </div>
        <h2 className="mt-2 font-display text-3xl md:text-4xl">{String(t("editorial.detail.cooperations.title"))}</h2>
        <DemoNotice />
        <p className="mt-3 text-muted-foreground">{String(t("editorial.detail.cooperations.intro"))}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {DEMO_COOPERATIONS.map((other) => (
          <article key={other.name} className="flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{other.kind}</Badge>
              <Badge variant="outline">{other.stage}</Badge>
            </div>
            <h3 className="mt-3 font-display text-2xl leading-[1.1]">{other.name}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden="true" />
              {other.place}
              <span className="text-border">•</span>
              {other.theme}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{other.tagline}</p>

            <ul className="mt-4 space-y-2 border-t border-border pt-4">
              {other.reasons.map((reason) => (
                <li key={reason} className="text-sm leading-relaxed">
                  {reason}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {other.needs.map((need) => (
                <Badge key={need} variant="secondary">
                  {need}
                </Badge>
              ))}
            </div>

            <div className="mt-auto flex flex-wrap gap-2 pt-5">
              <Button size="sm" disabled>
                {String(t("editorial.detail.cooperations.open"))} <ArrowRight aria-hidden="true" />
              </Button>
              <Button variant="outline" size="sm" disabled>
                {String(t("editorial.detail.cooperations.see"))}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
