import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import { useSite } from "@/hooks/useSite";

type Position = "bottom-right" | "bottom-left" | "top-right" | "top-left";

interface FloatingQRCodeProps {
  url?: string;
  position?: Position;
  size?: number;
  expandedSize?: number;
  includeFavicon?: boolean;
  bgColor?: string;
  fgColor?: string;
}

const positionClasses: Record<Position, string> = {
  "bottom-right": "bottom-6 right-6",
  "bottom-left": "bottom-6 left-6",
  "top-right": "top-6 right-6",
  "top-left": "top-6 left-6",
};

export function FloatingQRCode({
  url = "https://example.com",
  position = "bottom-right",
  size = 80,
  expandedSize = 200,
  includeFavicon = true,
  bgColor = "#ffffff",
  fgColor = "#000000",
}: FloatingQRCodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { config } = useSite();

  const favicon = config?.meta?.favicon;

  const currentSize = isExpanded ? expandedSize : size;

  const handleClick = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className={cn(
        "fixed z-50 transition-all duration-300 ease-in-out cursor-pointer group",
        positionClasses[position]
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onClick={handleClick}
      style={{
        width: currentSize,
        height: currentSize,
      }}
    >
      <div
        className={cn(
          "relative w-full h-full rounded-2xl overflow-hidden",
          "shadow-lg hover:shadow-2xl transition-shadow duration-300",
          "bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700",
          "hover:border-primary/50 dark:hover:border-primary/50"
        )}
      >
        <div className="w-full h-full p-2 flex items-center justify-center">
          <QRCodeSVG
            value={url}
            size={currentSize - 16}
            bgColor={bgColor}
            fgColor={fgColor}
            level="H"
            includeMargin={false}
            imageSettings={
              includeFavicon && favicon
                ? {
                    src: favicon,
                    x: undefined,
                    y: undefined,
                    height: currentSize * 0.2,
                    width: currentSize * 0.2,
                    excavate: true,
                  }
                : undefined
            }
          />
        </div>

        <div
          className={cn(
            "absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent",
            "text-white text-xs text-center py-1 px-2",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
            "pointer-events-none"
          )}
        >
          Cliquer pour ouvrir
        </div>
      </div>

      <div
        className={cn(
          "absolute inset-0 rounded-2xl border-2 border-primary",
          "animate-ping opacity-20",
          isExpanded ? "opacity-0" : "opacity-20"
        )}
      />
    </div>
  );
}
