import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BookOpen, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/useT";
import { useInteropConfig } from "../hooks/useInteropConfigQuery";
import { useMediawikiLink } from "../hooks/useInteropMutation";
import "../i18n";

const schema = z.object({
  username: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

const MediawikiLink = () => {
  const t = useT("modules/interop");
  const { wikiBaseUrl } = useInteropConfig();
  const linkMutation = useMediawikiLink();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "" },
  });

  const onSubmit = (values: FormValues) => {
    linkMutation.mutate(values.username);
  };

  const exampleUrl = wikiBaseUrl
    ? `${wikiBaseUrl}/wiki/Special:Contributions/`
    : "https://wiki.example.org/wiki/Special:Contributions/";

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-2">
        <BookOpen className="h-5 w-5 shrink-0" />
        <span className="font-bold uppercase tracking-wide text-sm">
          {t("wiki.title")}
        </span>
      </div>

      {/* Body */}
      <div className="bg-card p-4">
        <p
          className="text-sm text-foreground mb-3"
          dangerouslySetInnerHTML={{ __html: t("wiki.link_description") }}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit(onSubmit)(e);
          }}
        >
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                {...register("username")}
                placeholder={t("wiki.username_placeholder")}
                disabled={linkMutation.isPending}
              />
              {errors.username && (
                <p className="text-xs text-destructive mt-1">
                  {errors.username.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              disabled={linkMutation.isPending}
              className="shrink-0 self-start"
            >
              <Link2 className="h-4 w-4 mr-2" />
              {t("wiki.link_account")}
            </Button>
          </div>

          <p
            className="text-xs text-muted-foreground mt-2"
            dangerouslySetInnerHTML={{
              __html: t("wiki.username_hint", undefined, { url: exampleUrl }),
            }}
          />

          {linkMutation.data?.error && (
            <p className="text-xs text-destructive mt-2">
              {linkMutation.data.error}
            </p>
          )}
          {linkMutation.isError && (
            <p className="text-xs text-destructive mt-2">
              {(linkMutation.error as Error)?.message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default MediawikiLink;
