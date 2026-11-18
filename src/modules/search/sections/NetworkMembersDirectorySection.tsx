import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCocolight } from "@/hooks/useCocolight";
import { useLocalization } from "@/hooks/useLocalization";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/search/i18n";
import { fetchNetworkMembers, filterNetworkMembers, memberSkills, networkSkills } from "../lib/networkMembers";
import type { NetworkMembersDirectorySectionProps } from "../schema";
import type { NetworkMember } from "../lib/networkMembers";

const EMPTY_MEMBERS: NetworkMember[] = [];

export default function NetworkMembersDirectorySection({ id, props }: {
  id?: string;
  props: NetworkMembersDirectorySectionProps;
}) {
  useLoadNamespace("modules/search");
  const t = useT("modules/search");
  const { t: localize } = useLocalization();
  const { entity } = useCocolight();
  const [skill, setSkill] = useState("");
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["network-members-directory", entity?.id, props.sourceKey],
    enabled: Boolean(entity),
    staleTime: 5 * 60 * 1000,
    queryFn: () => {
      if (!entity) throw new Error("API non initialisée");
      return fetchNetworkMembers(entity, props.sourceKey);
    },
  });
  const members = query.data ?? EMPTY_MEMBERS;
  const skills = useMemo(() => networkSkills(members), [members]);
  const filtered = useMemo(() => filterNetworkMembers(members, skill, search), [members, search, skill]);

  return (
    <section id={id} className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold">{localize(props.title)}</h1>
      {props.description && <p className="mt-3 text-muted-foreground">{localize(props.description)}</p>}
      {query.isError ? (
        <div role="alert" className="mt-8 space-y-3">
          <p>{t("networkMembers.error")}</p>
          <Button onClick={() => void query.refetch()}>{t("networkMembers.retry")}</Button>
        </div>
      ) : query.isPending ? (
        <p role="status" className="mt-8">{t("networkMembers.loading")}</p>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap gap-4">
            <label className="flex flex-col gap-1">
              <span>{t("networkMembers.search")}</span>
              <input className="rounded-md border bg-background px-3 py-2" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span>{t("networkMembers.skills")}</span>
              <select className="rounded-md border bg-background px-3 py-2" value={skill} onChange={(event) => setSkill(event.target.value)}>
                <option value="">{t("networkMembers.allSkills")}</option>
                {skills.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <p className="my-6 text-muted-foreground" aria-live="polite">
            {t("networkMembers.count", undefined, { count: filtered.length })}
          </p>
          {filtered.length === 0 ? <p>{t("networkMembers.empty")}</p> : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((member) => {
                const name = member.name || String(t("networkMembers.anonymous"));
                const values = memberSkills(member);
                return (
                  <article key={member.id} className="rounded-lg border bg-card p-6">
                    <Avatar className="mb-4 h-20 w-20">
                      <AvatarImage src={member.profilImageUrl || member.profilMediumImageUrl || undefined} alt="" />
                      <AvatarFallback>{name.slice(0, 1).toLocaleUpperCase()}</AvatarFallback>
                    </Avatar>
                    <h2 className="text-xl font-semibold">
                      {member.slug ? <Link className="hover:underline" to={`/profil/${encodeURIComponent(member.slug)}`}>{name}</Link> : name}
                    </h2>
                    {member.shortDescription && <p className="mt-2 text-sm text-muted-foreground">{member.shortDescription}</p>}
                    <div className="mt-4 flex flex-wrap gap-1">
                      {values.length ? values.map((value) => <Badge key={value} variant="outline">{value}</Badge>) : (
                        <span className="text-sm text-muted-foreground">{t("networkMembers.noSkills")}</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
