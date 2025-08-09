import { useEffect } from "react";
import { useSite } from "@/hooks/useSite";

export function IntegrationsLoader() {
  const { config } = useSite();

  useEffect(() => {
    const integrations = config.integrations;
    if (!integrations) return;

    if (
      integrations.analytics?.provider === "ga4" &&
      integrations.analytics.id
    ) {
      const ga = document.createElement("script");
      ga.src = `https://www.googletagmanager.com/gtag/js?id=${integrations.analytics.id}`;
      ga.async = true;
      document.head.appendChild(ga);
      const inline = document.createElement("script");
      inline.innerHTML = `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${integrations.analytics.id}');`;
      document.head.appendChild(inline);
    }

    if (integrations.chat?.provider === "intercom" && integrations.chat.id) {
      const chat = document.createElement("script");
      chat.src = `https://widget.intercom.io/widget/${integrations.chat.id}`;
      chat.async = true;
      document.head.appendChild(chat);
    }

    integrations.scripts?.forEach((tag) => {
      const s = document.createElement("script");
      s.src = tag.src;
      if (tag.async) s.async = true;
      if (tag.defer) s.defer = true;
      (tag.position === "body" ? document.body : document.head).appendChild(s);
    });
  }, [config.integrations]);

  return null;
}
