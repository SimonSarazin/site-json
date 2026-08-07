import { useState } from "react";
import { Link2, Mail, RefreshCw, ShieldCheck, UserPlus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { InviteMemberDialog } from "@/modules/profil/components/members/InviteMemberDialog";
import { useEntityMembers } from "@/modules/profil/hooks/useMembersQuery";
import "@/modules/admin/i18n";

import { useInvitationActions } from "../hooks/useInvitationActions";

import type { AdminSection } from "../schema";

/**
 * Section « campagne d'invitation » (docs/24 §2). Réunit ce qui manquait à un costum :
 *  - deux LIENS PARTAGEABLES (membre / admin) — CREATE_INVITATION_LINK, copiés au presse-papier ;
 *  - la liste des INVITÉS EN ATTENTE (useEntityMembers isInviting, déjà branché) avec un bouton
 *    RELANCER par ligne — RELAUNCH_INVITATION ;
 *  - l'invitation unitaire/par email via InviteMemberDialog (multiconnect, déjà porté).
 *
 * Section costum enregistrée via `registerAdminSection("invitation", …)` — un costum l'active en
 * déclarant `{ type: "invitation" }` dans `config.admin.tabs.sections`.
 */
export default function AdminInvitationSection({ section: _section }: { section: AdminSection }) {
  const { entity } = useCocolight();
  const t = useT("modules/admin");
  const { generateInvitationLink, relaunchInvitation, busy } = useInvitationActions();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [relaunching, setRelaunching] = useState<string | null>(null);

  // Invités en attente (invitation non encore acceptée).
  const pending = useEntityMembers(entity, { isInviting: true });

  if (!entity) {
    return <p className="text-muted-foreground">{t("AdminInvitation.noContext")}</p>;
  }

  const onRelaunch = async (userId: string) => {
    setRelaunching(userId);
    await relaunchInvitation(userId);
    setRelaunching(null);
  };

  return (
    <div className="space-y-6">
      {/* Liens partageables */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" aria-hidden />
            {t("AdminInvitation.shareLinks")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("AdminInvitation.shareLinksHint")}</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" disabled={busy} onClick={() => generateInvitationLink(false)}>
              <Users className="mr-2 h-4 w-4" aria-hidden />
              {t("AdminInvitation.copyMemberLink")}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => generateInvitationLink(true)}>
              <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />
              {t("AdminInvitation.copyAdminLink")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Inviter par email + liste des invités en attente */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" aria-hidden />
            {t("AdminInvitation.pendingTitle")}
          </CardTitle>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" aria-hidden />
            {t("AdminInvitation.invite")}
          </Button>
        </CardHeader>
        <CardContent>
          {pending.isLoading ? (
            <p className="text-muted-foreground">{t("AdminInvitation.loading")}</p>
          ) : pending.members.length === 0 ? (
            <p className="text-muted-foreground">{t("AdminInvitation.pendingEmpty")}</p>
          ) : (
            <ul className="divide-y">
              {pending.members.map((member) => {
                const m = member as { id?: string | null; name?: string; serverData?: { email?: string } };
                const id = String(m.id ?? "");
                const email = m.serverData?.email;
                return (
                  <li key={id} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.name || email || id}</p>
                      {email && <p className="truncate text-sm text-muted-foreground">{email}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy || relaunching === id || !id}
                      onClick={() => onRelaunch(id)}
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${relaunching === id ? "animate-spin" : ""}`} aria-hidden />
                      {t("AdminInvitation.relaunch")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <InviteMemberDialog entity={entity} open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
