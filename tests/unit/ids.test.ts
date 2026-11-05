// Checkpoint E found it: on a plain-IP address (an iPad opening http://192.168.x.x:5173) the page is not a secure
// context, so crypto.randomUUID is missing and "Start my adventure" did nothing. Ids must not need a secure context.
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDb } from '../../src/data/db.ts';
import { newId } from '../../src/data/ids.ts';
import { createProfileRepo } from '../../src/data/profiles.ts';

/** Crypto as an insecure page sees it: getRandomValues, no randomUUID. */
function insecureCrypto() {
  const real = globalThis.crypto;
  vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('newId', () => {
  it('is a version 4 UUID', () => {
    expect(newId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 1000 }, newId));
    expect(ids.size).toBe(1000);
  });

  it('works without crypto.randomUUID', () => {
    insecureCrypto();
    expect(newId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('a profile can be created on a page that is not a secure context', async () => {
    insecureCrypto();
    const db = openDb('ids-test', { indexedDB: new IDBFactory(), IDBKeyRange });
    const created = await createProfileRepo(db).create({
      displayName: 'Mo',
      house: 'foxglen',
      mascotColor: 'teal',
    });
    expect(created.displayName).toBe('Mo');
    db.close();
  });
});
