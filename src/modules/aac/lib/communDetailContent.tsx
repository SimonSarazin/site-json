import type { ElementType } from "react";
import { FileText } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";

import type { CoFormAnswer, AnswerDocumentFile } from "@/modules/coform/types";
import type { GalleryImage } from "../components/pageDetail/CommunContentSections.tsx";
import type { AacDetailSection } from "./resolveAacDetailSections";

/** Contenu de la fiche lu dans la réponse (fonctions pures), partagé par toutes les interfaces. */

/** @param subKey `subKey` des documents de galerie, déclaré par le site. */
export function extractGalleryImages(
    documents: CoFormAnswer["documents"],
    baseUrl: string,
    subKey: string | null
): GalleryImage[] {
    if (!subKey) return [];

    const list: AnswerDocumentFile[] = Array.isArray(documents)
        ? documents
        : documents
            ? Object.values(documents)
            : [];

    return list
        .filter((doc) => doc?.subKey === subKey && doc?.name)
        .map((doc) => ({
            src: `${baseUrl}/upload/${doc.moduleId}/${doc.folder}/${doc.name}`,
            alt: doc.name,
        }));
}

/** Icône d'un bloc déclaré ; `FileText` si le nom est absent, inconnu ou en cours de chargement. */
export function iconFor(name?: string): ElementType {
    if (!name) return FileText;
    return ({ className }: { className?: string }) => (
        <DynamicIcon
            name={name as IconName}
            className={className}
            fallback={() => <FileText className={className} />}
        />
    );
}

/** Paragraphes d'un bloc, lus par sa référence résolue ; `[]` si la réponse ne porte rien. */
export function proseOf(answer: CoFormAnswer | undefined, section: AacDetailSection): string[] {
    const brut = section.field.stepKey
        ? (answer?.answers as Record<string, Record<string, unknown>> | undefined)
              ?.[section.field.stepKey]?.[section.field.id]
        : (answer as Record<string, unknown> | undefined)?.[section.field.id];

    if (Array.isArray(brut)) return brut.map(String).filter((p) => p.trim() !== "");
    const texte = brut == null ? "" : String(brut);
    return texte.trim() === "" ? [] : [texte];
}
