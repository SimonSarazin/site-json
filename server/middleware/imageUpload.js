import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

/**
 * Creates an Express router for admin image uploads.
 *
 * Images are saved to `<staticRoot>/images/<slug>/` and the response
 * returns the public path (e.g. `/images/jardin/abc123.jpg`).
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
