import {
  Head,
  P,
  Sleuth,
  SleuthDefs,
  SleuthKeyframes,
  type SleuthPose,
  VerdictStamp,
  type Verdict,
} from "./figures.js";

/**
 * The atoms: each a standalone SVG, drawn from the figures (figures.tsx), with no words in the art. Words a
 * surface wants -- a title for screen readers, a stamp's verdict, a wordmark's name -- are props.
 */

/** The five poses, and `holding-page`, the reading pose with a page in front of him. */
export const POSES: readonly SleuthPose[] = [
  "hanging",
  "reading",
  "holding-page",
  "pointing",
  "holding-door",
  "tipping-hat",
];

/**
 * Each pose's frame, around the figure at the origin: x, y, width, height. Measured from the painted pixels of
 * each pose (rendered alone in Chrome), with a 12-unit margin all round.
 */
const FRAME: Record<SleuthPose, [number, number, number, number]> = {
  hanging: [-139, -173, 281, 504],
  reading: [-111, -144, 284, 467],
  "holding-page": [-129, -144, 302, 398],
  pointing: [-108, -145, 421, 471],
  "holding-door": [-142, -145, 406, 476],
  "tipping-hat": [-142, -159, 275, 490],
};

interface AtomProps {
  /** Read by screen readers, and shown as a tooltip. */
  title: string;
  /** The rendered width, in CSS pixels; the height follows the frame. */
  width?: number;
  /** Still the figure: no breathing, no hat tip, no stamp landing. For prefers-reduced-motion, and for images. */
  still?: boolean;
}

/** The sloth private eye, in one of his poses. */
export function SleuthAtom({ pose, title, width = 260, still = false }: AtomProps & { pose: SleuthPose }) {
  const [x, y, w, h] = FRAME[pose];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${x} ${y} ${w} ${h}`}
      width={width}
      height={Math.round((width * h) / w)}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <SleuthDefs />
      {!still && <SleuthKeyframes />}
      <Sleuth pose={pose} x={0} y={0} breathe={!still} />
    </svg>
  );
}

/** The backgrounds an atom is drawn for: GitHub's light and dark, and the office's own wall. */
export const THEMES = { light: "#ffffff", dark: "#0d1117", office: P.wall } as const;
export type Theme = keyof typeof THEMES;

/**
 * The stamp's ink on each theme. On light, the figures' own red. On a dark background that red falls short of
 * a word's 4.5 : 1, so dark takes the same red mixed 28% toward white: the nearest that reads on both darks.
 */
export const STAMP_INK: Record<Theme, string> = { light: P.stamp, dark: "#c96169", office: "#c96169" };

/** The verdict stamp. The word is a prop: READY, NEARLY or NOT READY. */
export function StampAtom({
  word,
  title,
  width = 220,
  still = false,
  theme = "light",
}: AtomProps & { word: Verdict; theme?: Theme }) {
  const w = Math.max(150, word.length * 30 + 48);
  // The stamp lands rotated; the frame leaves room for the turn.
  const fw = w + 60;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${-fw / 2} -70 ${fw} 140`}
      width={width}
      height={Math.round((width * 140) / fw)}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <SleuthDefs />
      {!still && <SleuthKeyframes />}
      {still ? (
        // Still: the landed stamp with no keyframes mounted, so the landing has nothing to play, turned as it
        // rests once it has landed.
        <g transform="rotate(-8)">
          <VerdictStamp x={0} y={0} word={word} ink={STAMP_INK[theme]} />
        </g>
      ) : (
        <VerdictStamp x={0} y={0} word={word} ink={STAMP_INK[theme]} />
      )}
    </svg>
  );
}

/** The mark: his head and hat, drawn from the figure, framed to read at 16 pixels. */
export function LogoMark({ title, size = 64 }: { title: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-104 -145 208 215"
      width={size}
      height={Math.round((size * 215) / 208)}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <SleuthDefs />
      <Head />
    </svg>
  );
}

/** The wordmark's ink on each theme: the fedora's brown on light, the face's cream on dark. */
export const LOCKUP_INK: Record<Theme, string> = { light: P.fedora, dark: P.face, office: P.face };

/** The mark with the name beside it. The name is a prop, so the lockup carries no words of its own. */
export function LogoLockup({
  title,
  name,
  height = 64,
  theme = "light",
}: {
  title: string;
  name: string;
  height?: number;
  /** The background it sits on: the name's ink is chosen to read on it. */
  theme?: Theme;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-104 -145 853 215"
      height={height}
      width={Math.round((height * 853) / 215)}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <SleuthDefs />
      <Head />
      <text
        x={130}
        y={-24}
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontSize={104}
        fontWeight={800}
        fill={LOCKUP_INK[theme]}
      >
        {name}
      </text>
    </svg>
  );
}
