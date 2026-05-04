import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MessageSquare, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/useT";
import { useInteropConfig } from "../hooks/useInteropConfigQuery";
import { useDiscourseLink } from "../hooks/useInteropMutation";
import "../i18n";

const schema = z.object({
  username: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export default function DiscourseLink() {
  const t = useT("modules/interop");
  const { discourseUrl } = useInteropConfig();

  const linkMutation = useDiscourseLink();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "" }
  });

  const onSubmit = (values: FormValues) => {
    linkMutation.mutate(values.username);
  };

  const exampleUrl = discourseUrl ? `${discourseUrl}/u/` : "https://forum.example.io/u/";

  return (
    <div className="rounded-lg overflow-hidden border border-border">
        {/* Header */}
        <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 shrink-0" />
          <span className="font-bold uppercase tracking-wide text-sm">
            {t("discourse.title")}
          </span>
        </div>

        {/* Body */}
        <div className="bg-card p-4">
          <p
            className="text-sm text-foreground mb-3"
            dangerouslySetInnerHTML={{
              __html: t("discourse.link_description"),
            }}
          />

          <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(onSubmit)(e); }}>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    {...register("username")}
                    placeholder={t("discourse.username_placeholder")}
                    disabled={linkMutation.isPending}
                  />
                  {errors.username && (
                    <p className="text-xs text-destructive mt-1">{errors.username.message}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={linkMutation.isPending}
                  className="shrink-0 self-start"
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  {t("discourse.link_account")}
                </Button>
              </div>

              <p
                className="text-xs text-muted-foreground mt-2"
                dangerouslySetInnerHTML={{
                  __html: t("discourse.username_hint", undefined, { url: exampleUrl }),
                }}
              />

              {linkMutation.data?.error && (
                <p className="text-xs text-destructive mt-2">{linkMutation.data.error}</p>
              )}
              {linkMutation.isError && (
                <p className="text-xs text-destructive mt-2">
                  {(linkMutation.error as Error)?.message ?? t("discourse.link_error")}
                </p>
              )}
            </form>
        </div>
      </div>
  );
}
