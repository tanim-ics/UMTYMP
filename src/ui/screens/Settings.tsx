import { useState } from 'react';
import type { ProfileRow } from '../../data/db.ts';
import { MAX_IMPORT_BYTES, type Transfer } from '../../data/transfer.ts';
import { fileSafe } from '../download.ts';
import styles from './GrandTrial.module.css';

/** Settings & data for parents (docs/SPEC.md P2): export a student, import one, reset everything. */
export function Settings(props: {
  profiles: readonly ProfileRow[];
  transfer: Transfer;
  download: (fileName: string, text: string) => void;
  /** After an import or a reset, so the student list is read again. */
  onChanged: () => Promise<void>;
  onReset: () => void;
  onBack: () => void;
}) {
  const { profiles, transfer, download, onChanged, onReset, onBack } = props;
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const exportOne = async (p: ProfileRow) => {
    const date = new Date().toISOString().slice(0, 10);
    download(`comparia-${fileSafe(p.displayName)}-${date}.json`, await transfer.exportText(p.id));
  };

  const importFile = async (file: File | undefined) => {
    if (file === undefined) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setImportResult({ ok: false, message: 'This file is too big to be a saved student.' });
      return;
    }
    const result = await transfer.importText(await file.text());
    if (result.ok) {
      setImportResult({ ok: true, message: `Added ${result.profile.displayName}.` });
      await onChanged();
    } else {
      setImportResult({ ok: false, message: result.error });
    }
  };

  return (
    <main className={styles.screen} aria-label="Settings and data">
      <button
        type="button"
        className={styles.topBack}
        onClick={onBack}
        data-testid="settings.back-top"
      >
        ← Back
      </button>
      <h1>Settings &amp; data</h1>
      <p>Everything stays in this browser. Use a file to move a student to another device.</p>

      {profiles.length > 0 && (
        <section className={styles.card} aria-labelledby="export-heading">
          <h2 id="export-heading">Save a student to a file</h2>
          <div className={styles.nav}>
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                className={styles.button}
                onClick={() => void exportOne(p)}
                data-testid="settings.export"
              >
                Export {p.displayName}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={styles.card} aria-labelledby="import-heading">
        <h2 id="import-heading">Bring a student from a file</h2>
        <label htmlFor="settings-import" className={styles.choice}>
          Choose a saved student file:
        </label>
        <input
          id="settings-import"
          type="file"
          accept="application/json,.json"
          onChange={(e) => void importFile(e.target.files?.[0])}
          data-testid="settings.import"
        />
        {importResult !== null &&
          (importResult.ok ? (
            <p role="status" data-testid="settings.import-ok">
              {importResult.message}
            </p>
          ) : (
            <p role="alert" data-testid="settings.import-error">
              {importResult.message}
            </p>
          ))}
      </section>

      <section className={styles.card} aria-labelledby="reset-heading">
        <h2 id="reset-heading">Reset all data</h2>
        {confirming ? (
          <div role="alertdialog" aria-labelledby="reset-confirm">
            <p id="reset-confirm">
              Delete every student and all progress on this device? Export first if you want to keep
              anything. This can&apos;t be undone.
            </p>
            <div className={styles.nav}>
              <button
                type="button"
                className={styles.button}
                onClick={() => setConfirming(false)}
                data-testid="settings.keep"
              >
                Keep my data
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={async () => {
                  await transfer.resetAll();
                  await onChanged();
                  onReset();
                }}
                data-testid="settings.confirm-reset"
              >
                Delete everything
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={styles.button}
            onClick={() => setConfirming(true)}
            data-testid="settings.reset"
          >
            Reset all data…
          </button>
        )}
      </section>

      <button type="button" className={styles.button} onClick={onBack} data-testid="settings.back">
        ← Back
      </button>
    </main>
  );
}
