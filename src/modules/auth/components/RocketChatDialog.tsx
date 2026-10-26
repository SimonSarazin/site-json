import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/useT";

interface RocketChatDialogProps {
  url: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal « Chat » (entrée `AuthMenu`, admins uniquement) : embarque le chat de la plateforme
 * (`platformRocketChatUrl`) dans un `<iframe>`, comme sur communecter — plutôt qu'un nouvel onglet.
 * Skeleton jusqu'au `onLoad` de l'iframe (session SSO + Rocket.Chat peuvent prendre une seconde).
 */
export default function RocketChatDialog({ url, open, onOpenChange }: RocketChatDialogProps) {
  const t = useT("components/layout");
  const [loaded, setLoaded] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setLoaded(false); // réouverture = iframe fraîche, pas le spinner figé sur l'ancienne session
      }}
    >
      <DialogContent className="flex h-[95vh] max-w-[calc(100%-1rem)] flex-col gap-3 p-4 sm:max-w-[calc(100%-2rem)] lg:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{t("Chat")}</DialogTitle>
        </DialogHeader>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border">
          {!loaded && <Skeleton className="absolute inset-0" />}
          <iframe
            src={url}
            title={t("Chat")}
            className="h-full w-full border-0"
            onLoad={() => setLoaded(true)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
