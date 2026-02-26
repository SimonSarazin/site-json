/**
 * Playwright global setup: warm up the dev server with a few requests
 * before running browser tests. This ensures Vite has compiled all
 * necessary modules and the SSR pipeline is stable.
 */
async function globalSetup() {
  const baseUrl = "http://localhost:5173";

  // Warm up the server with a few requests
  for (let i = 0; i < 3; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      const res = await fetch(baseUrl, { signal: controller.signal });
      await res.text();
      clearTimeout(timer);
      // If we got a successful response, server is warm
      if (res.ok) return;
    } catch {
      // Retry after a short delay
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

export default globalSetup;
