import { VideoSection } from "site-forge";

// Embed YouTube 16/9 (usage réel : page /showcase). Hors-ligne l'iframe ne
// peint rien : le cadre arrondi sur fond de section doit rester visible.
export const EmbedYoutube = () => (
  <VideoSection
    props={{
      provider: "youtube",
      src: "jNQXAC9IVRw",
      ratio: "16/9",
      controls: true,
      loop: false,
    }}
  />
);

// Vidéo locale 4/3 avec contrôles natifs (chemin public du site).
export const VideoLocale = () => (
  <VideoSection
    props={{
      provider: "local",
      src: "/videos/presentation-reseau.mp4",
      ratio: "4/3",
      controls: true,
      loop: false,
    }}
  />
);
