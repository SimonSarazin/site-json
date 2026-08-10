import type { CoFormData, AllStepsData } from "@/modules/coform";
import type { AacResolvedConfig } from "../../types";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useState, useRef, useLayoutEffect } from "react";

interface CommunHeroProps {
    formData: CoFormData;
    answerData: AllStepsData | null;
    aacConfig: AacResolvedConfig | null;
}

export function CommunHero({formData, answerData, aacConfig}: CommunHeroProps) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");

    const depenseStepKey = aacConfig?.steps?.[0]?.key || "aapStep1";
    const rawTitle = answerData?.[depenseStepKey]?.titre;
    const title = rawTitle ? String(rawTitle) : t("detail.noname");
    const keywords = answerData?.[depenseStepKey]?.aapStep1m03ot9qymmfgashp7l || [];
    const tags = answerData?.[depenseStepKey]?.tags || [];
    const shortDesc = answerData?.[depenseStepKey]?.aapStep1lzi62x3etw49gyc424d || t("detail.noShortDesc");
    const longDesc = answerData?.[depenseStepKey]?.description || t("detail.nodesc");
    const [isExpanded, setIsExpanded] = useState(false);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const textRef = useRef<HTMLParagraphElement>(null);

    useLayoutEffect(() => {
        const element = textRef.current;
        if (!element) return;

        const checkOverflow = () => {
            setIsOverflowing(prev => prev || element.scrollHeight > element.clientHeight);
        };

        checkOverflow();
        const resizeObserver = new ResizeObserver(checkOverflow);
        resizeObserver.observe(element);
        return () => resizeObserver.disconnect();

        //requestAnimationFrame(checkOverflow);
    }, [longDesc, isExpanded]);

    return (
        <div className="lg:col-span-7 space-y-6 border-b pb-4">
            <div className="flex flex-wrap gap-2">
                {Array.isArray(keywords) ? keywords.map(keyword => (
                    <span className="px-2 py-1 text-[10px] font-bold tracking-widest uppercase border border-border text-muted-foreground rounded-sm">
                        {String(keyword)} 
                    </span>
                )) : null}
            </div>

            <h1 className="text-4xl font-display font-bold leading-[0.98] tracking-tight text-balance">
                {title}
            <span className="block text-muted-foreground font-medium mt-2 text-2xl md:text-2xl">
                {String(shortDesc)}
            </span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-[60ch] leading-relaxed">
                {Array.isArray(tags) ? tags.map(tag => "#"+tag).join(" "): ""}
            </p>
            <p 
                className={`text-lg text-muted-foreground max-w-[60ch] leading-relaxed mb-0 ${
                    !isExpanded ? 'line-clamp-3' : ''
                }`}
                ref={textRef}
            >
                {String(longDesc)}
            </p>
            {isOverflowing && (
                    <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors focus:outline-none"
                    >
                    {isExpanded ? String(t("detail.showLess")) : String(t("detail.showMore"))}
                    </button>
                )}
        </div>
    );
}