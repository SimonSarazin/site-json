/**
 * Server connection helper for integration tests.
 * The actual server lifecycle is managed by global-setup.ts.
 * This module just provides the base URL.
 */

const PORT = 5188;
const BASE_URL = `http://localhost:${PORT}`;

export function getBaseUrl(): string {
  return BASE_URL;
}
