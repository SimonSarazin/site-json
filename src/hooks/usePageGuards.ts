import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useCocolight } from "./useCocolight";
import type { Page } from "@/types/site";
import type { User } from "@communecter/cocolight-api-client";

const registry: Record<
  string,
  (args: { me: User | null; navigate: (path: string) => void }) => void
> = {
  "auth-required": ({ me, navigate }) => {
    if (!me?.isConnected) navigate("/login");
  },
  "admin-only": ({ me, navigate }) => {
    if (!me?.serverData?.roles?.["admin"]) navigate("/");
  },
  "redirect-if-authenticated": ({ me, navigate }) => {
    if (me?.isConnected) navigate("/");
  },
};

export function usePageGuards(page: Page) {
  const { me, loading } = useCocolight();
  const navigate = useNavigate();

  useEffect(() => {
    if (!page || loading) return;
    if (page.auth?.required && !me?.isConnected) {
      navigate("/login");
      return;
    }
    if (
      page.auth?.roles &&
      !page.auth.roles.some((r) => me?.serverData?.roles?.[r] === true)
    ) {
      navigate("/");
      return;
    }
    page.middleware?.forEach((mw) => {
      registry[mw]?.({ me, navigate });
    });
  }, [page, me, loading, navigate]);
}
