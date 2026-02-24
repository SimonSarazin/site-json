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
    try {
      let sourceBuffer;

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
        sourceBuffer = Buffer.from(await response.arrayBuffer());
      }

      // --- Transform with sharp ---
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
      console.error("[imageOptimizer] Processing error:", err.message);

      // Fallback: try to proxy original image unmodified
      try {
        if (isLocal) {
          const localPath = path.join(staticRoot, sourceUrl);
          res.setHeader("X-Image-Cache", "ERROR");
          return fs.createReadStream(localPath).pipe(res);
        } else {
          const fallbackRes = await fetch(sourceUrl, {
            signal: AbortSignal.timeout(10_000),
          });
          res.setHeader("X-Image-Cache", "ERROR");
          res.setHeader("Content-Type", fallbackRes.headers.get("content-type") || "image/jpeg");
          const fallbackBuf = Buffer.from(await fallbackRes.arrayBuffer());
          return res.send(fallbackBuf);
        }
      } catch (fallbackErr) {
        return res.status(500).json({ error: "Image processing failed" });
      }
    }
  });

  return router;
}
