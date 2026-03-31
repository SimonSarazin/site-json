import { LocalizedString } from "@/types/locale-schema";
import z from "zod";

export const AmpliLayoutVariantSchema = z.enum(["default", "modern", "compact", "fullwidth"]);
export const AmpliConfigSchema = z.object({
    layout: AmpliLayoutVariantSchema.optional().default("default"),
    seo: z.object({
        titleTemplate: z.string().optional(),
        descriptionTemplate: z.string().optional(),
    }).optional(),
    slug: z.string().min(1),
    props: z.object({
        coform: z.string().min(1),
        path: z.object({
            name: z.string().min(1),
            description: z.string().optional(),
            address: z.string().min(1),
            image: z.string().optional(),
            finder: z.string().optional(),
            tags: z.string().optional(),
        }),
        hero: z.object({
            headline: LocalizedString.optional(),
            subhead: LocalizedString.optional(),
            icon: z.object({
                show: z.boolean().default(true),
                name: z.string().optional(),
                size: z.number().default(64),
                backdrop: z.boolean().default(false),
            }),
            backgroundImage: z.string().optional(),
            videoBg: z.string().optional(),
            listContent: z.object({
                items: z.array(z.object({
                    title: LocalizedString,
                    icon: z.string().optional(),
                    iconPosition: z.enum(["left", "right", "top", "bottom"]).default("left"),
                })),
                layout: z.enum(["rows", "columns"]).default("columns"),
            }).optional(),
        }).optional(),
        intro: z.object({
            headline: LocalizedString.optional(),
            subhead: LocalizedString.optional(),
            items: z.array(z.object({
                title: LocalizedString.optional(),
                text: LocalizedString.optional(),
                icon: z.string().optional(),
            })),
        }).optional(),
        features: z.object({
            headline: LocalizedString.optional(),
            subhead: LocalizedString.optional(),
            button: LocalizedString.optional(),
            summary: z.object({
                headline: LocalizedString.optional(),
                submitted: LocalizedString.optional(),
                members: LocalizedString.optional(),
                amplified: LocalizedString.optional(),
                comments: LocalizedString.optional(),
            }).optional(),
            howItWork: z.object({
                headline: LocalizedString.optional(),
                stepOne: LocalizedString.optional(),
                stepTwo: LocalizedString.optional(),
                stepThree: LocalizedString.optional(),
            }).optional(),
        }).optional(),
        message: z.object({
            headline: LocalizedString.optional(),
            subhead: LocalizedString.optional()
        }).optional(),
        community: z.object({
            headline: LocalizedString.optional(),
            subhead: LocalizedString.optional()
        }).optional(),
        dashboard: z.object({
            headline: LocalizedString.optional(),
            subhead: LocalizedString.optional()
        }).optional(),
        news: z.object({
            headline: LocalizedString.optional(),
            subhead: LocalizedString.optional()
        }).optional(),
    }),
});

export type AmpliConfig = z.infer<typeof AmpliConfigSchema>;