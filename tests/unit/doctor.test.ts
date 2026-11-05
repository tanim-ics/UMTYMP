// tools/doctor.sh checks the host's Docker setup before the first `docker compose up`. A machine that once had
// Docker Desktop can keep a dead buildx plugin link and a `credsStore` pointing at a helper that is gone; both break
// every build with errors that don't mention the cause. These tests run the script against a fake `docker` and a
// throwaway HOME, so they never touch the real machine.
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../tools/doctor.sh', import.meta.url));

// A stand-in docker CLI: every subcommand the doctor uses succeeds unless FAKE_FAIL names it.
const FAKE_DOCKER = `#!/bin/sh
case " $FAKE_FAIL " in *" $1 "*) echo "fake $1 failure" >&2; exit 1;; esac
echo "fake docker $*"
`;

interface Machine {
  home: string;
  bin: string;
  config: string;
}

function machine(configJson?: string): Machine {
  const home = mkdtempSync(join(tmpdir(), 'doctor-'));
  const bin = join(home, 'bin');
  mkdirSync(bin);
  mkdirSync(join(home, '.docker', 'cli-plugins'), { recursive: true });
  writeFileSync(join(bin, 'docker'), FAKE_DOCKER);
  chmodSync(join(bin, 'docker'), 0o755);
  const config = join(home, '.docker', 'config.json');
  if (configJson !== undefined) writeFileSync(config, configJson);
  return { home, bin, config };
}

function addHelper(m: Machine, name: string): void {
  const file = join(m.bin, `docker-credential-${name}`);
  writeFileSync(file, '#!/bin/sh\n');
  chmodSync(file, 0o755);
}

function run(m: Machine, args: string[] = [], fail = ''): { code: number; out: string } {
  try {
    const out = execFileSync('sh', [SCRIPT, ...args], {
      env: { HOME: m.home, PATH: `${m.bin}:/usr/bin:/bin`, FAKE_FAIL: fail },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (error) {
    const e = error as { status: number; stdout: string };
    return { code: e.status, out: e.stdout };
  }
}

describe('tools/doctor.sh', () => {
  it('passes a healthy machine', () => {
    const m = machine('{"auths": {}}');
    const r = run(m);
    expect(r.code).toBe(0);
    expect(r.out).toContain('All checks passed');
  });

  it('passes when the configured credential helper exists', () => {
    const m = machine('{"credsStore": "osxkeychain"}');
    addHelper(m, 'osxkeychain');
    expect(run(m).code).toBe(0);
  });

  it('fails with an install hint when docker is missing', () => {
    const m = machine();
    const r = execFileSync('sh', ['-c', `sh "${SCRIPT}"; echo "exit=$?"`], {
      env: { HOME: m.home, PATH: '/usr/bin:/bin' },
      encoding: 'utf8',
    });
    expect(r).toContain('Docker is not installed');
    expect(r).toContain('exit=1');
  });

  it('fails when the Docker daemon is not running', () => {
    const r = run(machine(), [], 'info');
    expect(r.code).toBe(1);
    expect(r.out).toContain('not running');
  });

  it('fails when Compose v2 is missing', () => {
    const r = run(machine(), [], 'compose');
    expect(r.code).toBe(1);
    expect(r.out).toContain('docker compose');
  });

  it('names a dead buildx link and how to fix it', () => {
    const m = machine();
    const link = join(m.home, '.docker', 'cli-plugins', 'docker-buildx');
    symlinkSync('/nowhere/docker-buildx', link);
    const r = run(m, [], 'buildx');
    expect(r.code).toBe(1);
    expect(r.out).toContain('broken link');
    expect(r.out).toContain('--fix');
  });

  it('--fix removes the dead buildx link', () => {
    const m = machine();
    const link = join(m.home, '.docker', 'cli-plugins', 'docker-buildx');
    symlinkSync('/nowhere/docker-buildx', link);
    run(m, ['--fix'], 'buildx');
    expect(existsSync(link)).toBe(false);
  });

  it('fails when credsStore names a helper that is not installed', () => {
    const m = machine('{\n  "auths": {},\n  "credsStore": "desktop"\n}\n');
    const r = run(m);
    expect(r.code).toBe(1);
    expect(r.out).toContain('docker-credential-desktop');
  });

  it('--fix drops the dead credsStore, keeps a backup and leaves valid JSON', () => {
    const original = '{\n  "auths": {\n    "ghcr.io": {}\n  },\n  "credsStore": "desktop"\n}\n';
    const m = machine(original);
    const r = run(m, ['--fix']);
    expect(r.code).toBe(0);
    const fixed = JSON.parse(readFileSync(m.config, 'utf8')) as Record<string, unknown>;
    expect(fixed).toEqual({ auths: { 'ghcr.io': {} } });
    expect(readFileSync(`${m.config}.bak`, 'utf8')).toBe(original);
  });

  it('--fix handles credsStore as the first key', () => {
    const m = machine('{"credsStore": "desktop", "currentContext": "default"}');
    expect(run(m, ['--fix']).code).toBe(0);
    expect(JSON.parse(readFileSync(m.config, 'utf8'))).toEqual({ currentContext: 'default' });
  });

  it('does not touch the config without --fix', () => {
    const original = '{"credsStore": "desktop"}';
    const m = machine(original);
    run(m);
    expect(readFileSync(m.config, 'utf8')).toBe(original);
  });
});
