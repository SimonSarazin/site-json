import { useMemo } from "react";
import { Link } from "react-router";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useGetAnswersByFormsQuery } from "@/modules/profil/hooks/useGetAnwersByFormsQuery";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";
import { getEntryId, getEntrySlug } from "@/modules/search/lib/searchMapSelection";
import { useMultiEvalData } from "../hooks/useMultiEvalData";
import type { CoFormEvaluationsDirectorySectionProps } from "../schema";
import { MultiEvalRadarTabs } from "./MultiEvalRadarTabs";

type Props = CoFormEvaluationsDirectorySectionProps;

function EvaluationRadar({ answerId }: { answerId: string | null }) {
  const t = useT("modules/coform");
  const { data, isLoading, error, refetch } = useMultiEvalData({ answerId, enabled: !!answerId });

  if (!answerId) return <p role="alert">{t("coform.evaluationsDirectory.missingAnswerId")}</p>;
  if (error) {
    return (
      <div role="alert" className="space-y-2 text-destructive">
        <p>{t("coform.evaluationsDirectory.radarError")}</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>{t("coform.evaluationsDirectory.retry")}</Button>
      </div>
    );
  }
  if (isLoading || !data) return <p>{t("coform.evaluationsDirectory.loadingRadar")}</p>;
  if (data.steps.length === 0) return <p>{t("coform.evaluationsDirectory.noRadar")}</p>;
  return <MultiEvalRadarTabs steps={data.steps} />;
}

function PlaceEvaluations({ place, formId, finder }: { place: SearchEntity; formId: string; finder: string }) {
  const t = useT("modules/coform");
  const forms = useMemo(() => ({
    [formId]: { name: formId, finder, linked: true, hide: false, openMode: "modal" as const },
  }), [formId, finder]);
  const { data, isLoading, error, refetch } = useGetAnswersByFormsQuery({ entity: place, forms });
  const name = typeof place.serverData?.name === "string" ? place.serverData.name : getEntryId(place);
  const slug = getEntrySlug(place);
  const answers = data?.find((item) => item.id === formId)?.answers ?? [];

  return (
    <article className="rounded-lg border bg-card p-5 space-y-4">
      <h2 className="text-xl font-semibold">{name}</h2>
      {slug && <Link className="text-sm text-primary underline" to={`/profil/${encodeURIComponent(slug)}`}>{t("coform.evaluationsDirectory.profile")}</Link>}
      {!getEntryId(place) ? (
        <p role="alert" className="text-destructive">{t("coform.evaluationsDirectory.answersError")}</p>
      ) : error ? (
        <div role="alert" className="space-y-2 text-destructive">
          <p>{t("coform.evaluationsDirectory.answersError")}</p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>{t("coform.evaluationsDirectory.retry")}</Button>
        </div>
      ) : isLoading || !data ? (
        <p>{t("coform.evaluationsDirectory.loadingAnswers")}</p>
      ) : answers.length === 0 ? (
        <p className="text-muted-foreground">{t("coform.evaluationsDirectory.noAnswers")}</p>
      ) : answers.map((answer, index) => {
        const answerId = answer._serverData?.id ?? answer.id ?? null;
        return <EvaluationRadar key={answerId ?? index} answerId={answerId} />;
      })}
    </article>
  );
}

export default function CoFormEvaluationsDirectorySection({ id, props }: { id?: string; props: Props }) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");
  const baseParams = useMemo(() => ({
    defaultTypes: ["organizations" as const],
    sourceKey: [props.sourceKey],
    defaultFields: ["name", "slug"],
    indexStepList: 20,
  }), [props.sourceKey]);
  const { transformedResults, isPending, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useSearchQuery({
    queryKeyPrefix: `coform-evaluations-directory-${id ?? "default"}`,
    searchText: "",
    searchTags: {},
    searchType: { type: ["organizations"] },
    mapUsed: false,
    baseParams,
  });

  return (
    <section id={id} data-co="coform-evaluations-directory" className="container mx-auto px-4 py-8">
      {!!error && (
        <div role="alert" className="space-y-2 text-destructive">
          <p>{t("coform.evaluationsDirectory.placesError")}</p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>{t("coform.evaluationsDirectory.retry")}</Button>
        </div>
      )}
      {isPending ? (
        <p>{t("coform.evaluationsDirectory.loadingPlaces")}</p>
      ) : !error && transformedResults.length === 0 ? (
        <p>{t("coform.evaluationsDirectory.noPlaces")}</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {transformedResults.map((place, index) => (
            <PlaceEvaluations key={getEntryId(place) ?? index} place={place} formId={props.formId} finder={props.finder} />
          ))}
        </div>
      )}
      {hasNextPage && (
        <div className="mt-6 text-center">
          <Button variant="outline" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
            {t(isFetchingNextPage ? "coform.evaluationsDirectory.loadingMore" : "coform.evaluationsDirectory.more")}
          </Button>
        </div>
      )}
    </section>
  );
}
