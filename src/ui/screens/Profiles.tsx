import { useState } from 'react';
import type { ProfileRow } from '../../data/db.ts';
import {
  HOUSES,
  MASCOT_COLORS,
  MAX_NAME_LENGTH,
  validateName,
  validateProfile,
  type ProfileRepo,
} from '../../data/profiles.ts';
import styles from './GrandTrial.module.css';

const houseName = (id: string | null) => HOUSES.find((h) => h.id === id)?.name ?? 'No house';
const colorOf = (id: string) => MASCOT_COLORS.find((c) => c.id === id);

/** A colour swatch that always comes with its name, so colour is never the only cue. */
function Swatch({ colorId }: { colorId: string }) {
  const color = colorOf(colorId);
  return (
    <span className={styles.swatchLabel}>
      <span className={styles.swatch} style={{ background: color?.hex }} aria-hidden="true" />
      {color?.name ?? colorId}
    </span>
  );
}

/** Who's playing? The list of students, adding one, and (for a parent) renaming or deleting. */
export function Profiles(props: {
  profiles: readonly ProfileRow[];
  repo: Pick<ProfileRepo, 'create' | 'rename' | 'remove'>;
  onChoose: (id: string) => void;
  /** Called after a change, so the list is read again. */
  onChanged: () => Promise<void>;
}) {
  const { profiles, repo, onChoose, onChanged } = props;
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);

  if (profiles.length === 0 || adding) {
    return (
      <ProfileForm
        first={profiles.length === 0}
        onCancel={profiles.length === 0 ? undefined : () => setAdding(false)}
        onSave={async (input) => {
          const created = await repo.create(input);
          await onChanged();
          setAdding(false);
          onChoose(created.id);
        }}
      />
    );
  }

  return (
    <main className={styles.screen} aria-label="Who's playing">
      <h1>Who&apos;s playing?</h1>
      <ul className={styles.reviewList}>
        {profiles.map((p) => (
          <li key={p.id}>
            {managing ? (
              <ManageRow profile={p} repo={repo} onChanged={onChanged} />
            ) : (
              <button
                type="button"
                className={styles.button}
                onClick={() => onChoose(p.id)}
                data-testid="profiles.choose"
              >
                {p.displayName} · {houseName(p.house)} · <Swatch colorId={p.mascotColor} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className={styles.nav}>
        <button
          type="button"
          className={styles.button}
          onClick={() => setAdding(true)}
          data-testid="profiles.add"
        >
          Add a student
        </button>
        <button
          type="button"
          className={styles.button}
          aria-pressed={managing}
          onClick={() => setManaging(!managing)}
          data-testid="profiles.manage"
        >
          {managing ? 'Done managing' : 'Manage students (for parents)'}
        </button>
      </div>
    </main>
  );
}

function ManageRow(props: {
  profile: ProfileRow;
  repo: Pick<ProfileRepo, 'rename' | 'remove'>;
  onChanged: () => Promise<void>;
}) {
  const { profile, repo, onChanged } = props;
  const [name, setName] = useState(profile.displayName);
  const [confirming, setConfirming] = useState(false);
  const check = validateName(name);
  const inputId = `rename-${profile.id}`;

  if (confirming) {
    return (
      <div className={styles.quantity} role="alertdialog" aria-labelledby={`${inputId}-confirm`}>
        <p id={`${inputId}-confirm`}>
          Delete {profile.displayName} and all of their progress? This can&apos;t be undone.
        </p>
        <div className={styles.nav}>
          <button
            type="button"
            className={styles.button}
            onClick={() => setConfirming(false)}
            data-testid="profiles.keep"
          >
            Keep {profile.displayName}
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={async () => {
              await repo.remove(profile.id);
              await onChanged();
            }}
            data-testid="profiles.confirm-delete"
          >
            Delete {profile.displayName}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.nav}>
      <label htmlFor={inputId} className={styles.choice}>
        Name:
        <input
          id={inputId}
          value={name}
          maxLength={MAX_NAME_LENGTH + 5}
          onChange={(e) => setName(e.target.value)}
          className={styles.text}
          data-testid="profiles.rename-input"
        />
      </label>
      <button
        type="button"
        className={styles.button}
        disabled={!check.ok || check.value === profile.displayName}
        onClick={async () => {
          await repo.rename(profile.id, name);
          await onChanged();
        }}
        data-testid="profiles.rename"
      >
        Save name
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={() => setConfirming(true)}
        data-testid="profiles.delete"
      >
        Delete…
      </button>
      {!check.ok && <p data-testid="profiles.rename-error">{check.error}</p>}
    </div>
  );
}

function ProfileForm(props: {
  first: boolean;
  onCancel?: () => void;
  onSave: (input: { displayName: string; house: string; mascotColor: string }) => Promise<void>;
}) {
  const { first, onCancel, onSave } = props;
  const [displayName, setDisplayName] = useState('');
  const [house, setHouse] = useState('');
  const [mascotColor, setMascotColor] = useState('');
  const [touched, setTouched] = useState(false);
  const check = validateProfile({ displayName, house, mascotColor });

  return (
    <main className={styles.screen} aria-label={first ? 'Welcome' : 'Add a student'}>
      <h1>{first ? 'Welcome to Comparia Academy!' : 'Add a student'}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (check.ok) void onSave(check.value);
        }}
      >
        <label htmlFor="profile-name" className={styles.choice}>
          Your name on screen:
        </label>
        <input
          id="profile-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          aria-describedby="profile-name-hint"
          autoComplete="off"
          className={styles.text}
          data-testid="profiles.name"
        />
        <p id="profile-name-hint">
          Use a nickname. Don&apos;t type your full real name: this app keeps only a nickname, a
          house and a colour.
        </p>

        <fieldset>
          <legend>Choose your house</legend>
          {HOUSES.map((h) => (
            <label key={h.id} className={styles.choice}>
              <input
                type="radio"
                name="house"
                value={h.id}
                checked={house === h.id}
                onChange={() => setHouse(h.id)}
                data-testid={`profiles.house-${h.id}`}
              />
              {h.name} ({h.mascot})
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>Choose your mascot colour</legend>
          {MASCOT_COLORS.map((c) => (
            <label key={c.id} className={styles.choice}>
              <input
                type="radio"
                name="color"
                value={c.id}
                checked={mascotColor === c.id}
                onChange={() => setMascotColor(c.id)}
                data-testid={`profiles.color-${c.id}`}
              />
              <Swatch colorId={c.id} />
            </label>
          ))}
        </fieldset>

        {touched && !check.ok && (
          <p role="alert" data-testid="profiles.error">
            {check.error}
          </p>
        )}
        <div className={styles.nav}>
          {onCancel !== undefined && (
            <button
              type="button"
              className={styles.button}
              onClick={onCancel}
              data-testid="profiles.cancel"
            >
              Cancel
            </button>
          )}
          <button type="submit" className={styles.button} data-testid="profiles.save">
            {first ? 'Start my adventure' : 'Add student'}
          </button>
        </div>
      </form>
    </main>
  );
}
