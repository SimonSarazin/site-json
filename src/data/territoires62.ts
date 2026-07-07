/**
 * Référentiel des territoires du Réseau Parentalité 62 (CDC parent62).
 *
 * Source unique consommée par : les options de filtre territoire (config
 * `/recherche`), le code couleur carte/cartes (`colorBy`/`tagColors`), le
 * formulaire « Parole » et les pages `/territoire/<slug>`.
 *
 * ⚠️ **Le territoire n'est PAS un tag** : il vit dans le champ POI
 * `territoires` (tableau de LIBELLÉS — `label` ci-dessous), aux côtés de
 * `publics` et `themes`. C'est la convention du costum `parent62` (cf.
 * `organizations.costum.lists` et `doc/33-projet-parent62.md`) : les 6 434
 * articles importés la portent déjà.
 *
 * Slugs et libellés alignés sur les 9 comités locaux du WordPress
 * parent62.org (menu « Territoires », relevé 17/07/2026) ; `label` est la
 * valeur EXACTE stockée en base — toute divergence (accent, apostrophe)
 * ferait silencieusement remonter 0 résultat. `communes` = noms publiés dans
 * les PDF officiels « Liste des communes » (octobre 2020), importés via
 * `scripts/import-communes-territoires62.ts` — casse uniformisée mais
 * graphies conservées telles quelles (accents parfois absents des PDF en
 * majuscules) : corriger la donnée ici même si le réseau signale une erreur.
 * Les couleurs référencent les variables CSS `--territoire-*`
 * (`src/index-parent62.css`) — jamais d'hex dans les configs ; teintes reprises
 * de la carte du site historique.
 *
 * NB : `costum.lists.territoires` compte une 10ᵉ valeur, « Familles en sol
 * mineur » (générique, 43 articles), absente ici — arbitrage en attente.
 */

export interface Territoire62 {
  slug: string;
  label: string;
  /** Variable CSS de la couleur du territoire (suit light/dark). */
  color: string;
  /** Noms des communes du territoire (PDF officiels — affichage des pages territoire). */
  communes: string[];
}

export const TERRITOIRES_62: Territoire62[] = [
  {
    slug: "arrageois",
    label: "Arrageois",
    color: "var(--territoire-arrageois)",
    communes: [
      "Ablainzevelle", "Achicourt", "Achiet-le-Grand", "Achiet-le-Petit", "Acq", "Adinfer",
      "Agnez-lès-Duisans", "Agny", "Amplier", "Anzin-Saint-Aubin", "Arleux-en-Gohelle", "Arras",
      "Athies", "Avesnes-les-Bapaume", "Ayette", "Bailleul-Sire-Berthoult", "Bailleulmont", "Bailleulval",
      "Bancourt", "Bapaume", "Baralle", "Barastre", "Barly", "Basseux",
      "Bavincourt", "Beaudricourt", "Beaufort-Blavincourt", "Beaulencourt", "Beaumetz les Loges", "Beaumetz-les-Cambrai",
      "Beaurains", "Behagnies", "Bellonne", "Berles-au-Bois", "Berneville", "Bertencourt-le-Cauroy",
      "Bertincourt", "Beugnatre", "Beugny", "Biache-Saint-Vaast", "Biefvillers-les-Bapaume", "Bienvillers-au-Bois",
      "Bihucourt", "Blairville", "Boiry-Becquerelle", "Boiry-Notre-Dame", "Boiry-Saint-Martin", "Boiry-Sainte-Rictrude",
      "Boisleux au Mont", "Boisleux-Saint-Marc", "Bourlon", "Boyelles", "Brebieres", "Bucquoy",
      "Buissy", "Bullecourt", "Bus", "Cagnicourt", "Canettemont", "Cherisy",
      "Corbehem", "Couin", "Coullemont", "Courcelles-le-Comte", "Croisilles", "Dainville",
      "Denier", "Douchy-les-Ayette", "Duisans", "Dury", "Écourt-Saint-Quentin", "Écoust-Saint-Mein",
      "Écurie", "Épinoy", "Ervillers", "Estree-Wamin", "Étaing", "Éterpigny",
      "Étrun", "Famechon", "Fampoux", "Farbus", "Favreuil", "Feuchy",
      "Ficheux", "Foncquevillers", "Fontaine-les-Croisilles", "Fosseux", "Fremicourt", "Fresnes-les-Montauban",
      "Fresnoy-en-Gohelle", "Gaudiempre", "Gavrelle", "Givenchy-le-Noble", "Gomiecourt", "Gommecourt",
      "Gouves", "Gouy-en-Artois", "Gouy-sous-Bellonne", "Graincourt-les-Havrincourt", "Grand-Rullecourt", "Grevillers",
      "Grincourt-les-Pas", "Guemappe", "Habarcq", "Hally", "Hamblain-les-Pres", "Hamelincourt",
      "Hannescamp", "Haplincourt", "Haucourt", "Haudecourt-les-Rensart", "Haute-Avesnes", "Hauteville",
      "Havrincourt", "Hebuterne", "Hendecourt-les-Cagnicourt", "Henin sur Cojeul", "Heninel", "Henu",
      "Hermies", "Houvin-Houvigneul", "Humbercamps", "Inchy-en-Artois", "Ivergny", "Izel-les-Équerchin",
      "La Cauchie", "Lagnicourt-Marcel", "Latter-Saint-Quentin", "Le Sars", "Le Souichet", "Le Transloy",
      "Lebucquiere", "Lechelle", "Liencourt", "Lignereuil", "Ligny-Thilloy", "Magnicourt-sur-Canche",
      "Marœuil", "Marquion", "Martinpuich", "Mercatel", "Metz-en-Couture", "Monchiet",
      "Monchy-au-Bois", "Monchy-le-Preux", "Mondicourt", "Mont-Saint-Éloi", "Montenescourt", "Morchies",
      "Morval", "Mory", "Moyenneville", "Neuville-Bourjonval", "Neuville-Saint-Vaast", "Neuville-Vitasse",
      "Neuvireuil", "Noreuil", "Noyelles-sous-Bellonne", "Noyellette", "Oisy-le-Verger", "Oppy",
      "Orville", "Palluel", "Pas-en-Artois", "Pelves", "Plouvain", "Pommera",
      "Pommier", "Pronville-en-Artois", "Puisieux", "Queant", "Quiery-la-Motte", "Ransart",
      "Rebreuviette", "Recourt", "Remy", "Riencourt-les-Bapaume", "Riencourt-les-Cagnicourt", "Riviere",
      "Roclincourt", "Rocquigny", "Rœux", "Rumaucourt", "Ruyaulcourt", "Sailly-au-Bois",
      "Sailly-en-Ostrevent", "Sains-les-Marquion", "Saint Martin sur Cojeul", "Saint-Amand", "Saint-Laurent-Blangy", "Saint-Léger",
      "Saint-Nicolas-Lez-Arras", "Sainte-Catherine", "Sapignies", "Sarton", "Sauchy-Cauchy", "Sauchy-Lestree",
      "Saudemont", "Saulty", "Simencourt", "Sombrin", "Souastre", "Sus-Saint-Leger",
      "Thelus", "Thievres", "Tilloy-les-Mofflaines", "Tortequesne", "Trescault", "Vaulx-Vraucourt",
      "Velu", "Villers-au-Flos", "Villers-les-Cagnicourt", "Vis-en-Artois", "Vitry-en-Artois", "Wailly",
      "Walrus", "Wancourt", "Wanquetin", "Warlencourt-Eaucourt", "Warlincourt-les-Pas", "Warluzel",
      "Willerval", "Ytres",
    ],
  },
  {
    slug: "artois",
    label: "Artois",
    color: "var(--territoire-artois)",
    communes: [
      "Allouagne", "Ames", "Amettes", "Annequin", "Annezin", "Auchy-au-Bois",
      "Auchy-les-Mines", "Béthune", "Beuvry", "Billy-Berclau", "Bourecq", "Burbure",
      "Busnes", "Calonne-sur-la-Lys", "Cambrin", "Chocques", "Cuinchy", "Douvrin",
      "Drouvin", "Ecquedecques", "Essars", "Ferfay", "Festubert", "Fleurbaix",
      "Fouquereuil", "Fouquières-les-Béthunes", "Ginvenchy-les-la-Bassée", "Gonnehem", "Haisnes", "Ham",
      "Hinges", "La Couture", "Labeuvrière", "Labourse", "Lapugnoy", "Laventie",
      "Lespesses", "Lestrem", "Lières", "Lillers", "Locon", "Lorgies",
      "Mont-Bernenchon", "Neuve Chapelle", "Noeux-les-Mines", "Norrent-Fontes", "Noyelles-les-Vermelles", "Oblinghem",
      "Richebourg", "Robecq", "Sailly-Labourse", "Sailly-sur-la-Lys", "Saint-Floris", "Saint-Venant",
      "Vaudricourt", "Vemelles", "Vendin-les-Béthune", "Verquigneul", "Verquin", "Vieille Chapelle",
      "Violaines", "Westrehem",
    ],
  },
  {
    slug: "audomarois",
    label: "Audomarois",
    color: "var(--territoire-audomarois)",
    communes: [
      "Acquin-Westbecourt", "Affringues", "Aire-sur-la-Lys", "Alquines", "Arques", "Audincthun",
      "Audrehem", "Avroult", "Bayenghem-les-Éperlecques", "Bayenghem-lès-Seninghem", "Beaumetz-les-Aire", "Bellinghem",
      "Blendecques", "Bléquin", "Boisdinghem", "Bomy", "Bonningues-les-Ardres", "Bouvelinghem",
      "Campagne-les-Wardrecques", "Clairmarais", "Clerques", "Clety", "Coulomby", "Coyecques",
      "Delettes", "Dennebrœucq", "Dohem", "Ecques", "Elnes", "Enquin-Lez-Guinegatte",
      "Éperlecques", "Erny-Saint-Julien", "Escœuilles", "Esquerdes", "Fauquembergues", "Febvin-Palfart",
      "Fléchin", "Hallines", "Haut-Loquin", "Helfaut", "Heuringhem", "Houlle",
      "Journy", "Laires", "Ledinghem", "Leulinghem", "Longuenesse", "Lumbres",
      "Mametz", "Mentque-Nortbecourt", "Merck-Saint-Lievin", "Moringhem", "Moulle", "Nielles-les-Blequin",
      "Nordausques", "Nort-Leulinghem", "Ouve-Wirquin", "Pihem", "Quelmes", "Quercamps",
      "Quiestède", "Racquinghem", "Rebergues", "Reclinghem", "Remilly-Wirquin", "Renty",
      "Roquetoire", "Saint-Augustin", "Saint-Martin-d'Hardinghem", "Saint-Martin-Lez-Tatinghem", "Saint-Omer", "Salperwick",
      "Seninghem", "Serques", "Setques", "Surques", "Therouanne", "Thiembronne",
      "Tilques", "Tournehem-sur-la-Hem", "Vaudringhem", "Wardrecques", "Wavrans-sur-l'Aa", "Wismes",
      "Wisques", "Wittes", "Wizernes", "Zouafques", "Zudausques",
    ],
  },
  {
    slug: "boulonnais",
    label: "Boulonnais",
    color: "var(--territoire-boulonnais)",
    communes: [
      "Alincthun", "Ambleteuse", "Audembert", "Audinghen", "Audresselles", "Baincthun",
      "Bazinghen", "Belle et Houllefort", "Bellebrune", "Beuvrequen", "Boulogne-sur-Mer", "Bournonville",
      "Brunembert", "Carly", "Colembert", "Condette", "Conteville-lès-Boulogne", "Courset",
      "Crémarest", "Dannes", "Desvres", "Doudeauville", "Echinghen", "Elinghen",
      "Equihen-Plage", "Ferques", "Halinghen", "Henneveux", "Hervelinghen", "Hesdigneul-lès-Boulogne",
      "Hesdin-l’Abbé", "Isques", "La Capelle-lès-Boulogne", "Lacres", "Landrethun-le-Nord", "Le Portel",
      "Le Wast", "Leubringhen", "Leulinghen-Bernes", "Longfossé", "Longueville", "Lottinghen",
      "Maninghen-Henne", "Marquise", "Menneville", "Nabringhen", "Nesles", "Neufchâtel-Hardelot",
      "Offrethun", "Outreau", "Pernes-lès-Boulogne", "Pittefaux", "Quesques", "Questrecques",
      "Réty", "Rinxent", "Saint Inglevert", "Saint Léonard", "Saint-Etienne-au-Mont", "Saint-Martin-Boulogne",
      "Saint-Martin-Choquel", "Samer", "Selles", "Senlecques", "Tardinghen", "Tingry",
      "Verlincthun", "Vieil-Moutier", "Wacquinghen", "Wierre-au-Bois", "Wierre-Effroy", "Wimereux",
      "Wimille", "Wirwignes", "Wissant",
    ],
  },
  {
    slug: "calaisis",
    label: "Calaisis",
    color: "var(--territoire-calaisis)",
    communes: [
      "Alembon", "Andres", "Ardres", "Audruicq", "Autingues", "Bainghen",
      "Balinghem", "Bonningues les Calais", "Bouquehault", "Boursin", "Bremes les Ardres", "Caffiers",
      "Calais", "Campagne les Guines", "Ccra Audruicq", "Coquelles", "Coulogne", "Escalles",
      "Fiennes", "Frethun", "Guemps", "Guines", "Hames Boucres", "Hardinghem",
      "Herbinghem", "Hermelinghen", "Hocquinghen", "Landrethun les Ardres", "Les Attaques", "Licques",
      "Louches", "Marck", "Muncq Nieurlet", "Nielles les Ardres", "Nielles les Calais", "Nortkerque",
      "Nouvelle Eglise", "Offekerque", "Oye Plage", "Peuplingues", "Pihen les Guines", "Polincove",
      "Recques sur Hem", "Rodelinghem", "Ruminghem", "Saint Folquin", "Saint Omer Capelle", "Saint Tricat",
      "Sainte Marie Kerque", "Sangatte", "Sanghen", "Vieille Eglise", "Zutkerque",
    ],
  },
  {
    slug: "entre-mer-et-terres",
    label: "Entre Mer et Terres",
    color: "var(--territoire-entre-mer-et-terres)",
    communes: [
      "Airon-Notre-Dame", "Airon-Saint-Vaast", "Aix-en-Ergny", "Aix-en-Issart", "Alette", "Ambricourt",
      "Attin", "Aubin-Saint-Vaast", "Auchy-lès-Hesdin", "Avesnes", "Avondance", "Azincourt",
      "Béalancourt", "Beaumerie-Saint-Martin", "Beaurainville", "Bécourt", "Berck-sur-Mer", "Bernieulles",
      "Beussent", "Beutin", "Bezinghem", "Bimont", "Blangy-sur-Ternoise", "Blingel",
      "Boisjean", "Boubers-lès-Hesmond", "Bouin-Plumoison", "Bourthes", "Brévillers", "Bréxent-Enocq",
      "Brimeux", "Buire-le-Sec", "Camiers", "Campagne-lès-Boulonnais", "Campagne-lès-Hesdin", "Campigneulles-les-Grandes",
      "Campigneulles-les-Petites", "Canlers", "Capelle-lès-Hesdin", "Caumont", "Cavron-Saint-Martin", "Chériennes",
      "Clenleu", "Colline-Beaumont", "Conchil-le-Temple", "Contes", "Cormont", "Coupelle-Neuve",
      "Coupelle-Vieille", "Crépy", "Créquy", "Cucq", "Douriez", "Eclimeux",
      "Ecuires", "Embry", "Enquin-sur-Baillons", "Ergny", "Estrée", "Estréelles",
      "Etaples", "Fillièvres", "Frencq", "Fresnoy", "Fressin", "Fruges",
      "Galametz", "Gouy-Saint-André", "Grigny", "Groffliers", "Guigny", "Guisy",
      "Herly", "Hesdin", "Hesmond", "Hézecques", "Hubersent", "Huby-Saint-Leu",
      "Hucqueliers", "Humbert", "Incourt", "Inxent", "La Caloterie", "La Loge",
      "La Madelaine-sous-Montreuil", "Labroye", "Le Faux", "Le Parcq", "Le Touquet-Paris-Plage", "Lebiez",
      "Lépine", "Lespinoy", "Loison-sur-Créquoise", "Longvilliers", "Lugy", "Maintenay",
      "Maisoncelle", "Maninghem", "Marant", "Marconne", "Marconnelle", "Marenla",
      "Maresquel-Ecquemicourt", "Maresville", "Marles-sur-Canche", "Matringhem", "Mencas", "Merlimont",
      "Moncavrel", "Montreuil", "Mouriez", "Nempont-Saint-Firmin", "Neulette", "Neuville-sous-Montreuil",
      "Noyelles-lès-Humières", "Offin", "Parenty", "Planques", "Preures", "Quilen",
      "Radinghem", "Rang-du-Fliers", "Raye-sur-Authie", "Recques-sur-Course", "Regnauville", "Rimboval",
      "Rollancourt", "Roussent", "Royon", "Ruisseauville", "Rumilly", "Saint Michel-sous-Bois",
      "Saint-Aubin", "Saint-Denoeux", "Saint-Georges", "Saint-Josse", "Saint-Rémy-au-Bois", "Sainte-Austreberthe",
      "Saulchoy", "Seins-lès-Fressin", "Sempy", "Senlis", "Sorrus", "Tigny-Noyelle",
      "Torcy", "Tortefontaine", "Tramecourt", "Tubersent", "Vacqueriette-Erquières", "Verchin",
      "Verchocq", "Verton", "Vieil-Hesdin", "Vincly", "Waben", "Wail",
      "Wailly-Beaucamp", "Wambercourt", "Wamin", "Wicquinghem", "Widehem", "Willeman",
      "Zoteux",
    ],
  },
  {
    slug: "fsm-henin-carvin",
    label: "Familles en sol mineur Hénin Carvin",
    color: "var(--territoire-fsm-henin-carvin)",
    communes: [
      "Bénifontaine", "Billy-Montigny", "Bois-Bernard", "Carvin", "Courcelles-les-Lens", "Courrières",
      "Dourges", "Drocourt", "Estevelles", "Evin-Malmaison", "Fouquières-les-Lens", "Harnes",
      "Hénin-Beaumont", "Hulluch", "Leforest", "Libercourt", "Meurchin", "Montigny-en-Gohelle",
      "Noyelles-Godault", "Noyelles-sous-Lens", "Oignies", "Pont à Vendin", "Rouvroy", "Vendin-le Vieil",
      "Wingles",
    ],
  },
  {
    slug: "fsm-lens-lievin",
    label: "Familles en sol mineur Lens Liévin",
    color: "var(--territoire-fsm-lens-lievin)",
    communes: [
      "Ablain-Saint-Nazaire", "Acheville", "Aix-Noulette", "Angres", "Annay-sous-Lens", "Avion",
      "Bouvigny-Boyeffles", "Bully-les-Mines", "Carency", "Eleu-Dit-Leauwette", "Givenchy-en-Gohelle", "Gouy-Servins",
      "Grenay", "Lens", "Liévin", "Loison-sous-Lens", "Loos-en-Gohelle", "Mazingarbe",
      "Sains-en-Gohelle", "Sallaumines", "Servins", "Souchez", "Villers-au-Bois", "Vimy",
    ],
  },
  {
    slug: "ternois-bruaysis",
    label: "Ternois Bruaysis",
    color: "var(--territoire-ternois-bruaysis)",
    communes: [
      "Agnieres", "Ambrines", "Anvin", "Aubigny en Artois", "Aubrometz", "Auchel",
      "Aumerval", "Auxi le Chateau", "Averdoingt", "Avesnes le Comte", "Bailleul aux Cornailles", "Bailleul les Pernes",
      "Bajus", "Barlin", "Beauvoir Wavrans", "Beauvois", "Bergueneuse", "Berles Monchel",
      "Bernicourt", "Bethonsart", "Beugin", "Blangerval Blangermont", "Blessy", "Boffles",
      "Bonnieres", "Boubers sur Canche", "Bouret sur Canche", "Bours", "Boyaval", "Brias",
      "Bruay la Buissiere", "Buire au Bois", "Buneville", "Calonne Ricouart", "Camblain Chatelain", "Camblain l’Abbe",
      "Cambligneul", "Canteleux", "Capelle Fermont", "Cauchy A la Tour", "Caucourt", "Chelers",
      "Conchy sur Canche", "Contreville", "Croisette", "Croix en Ternois", "Dieval", "Divion",
      "Ecoivres", "Eps", "Equirre", "Erin", "Estree Blanche", "Estree Cauchy",
      "Flefs", "Flers", "Fleury", "Floringhem", "Fontaine l’Etalon", "Fontaine les Boulans",
      "Fontaine les Hermans", "Fortel en Artois", "Foufflin Ricamets", "Framecourt", "Fresnicourt le Dolmen", "Frevent",
      "Frevillers", "Frevin Capelle", "Gauchin le Gal", "Gauchin Verloingt", "Gennes Ivergny", "Gosnay",
      "Gouy", "Guarbecque", "Guinecourt", "Haillicourt", "Haravesnes", "Hautecloque",
      "Hericourt", "Herlin le Sec", "Herlincourt", "Hermaville", "Hermin", "Hernicourt",
      "Hersin Coupigny", "Hesdigneul les Bethune", "Hestrus", "Heuchin", "Houchin", "Houdain",
      "Huclier", "Humeroeuille", "Humieres", "Isbergues-Molinghem-Berguette", "Izel les Hameaux", "La Comte",
      "Lambres", "Le Ponchel", "Le Thieuloye", "Liettres", "Ligny les Aires", "Ligny St Flochel",
      "Ligny sur Canche", "Linghem", "Linzeux", "Lisbourg", "Lozinghem", "Magnicourt en Comte",
      "Maisnil", "Maisnil les Ruitz", "Maizieres", "Manin", "Marest", "Marles les Mines",
      "Marquay", "Mazinghem", "Mingoval", "Moncheaux les Frevent", "Monchel sur Canche", "Monchy Breton",
      "Monchy Cayeux", "Monts en Ternois", "Nedon", "Nedonchel", "Noeux les Auxi", "Nouville au Cornet",
      "Noyelle Vion", "Nuncq Hautecote", "Œuf en Ternois", "Ostreville", "Ourton", "Penin",
      "Pernes", "Pierremont", "Predefin", "Pressy", "Quernes", "Quoeux Haut Maisnil",
      "Ramecourt", "Rebreuve Ranchicourt", "Rely", "Roellecourt", "Rombly", "Rougefay",
      "Ruitz", "Sachin", "Sains les Pernes", "Saint Pol sur Ternoise", "Savy Berlette", "Sericourt",
      "Sibiville", "Siracourt", "St Hillaire Cottes", "St Michel sur Ternoise", "Tangry", "Teneur",
      "Ternas", "Tilloy les Hermaville", "Tilly Capelle", "Tincques", "Tollent", "Troisveaux",
      "Vacquerie le Boucq", "Valhuon", "Vaulx", "Villers Brulin", "Villers Chatel", "Villers l’Hopital",
      "Villers Sir Simon", "Wavrans sur Ternoise", "Willencourt", "Witternesse",
    ],
  },
];

