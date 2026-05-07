type ConfettiOptions = {
  count?: number;
  spread?: number;
  originX?: number;
  originY?: number;
  durationMs?: number;
  colors?: string[];
};

const DEFAULT_COLORS = ["#0ea5e9", "#14b8a6", "#22c55e", "#f59e0b", "#f43f5e", "#a855f7"];

export function launchConfettiBurst(options: ConfettiOptions = {}): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const {
    count = 28,
    spread = 72,
    originX = 0.5,
    originY = 0.38,
    durationMs = 1800,
    colors = DEFAULT_COLORS,
  } = options;

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    overflow: "hidden",
    zIndex: "9999",
  } as Partial<CSSStyleDeclaration>);

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const baseX = Math.max(0, Math.min(1, originX)) * viewportWidth;
  const baseY = Math.max(0, Math.min(1, originY)) * viewportHeight;

  const pieces = Array.from({ length: Math.max(1, count) }, (_, index) => index);

  pieces.forEach((index) => {
    const piece = document.createElement("span");
    const size = 6 + Math.random() * 6;
    const angle = (Math.PI * 2 * index) / pieces.length + (Math.random() - 0.5) * 0.6;
    const distance = spread * (8 + Math.random() * 4);
    const driftX = Math.cos(angle) * distance * (0.75 + Math.random() * 0.5);
    const driftY = -Math.abs(Math.sin(angle) * distance) - 120 - Math.random() * 160;
    const rotate = 360 + Math.random() * 720;
    const color = colors[index % colors.length];
    const borderRadius = Math.random() > 0.65 ? "999px" : "2px";
    const opacity = 0.85 + Math.random() * 0.15;

    Object.assign(piece.style, {
      position: "absolute",
      left: `${baseX}px`,
      top: `${baseY}px`,
      width: `${size}px`,
      height: `${size * (0.8 + Math.random() * 0.4)}px`,
      backgroundColor: color,
      borderRadius,
      boxShadow: "0 0 8px rgba(255,255,255,0.15)",
      opacity: String(opacity),
      transform: "translate3d(0, 0, 0) rotate(0deg)",
      willChange: "transform, opacity",
    } as Partial<CSSStyleDeclaration>);

    const animation = piece.animate(
      [
        { transform: "translate3d(0, 0, 0) rotate(0deg)", opacity },
        {
          transform: `translate3d(${driftX}px, ${driftY * 0.55}px, 0) rotate(${rotate * 0.45}deg)`,
          opacity: Math.max(0.8, opacity - 0.05),
        },
        {
          transform: `translate3d(${driftX * 1.1}px, ${driftY}px, 0) rotate(${rotate}deg)`,
          opacity: 0,
        },
      ],
      {
        duration: durationMs,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "forwards",
      }
    );

    animation.onfinish = () => piece.remove();
    host.appendChild(piece);
  });

  document.body.appendChild(host);
  window.setTimeout(() => host.remove(), durationMs + 120);
}

