import { useSite } from "@/hooks/useSite";
import { AuthPageLayout } from "../components/AuthPageLayout";
import { resolveAuthVariant } from "../components/variants/registry";

export default function RecoverPasswordPage() {
  const { config } = useSite();
  const { RecoverPasswordForm } = resolveAuthVariant(config.auth?.variant);

  return (
    <AuthPageLayout
      title={config.auth?.recover?.title}
      description={config.auth?.recover?.subtitle}
    >
      <RecoverPasswordForm />
    </AuthPageLayout>
  );
}
