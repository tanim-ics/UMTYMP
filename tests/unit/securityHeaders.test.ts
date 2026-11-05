// Task 24: the nginx security headers. nginx has a trap: a location block with its own `add_header` silently drops
// every `add_header` from the server block. So the headers live in one file that each location includes, and this
// test checks both the policy and that no location forgets it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readSecurityHeaders } from '../../tools/security-headers.ts';

const headers = readSecurityHeaders('docker/security-headers.conf');
const csp = new Map(
  (headers['Content-Security-Policy'] ?? '').split(';').map((d) => {
    const [name = '', ...values] = d.trim().split(/\s+/);
    return [name, values] as const;
  }),
);

describe('security headers', () => {
  it('scripts come only from the app itself: no inline script, no eval', () => {
    expect(csp.get('default-src')).toEqual(["'self'"]);
    expect(csp.get('script-src')).toEqual(["'self'"]);
  });

  it('no plugins, no framing, no other base URL, no form posts elsewhere', () => {
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'self'"]);
    expect(csp.get('form-action')).toEqual(["'self'"]);
  });

  it('nothing is fetched from another site (Release 1 has no backend)', () => {
    for (const [directive, values] of csp) {
      expect(
        values.filter((v) => /^(https?:|\*)/.test(v)),
        directive,
      ).toEqual([]);
    }
  });

  it('sets no-sniff, no referrer, and turns off device features the app never uses', () => {
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    expect(headers['Permissions-Policy']).toMatch(/camera=\(\).*microphone=\(\).*geolocation=\(\)/);
  });

  it('every nginx location that sets its own headers also includes the security headers', () => {
    const conf = readFileSync('docker/nginx.conf', 'utf8');
    const locations = [...conf.matchAll(/location\s+[^{]+\{([^}]*)\}/g)].map((m) => m[1] ?? '');
    expect(locations.length).toBeGreaterThan(0);
    for (const body of locations) {
      if (body.includes('add_header'))
        expect(body).toContain('include /etc/nginx/security-headers.conf;');
    }
  });

  it('hashed build files are cached for a year; everything else is checked each time', () => {
    const conf = readFileSync('docker/nginx.conf', 'utf8');
    expect(conf).toMatch(/location \/assets\/ \{[^}]*max-age=31536000, immutable/);
    expect(conf).toMatch(/location \/ \{[^}]*no-cache/);
  });
});
