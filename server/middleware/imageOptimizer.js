import { Router } from "express";
import sharp from "sharp";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";

/**
 * Build the domain allowlist from environment variables.
 * Allows: localhost variants + VITE_BASE_URL_BACKEND + IMAGE_OPTIMIZER_ALLOWED_DOMAINS
 */
function buildAllowlist() {
  const allowed = new Set(["localhost", "127.0.0.1"]);

  const backendUrl = process.env.VITE_BASE_URL_BACKEND;
  if (backendUrl) {
    try {
      allowed.add(new URL(backendUrl).hostname);
    } catch {
      // invalid URL, skip
    }
  }

  const extra = process.env.IMAGE_OPTIMIZER_ALLOWED_DOMAINS;
  if (extra) {
    for (const d of extra.split(",")) {
      const trimmed = d.trim();
      if (trimmed) allowed.add(trimmed);
    }
  }

  return allowed;
}

/**
 * Check if a remote URL's hostname is in the allowlist.
 */
function isDomainAllowed(urlStr, allowlist) {
  try {
    const hostname = new URL(urlStr).hostname;
    return allowlist.has(hostname);
  } catch {
    return false;
  }
}

/**
 * Negotiate best format from Accept header.
 * Priority: AVIF > WebP > JPEG
 */
function negotiateFormat(acceptHeader) {
  if (!acceptHeader) return "jpeg";
  if (acceptHeader.includes("image/avif")) return "avif";
  if (acceptHeader.includes("image/webp")) return "webp";
  return "jpeg";
}

const FORMAT_TO_CONTENT_TYPE = {
  webp: "image/webp",
  avif: "image/avif",
  jpeg: "image/jpeg",
  png: "image/png",
};

const FORMAT_TO_EXT = {
  webp: "webp",
  avif: "avif",
  jpeg: "jpg",
  png: "png",
};

// Types MIME acceptés en entrée
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/tiff",
]);

// Magic bytes pour détecter le vrai type d'un buffer
function detectImageType(buffer) {
  if (buffer.length < 4) return null;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  // WebP: RIFF....WEBP
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer.length > 11 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return "image/webp";
  // GIF: GIF8
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return "image/gif";
  // AVIF/HEIF: ....ftyp
  if (buffer.length > 11 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return "image/avif";
  // TIFF: II (little-endian) or MM (big-endian)
  if ((buffer[0] === 0x49 && buffer[1] === 0x49) || (buffer[0] === 0x4d && buffer[1] === 0x4d)) return "image/tiff";
  return null;
}

/**
 * Guess Content-Type from file extension.
 */
function mimeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".tiff": "image/tiff", ".tif": "image/tiff",
  };
  return map[ext] || "application/octet-stream";
}

/**
 * Creates an Express router that serves optimized images.
 *
 * GET /img?url=<source>&w=<width>&h=<height>&q=<quality>&f=<format>
 *
 * @param {{ staticRoot: string, cacheDir: string }} options
 * @returns {import("express").Router}
 */
export function createImageOptimizer({ staticRoot, cacheDir }) {
  const router = Router();
  const allowlist = buildAllowlist();

  // Ensure cache directory exists
  fs.mkdirSync(cacheDir, { recursive: true });

  router.get("/", async (req, res) => {
    const { url: sourceUrl, w, h, q, f } = req.query;

    // --- Validate required param ---
    if (!sourceUrl || typeof sourceUrl !== "string") {
      return res.status(400).json({ error: "Missing required parameter: url" });
    }

    // --- Skip SVG and data URIs (not rasterizable) ---
    if (sourceUrl.endsWith(".svg") || sourceUrl.startsWith("data:")) {
      return res.redirect(301, sourceUrl);
    }

    // --- Parse & validate optional params ---
    const width = w ? parseInt(w, 10) : undefined;
    const height = h ? parseInt(h, 10) : undefined;
    const quality = q ? parseInt(q, 10) : 80;
    const formatParam = f || "auto";

    if (width !== undefined && (isNaN(width) || width < 16 || width > 4096)) {
      return res.status(400).json({ error: "w must be an integer between 16 and 4096" });
    }
    if (height !== undefined && (isNaN(height) || height < 16 || height > 4096)) {
      return res.status(400).json({ error: "h must be an integer between 16 and 4096" });
    }
    if (isNaN(quality) || quality < 1 || quality > 100) {
      return res.status(400).json({ error: "q must be an integer between 1 and 100" });
    }
    if (!["webp", "avif", "jpeg", "png", "auto"].includes(formatParam)) {
      return res.status(400).json({ error: "f must be one of: webp, avif, jpeg, png, auto" });
    }

    // --- Determine if local or remote ---
    const isLocal = sourceUrl.startsWith("/");

    // Security: check domain for remote URLs
    if (!isLocal && !isDomainAllowed(sourceUrl, allowlist)) {
      return res.status(403).json({ error: "Domain not allowed" });
    }

    // --- Resolve output format ---
    const outputFormat =
      formatParam === "auto"
        ? negotiateFormat(req.headers.accept)
        : formatParam;

    // --- Cache key ---
    const cacheKey = createHash("sha256")
      .update(`${sourceUrl}:${width || ""}:${height || ""}:${quality}:${outputFormat}`)
      .digest("hex");
    const ext = FORMAT_TO_EXT[outputFormat];
    const cachePath = path.join(cacheDir, `${cacheKey}.${ext}`);

    // --- Cache HIT ---
    if (fs.existsSync(cachePath)) {
      res.setHeader("Content-Type", FORMAT_TO_CONTENT_TYPE[outputFormat]);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Image-Cache", "HIT");
      return fs.createReadStream(cachePath).pipe(res);
    }

    // --- Cache MISS: fetch source ---
    let sourceBuffer;

    try {
      if (isLocal) {
        const localPath = path.join(staticRoot, sourceUrl);
        // Prevent directory traversal
        if (!path.resolve(localPath).startsWith(path.resolve(staticRoot))) {
          return res.status(403).json({ error: "Path traversal not allowed" });
        }
        if (!fs.existsSync(localPath)) {
          return res.status(404).json({ error: "Local image not found" });
        }
        sourceBuffer = fs.readFileSync(localPath);
      } else {
        const response = await fetch(sourceUrl, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
          return res.status(502).json({ error: `Upstream returned ${response.status}` });
        }

        // Vérifier que la réponse est bien une image
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.startsWith("image/")) {
          return res.status(400).json({ error: `Not an image: ${contentType}` });
        }

        // SVG distant : proxy sans transformation
        if (contentType.includes("svg")) {
          const svgBuf = Buffer.from(await response.arrayBuffer());
          res.setHeader("Content-Type", "image/svg+xml");
          res.setHeader("Cache-Control", "public, max-age=86400");
          return res.send(svgBuf);
        }

        sourceBuffer = Buffer.from(await response.arrayBuffer());
      }
    } catch (err) {
      console.error(`[imageOptimizer] Fetch error for ${sourceUrl}:`, err.message);
      return res.status(502).json({ error: "Failed to fetch source image" });
    }

    // --- Validate buffer ---
    if (!sourceBuffer || sourceBuffer.length < 8) {
      return res.status(400).json({ error: "Source image is empty or too small" });
    }

    const detectedType = detectImageType(sourceBuffer);
    if (!detectedType || !ALLOWED_MIME_TYPES.has(detectedType)) {
      // Le buffer n'est pas une image reconnue — servir tel quel si local
      if (isLocal) {
        const localPath = path.join(staticRoot, sourceUrl);
        res.setHeader("Content-Type", mimeFromPath(localPath));
        res.setHeader("X-Image-Cache", "PASSTHROUGH");
        return res.send(sourceBuffer);
      }
      return res.status(400).json({ error: `Unrecognized image format (detected: ${detectedType || "unknown"})` });
    }

    // --- Transform with sharp ---
    try {
      let pipeline = sharp(sourceBuffer);

      // Resize (preserves aspect ratio if only one dimension provided)
      if (width || height) {
        pipeline = pipeline.resize(width, height, { fit: "inside", withoutEnlargement: true });
      }

      // Convert format
      pipeline = pipeline.toFormat(outputFormat, { quality });

      const optimizedBuffer = await pipeline.toBuffer();

      // Write to cache (non-blocking)
      fs.writeFile(cachePath, optimizedBuffer, (err) => {
        if (err) console.error("[imageOptimizer] Cache write error:", err.message);
      });

      // Respond
      res.setHeader("Content-Type", FORMAT_TO_CONTENT_TYPE[outputFormat]);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Image-Cache", "MISS");
      return res.send(optimizedBuffer);
    } catch (err) {
      console.error(`[imageOptimizer] Sharp error for ${sourceUrl} (detected: ${detectedType}):`, err.message);

      // Fallback: serve original unmodified
      const fallbackContentType = isLocal ? mimeFromPath(sourceUrl) : (detectedType || "application/octet-stream");
      res.setHeader("Content-Type", fallbackContentType);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("X-Image-Cache", "ERROR");
      return res.send(sourceBuffer);
    }
  });

  return router;
}
