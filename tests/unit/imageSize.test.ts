// Task 25: the production image stays at most 50 MB (docs/CONSTRAINTS.md). tools/image-size.sh asks Docker for the
// image's size; these tests give it a fake `docker`, so they never need the real one.
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function run(sizeBytes: string, args: string[] = []): { code: number; out: string } {
  const bin = mkdtempSync(join(tmpdir(), 'size-'));
  writeFileSync(
    join(bin, 'docker'),
    `#!/bin/sh\n[ "$1 $2 $3" = "compose config --images" ] && echo myapp-web && exit 0\n[ "$1 $2 $3" = "image inspect myapp-web" ] || exit 2\n[ "${sizeBytes}" = "missing" ] && exit 1\necho ${sizeBytes}\n`,
  );
  chmodSync(join(bin, 'docker'), 0o755);
  try {
    const out = execFileSync('sh', ['tools/image-size.sh', ...args], {
      env: { PATH: `${bin}:/usr/bin:/bin` },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (error) {
    const e = error as { status: number; stdout: string };
    return { code: e.status, out: e.stdout };
  }
}

describe('tools/image-size.sh', () => {
  it('passes an image under the limit and prints its size', () => {
    const r = run('21400000');
    expect(r.code).toBe(0);
    expect(r.out).toContain('21.4 MB');
  });

  it('fails an image over 50 MB', () => {
    const r = run('50000001');
    expect(r.code).toBe(1);
    expect(r.out).toContain('over 50 MB');
  });

  it('asks Compose for the image name, which depends on the folder name', () => {
    expect(run('1000000').out).toContain('myapp-web is 1.0 MB');
  });

  it('fails when the image has not been built', () => {
    const r = run('missing');
    expect(r.code).toBe(1);
    expect(r.out).toContain('docker compose build web');
  });
});
