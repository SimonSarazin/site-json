import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "site-forge";

// Deux panneaux horizontaux avec poignée visible (withHandle) : liste / carte.
export const ListeEtCarte = () => (
  <div className="rounded-lg border" style={{ height: 190, maxWidth: 440 }}>
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={40}>
        <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <span className="text-sm font-medium">Annuaire (47 lieux)</span>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={60}>
        <div className="bg-muted/50" style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <span className="text-sm text-muted-foreground">Carte du Pas-de-Calais</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
);

// Trois panneaux imbriqués (horizontal + vertical) : mise en page atelier.
export const TroisPanneaux = () => (
  <div className="rounded-lg border" style={{ height: 220, maxWidth: 440 }}>
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={35}>
        <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <span className="text-sm font-medium">Programme</span>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={65}>
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel defaultSize={55}>
            <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", padding: 16 }}>
              <span className="text-sm font-medium">Atelier « Parents d'ados »</span>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={45}>
            <div className="bg-muted/50" style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", padding: 16 }}>
              <span className="text-sm text-muted-foreground">Notes de l'animatrice</span>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
);
