import {
  Card,
  CardContent,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "site-forge";

// Autoplay OFF (aucun plugin embla) : capture déterministe sur la position 0.
// Les flèches Previous/Next sont positionnées à -3rem hors du rail → padding
// horizontal sur le wrapper pour qu'elles restent dans la cellule.
// flexBasis en style inline : les utilitaires basis-1/3 & co n'existent pas
// dans le CSS compilé de l'app (Tailwind ne génère que les classes utilisées).

const ateliers = [
  { titre: "Café des parents", lieu: "Perpignan", teinte: "#dbeafe" },
  { titre: "Atelier portage", lieu: "Céret", teinte: "#dcfce7" },
  { titre: "Éveil musical", lieu: "Prades", teinte: "#fef3c7" },
  { titre: "Sortie nature", lieu: "Argelès", teinte: "#fce7f3" },
  { titre: "Groupe de parole", lieu: "Thuir", teinte: "#e0e7ff" },
];

export const PlusieursSlides = () => (
  <div style={{ padding: "0 3.5rem" }}>
    <Carousel opts={{ align: "start" }} className="w-full">
      <CarouselContent>
        {ateliers.map((a) => (
          <CarouselItem key={a.titre} style={{ flexBasis: "33.333%" }}>
            <Card>
              <CardContent className="flex flex-col gap-2 p-4">
                <div
                  className="h-16 w-full rounded-md"
                  style={{ backgroundColor: a.teinte }}
                />
                <p className="text-sm font-medium leading-tight">{a.titre}</p>
                <p className="text-xs text-muted-foreground">{a.lieu}</p>
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  </div>
);

export const SlideUnique = () => (
  <div style={{ padding: "0 3.5rem" }}>
    <Carousel className="w-full">
      <CarouselContent>
        {[
          "« Le café des parents m'a permis de sortir de l'isolement. » — Claire, Perpignan",
          "« Des ateliers concrets, sans jugement. » — Malik, Céret",
          "« On y trouve toujours une oreille attentive. » — Anne, Prades",
        ].map((citation) => (
          <CarouselItem key={citation}>
            <Card>
              <CardContent className="flex min-h-28 items-center justify-center p-6">
                <p className="text-center text-sm italic text-muted-foreground">{citation}</p>
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  </div>
);
