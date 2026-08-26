import type { CoFormData, AllStepsData } from "@/modules/coform";
import type { AacResolvedConfig } from "../../types";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useState, useRef, useLayoutEffect } from "react";
import { Layers } from "lucide-react";
import { ProseContent } from "@/components/shared/ProseContent";

interface CommunHeroProps {
    formData: CoFormData;
    answerData: AllStepsData | null;
    aacConfig: AacResolvedConfig | null;
    /**
     * Nom de l'appel à communs où ce commun a été DÉPOSÉ — renseigné uniquement
     * quand ce n'est pas celui d'ici. Provenance, donc métadonnée du commun :
     * sa place est au-dessus du titre, avec les mots-clés, et non dans la barre
     * d'actions où elle s'intercalait entre deux boutons.
     */
    depositedOnName?: string | null;
}

export function CommunHero({formData: _formData, answerData, aacConfig, depositedOnName}: CommunHeroProps) {
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
    // Conteneur (et non <p>) : le markdown rendu produit des blocs, qui ne
    // peuvent pas être imbriqués dans un paragraphe. Le clamp et la mesure de
    // débordement portent sur ce conteneur, à l'identique.
    const textRef = useRef<HTMLDivElement>(null);

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
            {depositedOnName ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Layers className="size-3.5 shrink-0" />
                    {String(t("detail.origin.deposedOn", undefined, { name: depositedOnName }))}
                </p>
            ) : null}

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
            <div
                className={`text-lg text-muted-foreground max-w-[60ch] leading-relaxed mb-0 ${
                    !isExpanded ? 'line-clamp-3' : ''
                }`}
                ref={textRef}
            >
                {/* `description` est un textarea du coform, donc saisi avec
                    l'éditeur markdown : on l'interprète au lieu de l'afficher
                    tel quel. Même rendu — et même sanitisation — que les
                    champs du formulaire. */}
                <ProseContent
                    text={String(longDesc)}
                    className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                />
            </div>
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