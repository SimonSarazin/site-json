import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

/**
 * Creates an Express router for admin image uploads.
 *
 * Images are saved to `<staticRoot>/images/<slug>/` and the response
 * returns the public path (e.g. `/images/institutBleu/abc123.jpg`).
 *
 * ⚠ Le dossier est nommé d'après `VITE_SLUG`, alors que les dossiers réels de
 * `public/images/` ne suivent pas le slug pour 8 sites sur 17 (le champ `images`
 * de `sites.json` fait foi — `navigatorDesTierslieux` écrit dans `tiersLieux`).
 * Le `mkdirSync` ci-dessous a lieu au MONTAGE du middleware, pas à l'upload :
 * lancer le serveur de dev avec un slug quelconque crée un dossier vide.
 *
 * @param {{ staticRoot: string }} options
 *   - `staticRoot`: absolute path to the directory served as static files
 *     (e.g. `public/` in dev, `dist/client/` in prod).
 */
export function createImageUpload({ staticRoot }) {
  const slug = process.env.VITE_SLUG || "default";
  const uploadDir = path.join(staticRoot, "images", slug);

  fs.mkdirSync(uploadDir, { recursive: true });

  const ALLOWED_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/avif",
  ]);

  const MAX_SIZE = 10 * 1024 * 1024;

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      const hash = crypto.randomBytes(8).toString("hex");
      cb(null, `${hash}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: MAX_SIZE },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_TYPES.has(file.mimetype)) {
        return cb(new Error(`Type non autorisé : ${file.mimetype}`));
      }
      cb(null, true);
    },
  });

  return (req, res) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Aucun fichier reçu" });
      }

      const publicPath = `/images/${slug}/${req.file.filename}`;
      console.log(`[Admin] Image uploaded: ${publicPath}`);
      res.json({ path: publicPath, filename: req.file.filename });
    });
  };
}
