import { writeFileSync } from "node:fs";
import { demoSiteConfig }   from "../src/data/demo-site";   // ajuste le chemin !

writeFileSync(
  "config.prod.json",
  JSON.stringify(demoSiteConfig, null, 2),   // indentation 2 espaces
  "utf-8"
);

console.log("✅  Fichier config.prod.json généré.");