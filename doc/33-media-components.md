[← Retour à l'index](README.md)

# Composants média partagés (`src/components/media/`)

**Sommaire**

- [Vue d'ensemble](#vue-densemble)
- [Types partagés](#types-partagés)
  - [GalleryImage](#galleryimage)
  - [DocFile](#docfile)
- [Composants](#composants)
  - [AudioPlayer](#audioplayer)
  - [AudioRecorder](#audiorecorder)
  - [LiveWaveform](#livewaveform-vendoré-elevenlabs-ui)
  - [BarVisualizer](#barvisualizer-vendoré-elevenlabs-ui)
  - [ScrubBar](#scrubbar-vendoré-elevenlabs-ui)
  - [GalleryGrid](#gallerygrid)
  - [FilesList](#fileslist)
- [Dépendance : ImageViewer (lightbox)](#dépendance--imageviewer-lightbox)
- [Réutilisations / consommateurs](#réutilisations--consommateurs)

---

## Vue d'ensemble

Le dossier `src/components/media/` regroupe les primitives **présentationnelles et sans état métier** utilisées pour afficher, jouer et gérer des médias (audio, images, documents) à travers plusieurs modules : blog, search (aperçus ressource / témoignage), profil (galerie, documents, upload) et admin.

Deux familles cohabitent :

- **Primitives « maison »** au style shadcn, sans dépendance externe : `AudioPlayer`, `AudioRecorder`, `GalleryGrid`, `FilesList`. Elles reçoivent des données déjà normalisées (URLs **absolues** produites par les libs `getListOfImage` / `getGalleryFiles` via `_imageFields`) et n'appellent pas d'API.
- **Code vendoré ElevenLabs UI** (Web Audio API natif) : `LiveWaveform`, `BarVisualizer`, `ScrubBar`. Adaptés de [github.com/elevenlabs/ui](https://github.com/elevenlabs/ui) (**licence MIT**, `registry/elevenlabs-ui/ui`). Ce sont des composants `"use client"` purement navigateur : ils manipulent `AudioContext` / `MediaRecorder` / `requestAnimationFrame` et n'ont **aucun rendu SSR utile** (montés uniquement côté client, sous condition d'action utilisateur).

**Note SSR** : `AudioPlayer` s'hydrate normalement (élément `<audio preload="metadata">` masqué), mais toute la logique de durée/lecture n'existe qu'après hydratation. `AudioRecorder` et `LiveWaveform` ne sont montés qu'à l'appui sur le bouton micro (jamais rendus au SSR). Les composants vendorés testent `typeof MediaRecorder` / `window.AudioContext` avant usage.

---

## Types partagés

Ces deux interfaces sont **importées par d'autres modules** (hooks profil, hook search `useResourceEntity`) comme forme de données commune ; elles décrivent les objets produits par les libs de normalisation.

### GalleryImage

Exportée depuis `GalleryGrid.tsx`. Forme d'une image de galerie (`getListOfImage`) — URLs **déjà absolues**.

| Champ | Type | Rôle |
|-------|------|------|
| `id?` | `string` | Identifiant du document (clé de liste + cible `deletingId`) |
| `contentKey?` | `string` | Clé de contenu dérivée (stockée côté lib) |
| `imagePath?` | `string` | URL pleine résolution (utilisée en lightbox) |
| `imageThumbPath?` | `string` | URL vignette (affichée dans la grille) |
| `imageMediumPath?` | `string` | URL taille moyenne (fallback lightbox) |
| `name?` | `string` | Légende / `alt` |

### DocFile

Exportée depuis `FilesList.tsx`. Un document/fichier (`getGalleryFiles`) — `docPath` **déjà absolutisé** côté lib.

| Champ | Type | Rôle |
|-------|------|------|
| `docId` | `string` | Identifiant (clé de liste + cible `deletingId`) |
| `docPath?` | `string` | URL absolue de téléchargement |
| `name?` | `string` | Nom de fichier affiché (`title`, `alt`) |
| `size?` | `number` | Taille en octets (affichée via `formatFileSize`) |
| `contentKey?` | `string` | Type dérivé (`pdf` / `spreadsheet` / `text` / `presentation`) → choix de l'icône |

---

## Composants

### AudioPlayer

`export function AudioPlayer` — `AudioPlayer.tsx`

Lecteur audio réutilisable au style shadcn (`Button` + `Slider`), **sans dépendance externe** : play/pause · seek · temps courant/durée · vitesse cyclée (1× → 1.25 → 1.5 → 2). `<audio>` masqué piloté par ref en `preload="metadata"`. La durée est lue sur `loadedmetadata` / `durationchange` (keyée sur `src`) ; pour un MP3 VBR (`duration = Infinity` au départ) le slider est simplement désactivé tant que la durée n'est pas connue — **aucun téléchargement eager du fichier** n'est forcé.

| Prop | Type | Défaut | Rôle |
|------|------|--------|------|
| `src` | `string` | — (requis) | URL du média (absolue pour un `docPath`, ou `objectURL` local) |
| `compact?` | `boolean` | `false` | Masque les temps + le bouton vitesse (cellule de tableau admin) |
| `className?` | `string` | — | Classes du conteneur |

**Utilisé par** : profil `DocumentUploadField` (relecture d'un enregistrement), search `PreviewResourceCard` + `PreviewTestimonialBubble`, admin `AdminResourceTable` (`AudioCell`, en `compact`).

### AudioRecorder

`export function AudioRecorder` — `AudioRecorder.tsx`

Enregistreur audio in-navigateur (« Paroles de parents »). Bouton micro → visualisation `LiveWaveform` en direct → `MediaRecorder` branché sur le stream (via `onStreamReady`) → à l'arrêt, produit un `File` remis à `onRecorded`. `MediaRecorder` **n'encode pas de MP3** : le mime supporté est choisi par `pickRecordingMime()` (Chrome/FF → `webm/opus`, Safari → `mp4`≈m4a, sinon `ogg`), l'extension conditionnant l'acceptation backend. Le micro est coupé au démontage de `LiveWaveform` (`active=false`).

| Prop | Type | Défaut | Rôle |
|------|------|--------|------|
| `onRecorded` | `(file: File) => void` | — (requis) | Callback avec le fichier enregistré, à ajouter aux `added` du champ |
| `className?` | `string` | — | Classes du conteneur |

**Utilisé par** : profil `DocumentUploadField` (enregistrement puis upload via le flux `added` existant).

### LiveWaveform (vendoré ElevenLabs UI)

`export const LiveWaveform` — `LiveWaveform.tsx`. Adapté d'ElevenLabs UI (MIT). Rendu **canvas** d'une forme d'onde du micro en direct, via `getUserMedia` + `AnalyserNode`. Gère lui-même l'ouverture/fermeture du flux micro selon `active`, un `ResizeObserver` (DPR-aware) et une boucle `requestAnimationFrame`. Composant `"use client"` — jamais utile au SSR.

Type : `LiveWaveformProps = HTMLAttributes<HTMLDivElement> & { … }`.

| Prop | Type | Défaut | Rôle |
|------|------|--------|------|
| `active?` | `boolean` | `false` | Ouvre le micro et anime ; `false` coupe le flux et fait s'estomper les barres |
| `processing?` | `boolean` | `false` | Animation « en traitement » (ondes synthétiques) |
| `deviceId?` | `string` | — | `deviceId` micro (`getUserMedia`) |
| `barWidth?` | `number` | `3` | Largeur d'une barre (px) |
| `barHeight?` | `number` | `4` | Hauteur minimale d'une barre (px) |
| `barGap?` | `number` | `1` | Espacement entre barres (px) |
| `barRadius?` | `number` | `1.5` | Rayon d'arrondi (`roundRect`) |
| `barColor?` | `string` | couleur calculée (`color` CSS) | Couleur des barres |
| `fadeEdges?` | `boolean` | `true` | Dégradé de fondu sur les bords |
| `fadeWidth?` | `number` | `24` | Largeur du fondu (px) |
| `height?` | `string \| number` | `64` | Hauteur du conteneur |
| `sensitivity?` | `number` | `1` | Gain appliqué à l'amplitude |
| `smoothingTimeConstant?` | `number` | `0.8` | Lissage de l'`AnalyserNode` |
| `fftSize?` | `number` | `256` | Taille FFT de l'`AnalyserNode` |
| `historySize?` | `number` | `60` | Nombre d'échantillons conservés (mode `scrolling`) |
| `updateRate?` | `number` | `30` | Intervalle mini entre updates (ms) |
| `mode?` | `"scrolling" \| "static"` | `"static"` | Défilement horizontal vs barres symétriques fixes |
| `onError?` | `(error: Error) => void` | — | Erreur d'accès micro |
| `onStreamReady?` | `(stream: MediaStream) => void` | — | Flux prêt (point de branchement du `MediaRecorder`) |
| `onStreamEnd?` | `() => void` | — | Flux fermé |

**Utilisé par** : `AudioRecorder` (visualisation pendant l'enregistrement).

### BarVisualizer (vendoré ElevenLabs UI)

`export { BarVisualizer }` — `BarVisualizer.tsx`. Adapté d'ElevenLabs UI (MIT). Barres de volume multi-bandes pour un assistant vocal (états `connecting` / `initializing` / `listening` / `speaking` / `thinking`), avec mode `demo` (données factices). `memo`isé (composant + `Bar`). **Non consommé actuellement** dans l'app — conservé comme brique vocale disponible.

Type : `BarVisualizerProps extends HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Défaut | Rôle |
|------|------|--------|------|
| `state?` | `AgentState` | — | État de l'assistant (voir type) |
| `barCount?` | `number` | `15` | Nombre de barres |
| `mediaStream?` | `MediaStream \| null` | — | Source audio réelle (via `useMultibandVolume`) |
| `minHeight?` | `number` | `20` | Hauteur mini (%) |
| `maxHeight?` | `number` | `100` | Hauteur maxi (%) |
| `demo?` | `boolean` | `false` | Données factices animées (sans micro) |
| `centerAlign?` | `boolean` | `false` | Barres centrées verticalement plutôt qu'alignées en bas |

**Exports additionnels** (hooks / types Web Audio réutilisables) : `useAudioVolume(mediaStream, options)`, `useMultibandVolume(mediaStream, options)`, `useBarAnimator(state, columns, interval)` ; types `AudioAnalyserOptions`, `MultiBandVolumeOptions`, `AgentState`. Non consommés hors du fichier à ce jour.

### ScrubBar (vendoré ElevenLabs UI)

`ScrubBar.tsx`. Adapté d'ElevenLabs UI (MIT). **Composant composé** (pattern context) pour une barre de lecture personnalisable : pointer-drag → `onScrub(time)`. Bâti sur `Progress` (shadcn). **Non consommé actuellement** — `AudioPlayer` utilise le `Slider` shadcn à la place ; `ScrubBar` reste disponible pour une barre de scrub sur-mesure.

Exports : `ScrubBarContainer` (racine, fournit le contexte), `ScrubBarTrack`, `ScrubBarProgress`, `ScrubBarThumb`, `ScrubBarTimeLabel`.

| Sous-composant | Props notables | Rôle |
|----------------|----------------|------|
| `ScrubBarContainer` | `duration: number`, `value: number`, `onScrub?(time)`, `onScrubStart?()`, `onScrubEnd?()` + attrs `div` | Racine ; calcule `progress` et fournit le contexte |
| `ScrubBarTrack` | attrs `div` | Piste cliquable/glissable (`role="slider"`), traduit un `clientX` en temps |
| `ScrubBarProgress` | `Omit<ComponentProps<typeof Progress>, "value">` | Remplissage (piloté par le `progress` du contexte) |
| `ScrubBarThumb` | attrs `div` | Curseur positionné à `progress%` |
| `ScrubBarTimeLabel` | `time: number`, `format?(time) => string` + attrs `span` | Libellé temps (format `m:ss` par défaut) |

### GalleryGrid

`export function GalleryGrid` — `GalleryGrid.tsx`

Grille d'images responsive (`grid-cols-2 sm:3 md:4`) + **lightbox** (`ImageViewer`). **Affichage seul par défaut** ; passer `onDelete` / `onAddClick` active la gestion inline (croix touch-aware par vignette + tuile d'ajout). URLs attendues **absolues**.

| Prop | Type | Défaut | Rôle |
|------|------|--------|------|
| `images` | `GalleryImage[]` | — (requis) | Images à afficher |
| `onDelete?` | `(image: GalleryImage) => void` | — | Active la suppression par vignette (mode gestion) |
| `onAddClick?` | `() => void` | — | Active la tuile d'ajout (mode gestion) |
| `deletingId?` | `string \| null` | — | `id` de la vignette en cours de suppression (désactivée) |
| `className?` | `string` | — | Classes du conteneur |

**Utilisé par** : blog `ArticleGallery`, profil `ProfileGallery`, search `PreviewResourceCard`.

### FilesList

`export function FilesList` — `FilesList.tsx`

Liste de documents (lignes : icône colorée par extension/`contentKey` + nom + taille via `formatFileSize` + lien télécharger). **Affichage seul par défaut** ; `onDelete` / `onAddClick` activent la gestion inline (croix touch-aware + bouton d'ajout). `docPath` attendu **absolu**. Rend `null` si aucun fichier et pas d'`onAddClick`.

| Prop | Type | Défaut | Rôle |
|------|------|--------|------|
| `files` | `DocFile[]` | — (requis) | Documents à lister |
| `onDelete?` | `(file: DocFile) => void` | — | Active la suppression par ligne (mode gestion) |
| `onAddClick?` | `() => void` | — | Active le bouton d'ajout (mode gestion) |
| `deletingId?` | `string \| null` | — | `docId` de la ligne en cours de suppression (désactivée) |
| `className?` | `string` | — | Classes du conteneur |

**Utilisé par** : blog `ArticleDocuments`, profil `ProfileDocuments`, search `PreviewResourceCard`.

---

## Dépendance : ImageViewer (lightbox)

`GalleryGrid` s'appuie sur `ImageViewer` (`src/components/ui/image-viewer.tsx`, **hors** `media/`), une lightbox `Dialog` (shadcn) montée uniquement quand `open=true` : navigation clavier (flèches), zoom (0.5×–4×, molette `+`/`-`), drag-to-pan quand zoomé, compteur + légende. Props : `images: ImageViewerImage[]` (`{ src, name? }`), `initialIndex?`, `open`, `onClose`. Elle est mentionnée ici car elle complète la suite média, mais elle vit dans `ui/` (primitive générique) et non dans `media/`.

---

## Réutilisations / consommateurs

Imports vérifiés via `grep -rn 'from "@/components/media' src` :

| Composant / type | Consommateurs |
|------------------|---------------|
| `AudioPlayer` | profil `DocumentUploadField`, search `PreviewResourceCard` + `PreviewTestimonialBubble`, admin `AdminResourceTable` (`AudioCell`, `compact`) |
| `AudioRecorder` | profil `DocumentUploadField` |
| `LiveWaveform` | `AudioRecorder` (interne au dossier `media/`) |
| `GalleryGrid` | blog `ArticleGallery`, profil `ProfileGallery`, search `PreviewResourceCard` |
| `FilesList` | blog `ArticleDocuments`, profil `ProfileDocuments`, search `PreviewResourceCard` |
| `GalleryImage` (type) | search `useResourceEntity`, profil `useGallery` |
| `DocFile` (type) | search `useResourceEntity`, profil `useDocuments` |
| `BarVisualizer` + hooks (`useAudioVolume` / `useMultibandVolume` / `useBarAnimator`) | aucun (vendoré, disponible) |
| `ScrubBar` (sous-composants) | aucun (vendoré, disponible) |

Chemins consommateurs :

- `src/modules/blog/components/ArticleGallery.tsx` → `GalleryGrid` + `GalleryImage`
- `src/modules/blog/components/ArticleDocuments.tsx` → `FilesList` + `DocFile`
- `src/modules/profil/components/sections/ProfileGallery.tsx` → `GalleryGrid`
- `src/modules/profil/components/sections/ProfileDocuments.tsx` → `FilesList`
- `src/modules/profil/hooks/useGallery.tsx` → `GalleryImage` (type)
- `src/modules/profil/hooks/useDocuments.tsx` → `DocFile` (type)
- `src/modules/profil/components/profile-edit/fields/DocumentUploadField.tsx` → `AudioPlayer` + `AudioRecorder`
- `src/modules/search/components/preview/resource/PreviewResourceCard.tsx` → `AudioPlayer` + `GalleryGrid` + `FilesList`
- `src/modules/search/components/preview/testimonial/PreviewTestimonialBubble.tsx` → `AudioPlayer`
- `src/modules/search/hooks/useResourceEntity.ts` → `GalleryImage` + `DocFile` (types)
- `src/modules/admin/sections/AdminResourceTable.tsx` → `AudioPlayer`

---

[← Retour à l'index](README.md)
