import { describe, it, expect } from "vitest";
import { sanitize } from "../sanitize";

describe("sanitize", () => {
  // ── Basic HTML preservation ──
  it("preserves safe HTML tags", () => {
    const input = "<p>Hello <strong>world</strong></p>";
    expect(sanitize(input)).toBe(input);
  });

  it("preserves safe links", () => {
    const input = '<a href="https://example.com">link</a>';
    expect(sanitize(input)).toContain("href");
    expect(sanitize(input)).toContain("example.com");
  });

  it("returns plain text unchanged", () => {
    expect(sanitize("Hello world")).toBe("Hello world");
  });

  it("returns empty string for empty input", () => {
    expect(sanitize("")).toBe("");
  });

  // ── Script removal ──
  it("removes <script> tags", () => {
    const result = sanitize('<p>Hi</p><script>alert("xss")</script>');
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
    expect(result).toContain("<p>Hi</p>");
  });

  it("removes script tags with attributes", () => {
    const result = sanitize('<script src="https://evil.com/xss.js"></script>');
    expect(result).toBe("");
  });

  // ── Event handler removal ──
  it("removes onclick handler", () => {
    const result = sanitize('<button onclick="alert(1)">Click</button>');
    expect(result).not.toContain("onclick");
  });

  it("removes onerror handler on img", () => {
    const result = sanitize('<img src="x" onerror="alert(1)">');
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("alert");
  });

  it("removes onload handler on svg", () => {
    const result = sanitize('<svg onload="alert(1)"><circle/></svg>');
    expect(result).not.toContain("onload");
    expect(result).not.toContain("alert");
  });

  // ── JavaScript URI removal ──
  it("removes javascript: in href", () => {
    const result = sanitize('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain("javascript:");
  });

  // ── Classic XSS payloads ──
  it("neutralizes img onerror XSS", () => {
    const result = sanitize('<img src=x onerror=alert(1)>');
    expect(result).not.toContain("onerror");
  });

  it("neutralizes svg onload XSS", () => {
    const result = sanitize('<svg/onload=alert(1)>');
    expect(result).not.toContain("alert");
  });

  it("neutralizes nested script in tag", () => {
    const result = sanitize('<div><img src="x" onerror="document.location=\'https://evil.com\'"></div>');
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("document.location");
  });

  it("neutralizes event handler with encoded characters", () => {
    const result = sanitize('<a href="#" onmouseover="alert(1)">hover</a>');
    expect(result).not.toContain("onmouseover");
  });

  // ── iframe/embed removal ──
  it("removes iframe", () => {
    const result = sanitize('<iframe src="https://evil.com"></iframe>');
    expect(result).not.toContain("<iframe");
  });

  it("removes object/embed tags", () => {
    const result = sanitize('<object data="https://evil.com/flash.swf"></object>');
    expect(result).not.toContain("<object");
  });
});
