import { readFileSync } from 'node:fs';

/**
 * The `add_header Name "value" always;` lines of an nginx include file, as a header map. nginx serves the file in
 * production; vite.config.ts feeds the same map to `vite preview`, so the browser tests run under the same policy.
 */
export function readSecurityHeaders(path: string): Record<string, string> {
  const text = readFileSync(path, 'utf8');
  return Object.fromEntries(
    [...text.matchAll(/^\s*add_header\s+(\S+)\s+"([^"]*)"\s+always;/gm)].map((m) => [m[1], m[2]]),
  );
}
