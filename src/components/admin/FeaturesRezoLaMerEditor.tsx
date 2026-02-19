import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2 } from "lucide-react";
import type { FeaturesRezoLaMerProps } from "@/types/site-schema";

const COLOR_OPTIONS = [
  { value: "turquoise", label: "Turquoise" },
  { value: "cyan-bright", label: "Cyan Bright" },
  { value: "primary", label: "Primary" },
  { value: "turquoise-light", label: "Turquoise Light" },
] as const;

interface Props {
  props: FeaturesRezoLaMerProps;
  onChange: (newProps: FeaturesRezoLaMerProps) => void;
}

export function FeaturesRezoLaMerEditor({ props, onChange }: Props) {
  function updateHeadline(value: string) {
    onChange({ ...props, headline: { ...props.headline, fr: value } });
  }

  function updateSubhead(value: string) {
    onChange({
      ...props,
      subhead: value ? { ...(props.subhead ?? {}), fr: value } : undefined,
    });
  }

  function updateFeature(
    idx: number,
    field: string,
    value: string | undefined
  ) {
    const features = props.features.map((f, i) => {
      if (i !== idx) return f;
      if (field === "icon") return { ...f, icon: value as string };
      if (field === "title.fr")
        return { ...f, title: { ...f.title, fr: value as string } };
      if (field === "description.fr")
        return {
          ...f,
          description: { ...f.description, fr: value as string },
        };
      if (field === "color")
        return {
          ...f,
          color: value as FeaturesRezoLaMerProps["features"][0]["color"],
        };
      return f;
    });
    onChange({ ...props, features });
  }

  function addFeature() {
    onChange({
      ...props,
      features: [
        ...props.features,
        {
          icon: "Star",
          title: { fr: "Nouvelle feature" },
          description: { fr: "Description" },
        },
      ],
    });
  }

  function removeFeature(idx: number) {
    onChange({
      ...props,
      features: props.features.filter((_, i) => i !== idx),
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Headline (fr)</Label>
        <Input
          value={props.headline.fr ?? ""}
          onChange={(e) => updateHeadline(e.target.value)}
          placeholder="Titre principal"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Sous-titre (fr)</Label>
        <Input
          value={props.subhead?.fr ?? ""}
          onChange={(e) => updateSubhead(e.target.value)}
          placeholder="Sous-titre optionnel"
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">
            Features ({props.features.length})
          </Label>
          <Button size="sm" variant="outline" onClick={addFeature}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ajouter
          </Button>
        </div>

        {props.features.map((feature, idx) => (
          <div
            key={idx}
            className="p-3 border rounded-md space-y-2 bg-muted/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Feature {idx + 1}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => removeFeature(idx)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Icône</Label>
              <Input
                value={feature.icon}
                onChange={(e) => updateFeature(idx, "icon", e.target.value)}
                placeholder="Nom de l'icône (ex: Star)"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Titre (fr)</Label>
              <Input
                value={feature.title.fr ?? ""}
                onChange={(e) =>
                  updateFeature(idx, "title.fr", e.target.value)
                }
                placeholder="Titre"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description (fr)</Label>
              <Input
                value={feature.description.fr ?? ""}
                onChange={(e) =>
                  updateFeature(idx, "description.fr", e.target.value)
                }
                placeholder="Description"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Couleur</Label>
              <Select
                value={feature.color ?? ""}
                onValueChange={(v) =>
                  updateFeature(idx, "color", v || undefined)
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Aucune" />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
