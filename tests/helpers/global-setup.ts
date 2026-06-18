import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");

const PORT = 5188;
const BASE_URL = `http://localhost:${PORT}`;
const POLL_INTERVAL = 500;
const STARTUP_TIMEOUT = 60_000;

// Le serveur d'intégration DOIT servir la même config que celle que les tests
// lisent (`process.env.SITE_CONFIG_PATH || ./config.prod.json`). Sinon divergence :
// le serveur charge `.env` via dotenv (→ ex. equipements-Sportifs) tandis que le
// process Vitest, lui, ne charge pas `.env` (→ fallback config.prod.json) → les
// assertions portent sur la mauvaise config. On épingle donc explicitement la valeur
// dans l'env du spawn (dotenv sans `override` ne l'écrase pas).
const SITE_CONFIG_PATH = process.env.SITE_CONFIG_PATH || path.join(PROJECT_ROOT, "config.prod.json");

let serverProcess: ChildProcess | null = null;

/**
 * Fetch with timeout using Promise.race for reliable body reading.
 */
async function fetchWithTimeout(url: string, timeoutMs = 20_000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    clearTimeout(timer);
    return text;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function setup() {
  // Check if server is already running
  try {
    const text = await fetchWithTimeout(BASE_URL, 5_000);
    if (text && text.includes("</html>")) {
      console.log(`[global-setup] Server already running and warm on ${BASE_URL}`);
      return;
    }
  } catch {
    // Not running
  }

  console.log(`[global-setup] Starting dev server on port ${PORT}...`);

  serverProcess = spawn("node", ["server/dev-server.js"], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "development",
      // Aligne le serveur sur la config lue par les tests (cf. SITE_CONFIG_PATH ci-dessus).
      SITE_CONFIG_PATH,
    },
    stdio: "pipe",
  });

  serverProcess.stderr?.on("data", (data) => {
    const msg = data.toString();
    if (msg.includes("Error") || msg.includes("error")) {
      if (process.env.DEBUG_SERVER) {
        process.stderr.write(`[server:err] ${msg}`);
      }
    }
  });

  // Wait for server to respond (just headers)
  const deadline = Date.now() + STARTUP_TIMEOUT;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok || res.status < 500) {
        // Server is responding, try to consume body
        try { await res.text(); } catch { /* body may be broken on first request */ }
        break;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  // Warmup: make requests until we get a full HTML response
  // The first SSR render may fail due to Vite compilation + streaming issues
  console.log(`[global-setup] Warming up server...`);
  for (let attempt = 0; attempt < 5; attempt++) {
    const text = await fetchWithTimeout(BASE_URL, 20_000);
    if (text && text.includes("</html>")) {
      console.log(`[global-setup] Server warm after ${attempt + 1} attempt(s)`);
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`[global-setup] Server started but warmup incomplete (tests may retry)`);
}

export async function teardown() {
  if (!serverProcess) return;

  console.log("[global-setup] Stopping server...");

  const proc = serverProcess;
  serverProcess = null;

  return new Promise<void>((resolve) => {
    proc.on("exit", () => {
      console.log("[global-setup] Server stopped.");
      resolve();
    });
    proc.kill("SIGTERM");

    setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        // already dead
      }
      resolve();
    }, 5_000);
  });
}
