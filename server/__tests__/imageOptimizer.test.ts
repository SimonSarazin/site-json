import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildAllowlist,
  isDomainAllowed,
  negotiateFormat,
  detectImageType,
  mimeFromPath,
} from "../middleware/imageOptimizer.js";

// ────────────────────────────────────────────────────────────
// buildAllowlist
// ────────────────────────────────────────────────────────────
describe("buildAllowlist", () => {
  const envBackup: Record<string, string | undefined> = {};

  beforeEach(() => {
    envBackup.VITE_BASE_URL_BACKEND = process.env.VITE_BASE_URL_BACKEND;
    envBackup.IMAGE_OPTIMIZER_ALLOWED_DOMAINS = process.env.IMAGE_OPTIMIZER_ALLOWED_DOMAINS;
    delete process.env.VITE_BASE_URL_BACKEND;
    delete process.env.IMAGE_OPTIMIZER_ALLOWED_DOMAINS;
  });

  afterEach(() => {
    process.env.VITE_BASE_URL_BACKEND = envBackup.VITE_BASE_URL_BACKEND;
    process.env.IMAGE_OPTIMIZER_ALLOWED_DOMAINS = envBackup.IMAGE_OPTIMIZER_ALLOWED_DOMAINS;
  });

  it("always includes localhost and 127.0.0.1", () => {
    const list = buildAllowlist();
    expect(list.has("localhost")).toBe(true);
    expect(list.has("127.0.0.1")).toBe(true);
  });

  it("adds hostname from VITE_BASE_URL_BACKEND", () => {
    process.env.VITE_BASE_URL_BACKEND = "https://api.example.com/v1";
    const list = buildAllowlist();
    expect(list.has("api.example.com")).toBe(true);
  });

  it("ignores invalid VITE_BASE_URL_BACKEND without crash", () => {
    process.env.VITE_BASE_URL_BACKEND = "not-a-url";
    const list = buildAllowlist();
    expect(list.has("localhost")).toBe(true);
    expect(list.size).toBe(2);
  });

  it("splits IMAGE_OPTIMIZER_ALLOWED_DOMAINS by comma", () => {
    process.env.IMAGE_OPTIMIZER_ALLOWED_DOMAINS = "cdn.example.com, images.test.org , media.io";
    const list = buildAllowlist();
    expect(list.has("cdn.example.com")).toBe(true);
    expect(list.has("images.test.org")).toBe(true);
    expect(list.has("media.io")).toBe(true);
  });

  it("ignores empty entries from trailing commas", () => {
    process.env.IMAGE_OPTIMIZER_ALLOWED_DOMAINS = "cdn.example.com,,";
    const list = buildAllowlist();
    expect(list.has("")).toBe(false);
    expect(list.has("cdn.example.com")).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// isDomainAllowed
// ────────────────────────────────────────────────────────────
describe("isDomainAllowed", () => {
  const allowlist = new Set(["localhost", "127.0.0.1", "cdn.example.com"]);

  it("returns true for allowed domain", () => {
    expect(isDomainAllowed("https://cdn.example.com/img.png", allowlist)).toBe(true);
  });

  it("returns true for localhost with port", () => {
    expect(isDomainAllowed("http://localhost:5080/api/image", allowlist)).toBe(true);
  });

  it("returns false for domain not in allowlist", () => {
    expect(isDomainAllowed("https://evil.com/img.png", allowlist)).toBe(false);
  });

  it("returns false for malformed URL", () => {
    expect(isDomainAllowed("not-a-url", allowlist)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isDomainAllowed("", allowlist)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// negotiateFormat
// ────────────────────────────────────────────────────────────
describe("negotiateFormat", () => {
  it("returns avif when Accept includes image/avif", () => {
    expect(negotiateFormat("image/avif,image/webp,*/*")).toBe("avif");
  });

  it("returns webp when Accept includes image/webp but not avif", () => {
    expect(negotiateFormat("image/webp,image/png,*/*")).toBe("webp");
  });

  it("returns jpeg when Accept has neither avif nor webp", () => {
    expect(negotiateFormat("image/png,*/*")).toBe("jpeg");
  });

  it("returns jpeg when no Accept header", () => {
    expect(negotiateFormat(undefined)).toBe("jpeg");
  });

  it("returns jpeg for empty string", () => {
    expect(negotiateFormat("")).toBe("jpeg");
  });

  it("prefers avif over webp when both present", () => {
    expect(negotiateFormat("image/webp,image/avif")).toBe("avif");
  });
});

// ────────────────────────────────────────────────────────────
// detectImageType
// ────────────────────────────────────────────────────────────
describe("detectImageType", () => {
  it("detects PNG", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectImageType(png)).toBe("image/png");
  });

  it("detects JPEG", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectImageType(jpeg)).toBe("image/jpeg");
  });

  it("detects WebP", () => {
    // RIFF....WEBP
    const webp = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
    ]);
    expect(detectImageType(webp)).toBe("image/webp");
  });

  it("detects GIF", () => {
    const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(detectImageType(gif)).toBe("image/gif");
  });

  it("detects TIFF (little-endian)", () => {
    const tiff = Buffer.from([0x49, 0x49, 0x2a, 0x00]);
    expect(detectImageType(tiff)).toBe("image/tiff");
  });

  it("detects TIFF (big-endian)", () => {
    const tiff = Buffer.from([0x4d, 0x4d, 0x00, 0x2a]);
    expect(detectImageType(tiff)).toBe("image/tiff");
  });

  it("returns null for HTML content", () => {
    const html = Buffer.from("<html><body>Not an image</body></html>");
    expect(detectImageType(html)).toBeNull();
  });

  it("returns null for empty buffer", () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });

  it("returns null for buffer too small", () => {
    expect(detectImageType(Buffer.from([0x89, 0x50]))).toBeNull();
  });

  it("returns null for random bytes", () => {
    expect(detectImageType(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]))).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// mimeFromPath
// ────────────────────────────────────────────────────────────
describe("mimeFromPath", () => {
  it("returns image/jpeg for .jpg", () => {
    expect(mimeFromPath("/images/photo.jpg")).toBe("image/jpeg");
  });

  it("returns image/jpeg for .jpeg", () => {
    expect(mimeFromPath("/images/photo.jpeg")).toBe("image/jpeg");
  });

  it("returns image/png for .png", () => {
    expect(mimeFromPath("/images/logo.png")).toBe("image/png");
  });

  it("returns image/webp for .webp", () => {
    expect(mimeFromPath("/images/hero.webp")).toBe("image/webp");
  });

  it("returns image/avif for .avif", () => {
    expect(mimeFromPath("/images/photo.avif")).toBe("image/avif");
  });

  it("returns image/gif for .gif", () => {
    expect(mimeFromPath("/images/anim.gif")).toBe("image/gif");
  });

  it("returns image/svg+xml for .svg", () => {
    expect(mimeFromPath("/images/icon.svg")).toBe("image/svg+xml");
  });

  it("returns image/tiff for .tiff", () => {
    expect(mimeFromPath("/images/scan.tiff")).toBe("image/tiff");
  });

  it("returns image/tiff for .tif", () => {
    expect(mimeFromPath("/images/scan.tif")).toBe("image/tiff");
  });

  it("returns application/octet-stream for unknown extension", () => {
    expect(mimeFromPath("/files/document.pdf")).toBe("application/octet-stream");
  });

  it("handles uppercase extensions", () => {
    expect(mimeFromPath("/images/PHOTO.JPG")).toBe("image/jpeg");
  });
});
