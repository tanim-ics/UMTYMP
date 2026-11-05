import styles from '../screens/GrandTrial.module.css';

/** The pictures in public/art/ (Task 20, logged in docs/ASSETS.md). A missing name is a type error. */
export const ART = [
  'hoot',
  'crest-owlcrest',
  'crest-emberwing',
  'crest-foxglen',
  'crest-starhorn',
  'castle-map',
  'potion',
  'spellbook',
] as const;
export type ArtName = (typeof ART)[number];

const SIZES = {
  icon: { width: 48, height: 48 },
  medium: { width: 96, height: 96 },
  banner: { width: 480, height: 300 },
} as const;

/**
 * A decorative picture: the words beside it always say the same thing, so the alt text is empty and screen readers
 * skip it. Sizes are fixed so the page doesn't jump while the file loads.
 */
export function Art(props: { name: ArtName; size?: 'icon' | 'medium' | 'banner'; testId: string }) {
  const { name, size = 'icon', testId } = props;
  const { width, height } = SIZES[size];
  return (
    <img
      src={`${import.meta.env.BASE_URL}art/${name}.svg`}
      alt=""
      width={width}
      height={height}
      className={`${styles.art} ${size === 'banner' ? styles.artBanner : ''}`}
      data-testid={testId}
    />
  );
}
