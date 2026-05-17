import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";

type EntityWithDiscourse = EntityTypes & {
  linkDiscourseAccount(username: string): Promise<{
    result: boolean;
    error?: string;
    username?: string;
    profileUrl?: string;
  }>;
  unlinkDiscourseAccount(): Promise<{ result: boolean; error?: string }>;
  checkDiscourseEmailMatch(): Promise<{
    found: boolean;
    user?: Record<string, unknown>;
  }>;
  dismissDiscourseLink(): Promise<{ result: boolean; error?: string }>;
};

function asDiscourseEntity(entity: EntityTypes): EntityWithDiscourse {
  return entity as EntityWithDiscourse;
}

export function useDiscourseLink() {
  const { entity, refreshMe } = useCocolight();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (username: string) => {
      if (!entity) throw new Error("No entity");
      return asDiscourseEntity(entity).linkDiscourseAccount(username);
    },
    onSuccess: () => {
      void refreshMe();
      queryClient.invalidateQueries({ queryKey: ["discourse-profil"] });
    }
  });
}

export function useDiscourseUnlink() {
  const { entity, refreshMe } = useCocolight();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!entity) throw new Error("No entity");
      return asDiscourseEntity(entity).unlinkDiscourseAccount();
    },
    onSuccess: () => {
      void refreshMe();
      queryClient.invalidateQueries({ queryKey: ["discourse-profil"] });
    },
  });
}

/**
 * @unused Pas de consommateur dans le repo au 2026-05-17. Conservé pour usage futur prévu
 * (auto-suggestion de liaison Discourse si l'email du user correspond à un compte existant).
 */
export function useDiscourseCheckEmail() {
  const { entity } = useCocolight();

  return useMutation({
    mutationFn: async () => {
      if (!entity) throw new Error("No entity");
      return asDiscourseEntity(entity).checkDiscourseEmailMatch();
    },
  });
}

export function useDiscourseDismiss() {
  const { entity, refreshMe } = useCocolight();

  return useMutation({
    mutationFn: async () => {
      if (!entity) throw new Error("No entity");
      return asDiscourseEntity(entity).dismissDiscourseLink();
    },
    onSuccess: () => {
      void refreshMe();
    },
  });
}

/* ------------------------------------------------------------------ */
/* MediaWiki                                                            */
/* ------------------------------------------------------------------ */

type EntityWithMediawiki = EntityTypes & {
  linkMediaWikiAccount(username: string): Promise<{
    result: boolean;
    error?: string;
    username?: string;
    msg?: string;
  }>;
  unlinkMediaWikiAccount(): Promise<{ result: boolean; error?: string; msg?: string }>;
};

function asMediawikiEntity(entity: EntityTypes): EntityWithMediawiki {
  return entity as EntityWithMediawiki;
}

export function useMediawikiLink() {
  const { entity, refreshMe } = useCocolight();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (username: string) => {
      if (!entity) throw new Error("No entity");
      return asMediawikiEntity(entity).linkMediaWikiAccount(username);
    },
    onSuccess: () => {
      void refreshMe();
      queryClient.invalidateQueries({ queryKey: ["mediawiki-contribs"] });
    },
  });
}

export function useMediawikiUnlink() {
  const { entity, refreshMe } = useCocolight();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!entity) throw new Error("No entity");
      return asMediawikiEntity(entity).unlinkMediaWikiAccount();
    },
    onSuccess: () => {
      void refreshMe();
      queryClient.invalidateQueries({ queryKey: ["mediawiki-contribs"] });
    },
  });
}
