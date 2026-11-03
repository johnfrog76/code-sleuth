// Code Sleuth's figures, drawn for the Code Sleuth deck and taken whole as the product's atoms. One source:
// every path, shape and colour is as drawn for the deck.
// Changed here, and nothing else: these comments; Scene's <defs> lifted into an exported SleuthDefs (which Scene
// renders), so a standalone atom paints with the same gradients and filters; Hat, Face and Head exported, so
// the logo is drawn from them; and VerdictStamp's red taken as an optional `ink` prop (the same red by
// default), so the stamp atom can read on a dark background. The file imports nothing but React's types.
//
import type { CSSProperties, ReactNode } from "react";

// Code Sleuth — the figures: the sloth private eye, his office and the jungle
// outside it. One source for the deck and for the product, which takes this
// file whole as its hero atom.
//
// Design source: design/code-sleuth.md. The look: paper objects layered
// hard-edged on a desk, a page as a specimen card, in a built dark world lit
// from inside, every word on a surface in the scene. Two places: the bright
// jungle outside and the old-school office inside, joined by the slat-blind
// window.
//
// The sloth is the README's ASCII sloth: a fedora, a wide cream face with eye
// stripes running DOWN AND OUTWARD from each eye (inward reads as tears), a
// small nose, a wide smile, a double-breasted trench coat, three hooked claws.
// No hands in this style: a claw is three hooks on a sleeve, and the
// magnifying glass hangs from one by its ring. The art carries no words: every
// label is a prop, so the copy stays in whichever surface mounts him.
//
// This file imports nothing from the engine or anywhere else, so it stands on
// its own.

export const MONO = "'Cascadia Code', 'Fira Code', 'Consolas', monospace";
export const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// ── Palette — named for what the colours MEAN in this world ──────────────────
export const P = {
  // trench — the sleuth himself: the coat's tan, the fedora's brown, the folder's manila
  trench: "#c9a26a",
  trenchLit: "#e4c48f",
  trenchDeep: "#8a6a3e",
  trenchEdge: "#5a4225",
  fedora: "#5a4330",
  fedoraLit: "#7a5d44",
  fedoraBand: "#2a1d14",
  fur: "#8c7556",
  furDeep: "#5c4a35",
  face: "#ece0c8",
  stripe: "#3a2a1e",
  eye: "#15100b",
  claw: "#d8c49c",
  manila: "#d9b97a",
  manilaDeep: "#b8955a",
  // canopy — the jungle's greens, from the bright boards
  canopy: "#2f8a44",
  canopyLit: "#8fd45e",
  canopyDeep: "#145232",
  canopyNight: "#0b2e1e",
  sky: "#9fe0f2",
  skyDeep: "#4fb6d8",
  // the jungle unkept: dusk, not night; the stage's own dark, with fog in it
  skyDusk: "#2e4e5c",
  skyDuskDeep: "#0f2a2c",
  dusk: "#5c7a80",
  fog: "#8fa8a2",
  bough: "#6b4a2c",
  boughLit: "#8d6a44",
  // bloom — orchids and heliconia: there is more in there than leaves
  orchid: "#d94ea6",
  orchidLit: "#f08ccb",
  heliconia: "#f0641e",
  bromeliad: "#e23a4f",
  hibiscus: "#f4c53d",
  // lamplight — the desk lamp's warm cone and the paper under it
  lamp: "#ffd9a0",
  lampHot: "#fff1cf",
  paper: "#f2e7d0",
  paperDeep: "#d8c7a4",
  paperEdge: "#b9a37c",
  // ink — a state made true by writing it
  stamp: "#b4232f",
  type: "#2a2420",
  typeSoft: "#6b5f55",
  // the office at night: the stage's own dark, never painted black
  wall: "#1c1712",
  wallLit: "#2e261c",
  floor: "#120e09",
  desk: "#4a3321",
  deskLit: "#6a4b30",
  deskEdge: "#2b1c10",
  glass: "#bfe6ef",
  // the CLI's own weights, quoted from src/cli/output.ts (ANSI on a terminal)
  gun: "#e0343c",
  loose: "#d9a62a",
  hunch: "#3bbfc9",
  clean: "#3fbf5a",
  dim: "#8a8078",
} as const;

export const STAGE_BG_OFFICE = `linear-gradient(180deg, ${P.wall} 0%, ${P.floor} 100%)`;
export const STAGE_BG_JUNGLE = `linear-gradient(180deg, ${P.sky} 0%, ${P.canopy} 55%, ${P.canopyDeep} 100%)`;
export const STAGE_BG_JUNGLE_DARK = `linear-gradient(180deg, ${P.skyDusk} 0%, ${P.canopyNight} 55%, ${P.floor} 100%)`;

// CSS custom properties in inline styles need one widening cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const v = (o: Record<string, string | number>) => o as any as CSSProperties;

// ── Keyframes — one block, mounted inside every Stage ────────────────────────
// Every entrance animates FROM a hidden keyframe with `backwards` fill and the
// visible state as the base style. Anything invisible at
// rest carries `opacity: 0` in its static style, for the frozen poster wall.
export function SleuthKeyframes() {
  return (
    <style>{`
      /* things arriving in the room — the sleuth, the folder, a page */
      @keyframes cs-settle  { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
      @keyframes cs-fade    { from { opacity: 0; } to { opacity: 1; } }
      /* the sleuth breathing: slower than anything else in the room */
      @keyframes cs-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.018); } }
      /* the canopy, alive and full; the blooms ride the same air */
      @keyframes cs-sway    { 0%, 100% { transform: rotate(-1.2deg); } 50% { transform: rotate(1.2deg); } }
      @keyframes cs-drift   { 0%, 100% { transform: translateX(-10px); } 50% { transform: translateX(10px); } }
      /* something small catching the light down in the undergrowth */
      @keyframes cs-glint   { 0%, 72%, 100% { opacity: 0.25; transform: scale(1); } 80% { opacity: 1; transform: scale(1.6); } }
      /* the slat light shifting across the wall, 2000ms, never restless */
      @keyframes cs-slat    { 0%, 100% { opacity: 0.55; transform: translateX(0); } 50% { opacity: 0.75; transform: translateX(14px); } }
      /* the verdict landing: once, hard, then holding */
      @keyframes cs-stamp   { 0% { opacity: 0; transform: scale(1.7) rotate(-8deg); } 60% { opacity: 1; transform: scale(0.96) rotate(-8deg); } 100% { opacity: 1; transform: scale(1) rotate(-8deg); } }
      /* the stakeout's dots, typed one at a time */
      @keyframes cs-type    { from { opacity: 0; } to { opacity: 1; } }
      /* a typewriter key dipping under a dot */
      @keyframes cs-key     { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(3px); } }
      /* steam off the mug */
      @keyframes cs-steam   { 0% { opacity: 0; transform: translateY(0) scaleX(1); } 30% { opacity: 0.55; } 100% { opacity: 0; transform: translateY(-46px) scaleX(1.4); } }
      /* the hat, tipped: lifts, tilts, holds */
      @keyframes cs-hattip  { 0% { transform: translate(0, 0) rotate(0deg); } 100% { transform: translate(6px, -18px) rotate(-12deg); } }
      /* a card posted: off the desk, out the door, settling in the lit room beyond */
      @keyframes cs-post    { 0% { opacity: 0; transform: translate(0, 0) scale(1); } 12% { opacity: 1; } 100% { opacity: 1; transform: translate(730px, -200px) scale(0.8); } }
      /* the sleuth hanging: the whole figure swings a little on the bough */
      @keyframes cs-hang    { 0%, 100% { transform: rotate(-1.5deg); } 50% { transform: rotate(1.5deg); } }
    `}</style>
  );
}

// ── Stage and Scene ──────────────────────────────────────────────────────────
export function Stage({ children, bg = STAGE_BG_OFFICE }: { children: ReactNode; bg?: string }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: bg }}>
      <SleuthKeyframes />
      {children}
    </div>
  );
}

/** The gradients and filters every figure paints with: mounted inside Scene, and inside each standalone atom. */
export function SleuthDefs() {
  return (
    <defs>
      {/* the lamp's cone on the blotter */}
      <radialGradient id="cs-lamp" cx="50%" cy="0%" r="80%">
        <stop offset="0%" stopColor={P.lampHot} stopOpacity="0.55" />
        <stop offset="45%" stopColor={P.lamp} stopOpacity="0.22" />
        <stop offset="100%" stopColor={P.lamp} stopOpacity="0" />
      </radialGradient>
      {/* the wall's own light: brightest where the lamp is */}
      <radialGradient id="cs-wallglow" cx="50%" cy="60%" r="70%">
        <stop offset="0%" stopColor={P.wallLit} />
        <stop offset="100%" stopColor={P.wall} />
      </radialGradient>
      {/* a sheet of paper, lit from above-left */}
      <linearGradient id="cs-paper" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stopColor={P.paper} />
        <stop offset="100%" stopColor={P.paperDeep} />
      </linearGradient>
      {/* manila, the same way */}
      <linearGradient id="cs-manila" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0%" stopColor={P.manila} />
        <stop offset="100%" stopColor={P.manilaDeep} />
      </linearGradient>
      {/* the coat: lit on the left shoulder, deep under the collar */}
      <linearGradient id="cs-coat" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={P.trenchLit} />
        <stop offset="55%" stopColor={P.trench} />
        <stop offset="100%" stopColor={P.trenchDeep} />
      </linearGradient>
      <linearGradient id="cs-hat" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={P.fedoraLit} />
        <stop offset="100%" stopColor={P.fedora} />
      </linearGradient>
      <linearGradient id="cs-fur" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={P.fur} />
        <stop offset="100%" stopColor={P.furDeep} />
      </linearGradient>
      {/* the glass: a cold highlight across a warm room */}
      <radialGradient id="cs-lens" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
        <stop offset="40%" stopColor={P.glass} stopOpacity="0.35" />
        <stop offset="100%" stopColor={P.glass} stopOpacity="0.12" />
      </radialGradient>
      {/* daylight down through the canopy */}
      <linearGradient id="cs-shaft" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={P.lampHot} stopOpacity="0.5" />
        <stop offset="100%" stopColor={P.lampHot} stopOpacity="0" />
      </linearGradient>
      <linearGradient id="cs-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={P.sky} />
        <stop offset="100%" stopColor={P.skyDeep} />
      </linearGradient>
      <linearGradient id="cs-under" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={P.canopyDeep} stopOpacity="0" />
        <stop offset="100%" stopColor={P.canopyNight} />
      </linearGradient>
      {/* the jungle unkept: a dusk sky, and an undergrowth that starts higher and goes darker */}
      <linearGradient id="cs-sky-dusk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={P.skyDusk} />
        <stop offset="100%" stopColor={P.skyDuskDeep} />
      </linearGradient>
      <linearGradient id="cs-under-dusk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={P.canopyNight} stopOpacity="0" />
        <stop offset="55%" stopColor={P.canopyNight} stopOpacity="0.8" />
        <stop offset="100%" stopColor={P.floor} />
      </linearGradient>
      {/* rubber-stamp grit: the ink that did not quite take */}
      <filter id="cs-grit" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" />
        <feColorMatrix
          in="n"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.6"
          result="m"
        />
        <feComposite in="SourceGraphic" in2="m" operator="in" />
      </filter>
      <filter id="cs-soft" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="8" />
      </filter>
      <filter id="cs-blur" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="22" />
      </filter>
      {/* the frosted glass of the door: what is behind it, softened */}
      <filter id="cs-frost" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
    </defs>
  );
}

/** The 1600×900 canvas, sliced to the panel: discrete atoms live in x≈300–1300. */
export function Scene({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <SleuthDefs />
      {children}
    </svg>
  );
}

/** Push the camera: cx,cy is the point that lands at centre, k the zoom. */
export function Camera({ cx, cy, k, children }: { cx: number; cy: number; k: number; children: ReactNode }) {
  return <g transform={`translate(${800 - cx * k} ${450 - cy * k}) scale(${k})`}>{children}</g>;
}

export const settle = (d: number, dur = 0.9): CSSProperties => ({
  animation: `cs-settle ${dur}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${d}s backwards`,
});

// ── The Sleuth ───────────────────────────────────────────────────────────────
export type SleuthPose = "hanging" | "reading" | "holding-page" | "pointing" | "holding-door" | "tipping-hat";

/** Three hooked claws on the end of a sleeve — hooks, never fingers. */
function Claw({ open = false }: { open?: boolean }) {
  const hooks = open ? [-14, 0, 14] : [-11, 0, 11];
  return (
    <g>
      <ellipse cx={0} cy={0} rx={19} ry={13} fill="url(#cs-fur)" />
      {/* three claws: long, pale bone, tapered to a hook — a sloth's most legible feature */}
      {hooks.map((dx) => {
        const tx = dx * 1.2;
        const cx = dx * 0.5;
        return (
          <path
            key={dx}
            d={`M ${dx - 4.5} 3 Q ${cx - 3} 30 ${tx} 52 Q ${cx + 4} 30 ${dx + 4.5} 3 Z`}
            fill={P.claw}
            stroke={P.furDeep}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        );
      })}
    </g>
  );
}

/** The magnifying glass, hanging from a claw by its ring. */
function Glass({ r = 30 }: { r?: number }) {
  return (
    <g>
      <rect x={-6} y={-6} width={12} height={46} rx={5} fill={P.fedoraBand} />
      <rect x={-4} y={-4} width={8} height={40} rx={4} fill={P.trenchDeep} />
      <circle cx={0} cy={-r - 10} r={r + 6} fill={P.fedoraBand} />
      <circle cx={0} cy={-r - 10} r={r} fill="url(#cs-lens)" stroke={P.trenchLit} strokeWidth={3} />
      <path
        d={`M ${-r * 0.55} ${-r - 10 - r * 0.45} q ${r * 0.3} ${-r * 0.35} ${r * 0.8} ${-r * 0.1}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.8}
      />
    </g>
  );
}

/** One arm: upper and forearm, two angles, a claw at the end, optionally the glass. */
function Arm({
  side,
  upper,
  fore,
  glass = false,
  open = false,
}: {
  side: -1 | 1;
  upper: number;
  fore: number;
  glass?: boolean;
  open?: boolean;
}) {
  const sx = side * 64;
  const sy = 78;
  return (
    <g transform={`translate(${sx} ${sy}) rotate(${upper})`}>
      {/* the sleeve: coat over fur, a cuff at the elbow */}
      <rect x={-18} y={-10} width={36} height={96} rx={17} fill="url(#cs-coat)" />
      <g transform={`translate(0 84) rotate(${fore})`}>
        <rect x={-16} y={-8} width={32} height={100} rx={15} fill="url(#cs-coat)" />
        <rect x={-18} y={74} width={36} height={14} rx={6} fill={P.trenchDeep} />
        <g transform="translate(0 100)">
          <Claw open={open} />
          {glass && (
            <g transform="translate(6 26) rotate(28)">
              <Glass />
            </g>
          )}
        </g>
      </g>
    </g>
  );
}

export function Hat({ tip = false }: { tip?: boolean }) {
  return (
    <g
      style={
        tip
          ? {
              animation: "cs-hattip 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94) 1.1s both",
              transformOrigin: "40px -70px",
            }
          : undefined
      }
    >
      {/* brim: a wide ellipse, dipped at the front */}
      <ellipse cx={0} cy={-52} rx={92} ry={16} fill={P.fedora} />
      <ellipse cx={0} cy={-55} rx={90} ry={12} fill="url(#cs-hat)" />
      {/* crown with the pinch */}
      <path d="M -54 -56 L -48 -118 Q -30 -134 0 -128 Q 30 -134 48 -118 L 54 -56 Z" fill="url(#cs-hat)" />
      <path d="M -22 -126 Q 0 -140 22 -126 Q 0 -118 -22 -126 Z" fill={P.fedora} />
      {/* the band */}
      <path d="M -51 -78 Q 0 -70 51 -78 L 52 -64 Q 0 -56 -52 -64 Z" fill={P.fedoraBand} />
    </g>
  );
}

/**
 * The face, hatless: one source for every pose. From the photograph: a cream
 * mask, a dark band that holds each eye and runs DOWN AND OUTWARD to the jaw
 * (never inward), a pale ring round each eye, a broad dark nose, a wide
 * gentle smile.
 */
export function Face() {
  return (
    <g>
      <ellipse cx={0} cy={0} rx={64} ry={58} fill="url(#cs-fur)" />
      {/* the cream face: wide, from the brow to the chin */}
      <path d="M -52 -10 Q -56 46 0 50 Q 56 46 52 -10 Q 30 -42 0 -40 Q -30 -42 -52 -10 Z" fill={P.face} />
      {/* the eye bands: each holds its eye, then sweeps down and outward, narrowing */}
      <path
        d="M -38 -22 Q -24 -31 -10 -20 L -28 36 Q -44 44 -54 30 Q -46 4 -38 -22 Z"
        fill={P.stripe}
        opacity={0.92}
      />
      <path
        d="M 38 -22 Q 24 -31 10 -20 L 28 36 Q 44 44 54 30 Q 46 4 38 -22 Z"
        fill={P.stripe}
        opacity={0.92}
      />
      {/* eyes: a pale ring, a black eye, one catchlight */}
      <circle cx={-24} cy={-8} r={12.5} fill={P.face} opacity={0.55} />
      <circle cx={24} cy={-8} r={12.5} fill={P.face} opacity={0.55} />
      <circle cx={-24} cy={-8} r={9.5} fill={P.eye} />
      <circle cx={24} cy={-8} r={9.5} fill={P.eye} />
      <circle cx={-21} cy={-11} r={3.5} fill="#ffffff" />
      <circle cx={27} cy={-11} r={3.5} fill="#ffffff" />
      {/* the nose, broad and low, and the wide smile under it */}
      <ellipse cx={0} cy={11} rx={9} ry={6} fill={P.stripe} />
      <path d="M -32 22 Q 0 42 32 22" fill="none" stroke={P.stripe} strokeWidth={3.5} strokeLinecap="round" />
    </g>
  );
}

export function Head({ tilt = 0 }: { tilt?: number }) {
  return (
    <g transform={`rotate(${tilt})`}>
      <Face />
      <Hat tip={false} />
    </g>
  );
}

function Coat({ standing = false }: { standing?: boolean }) {
  const hem = standing ? 300 : 240;
  return (
    <g>
      {/* the coat: shoulders to hem, double-breasted, belted */}
      <path
        d={`M -74 60 Q -92 ${hem * 0.55} -84 ${hem} L 84 ${hem} Q 92 ${hem * 0.55} 74 60 Q 0 36 -74 60 Z`}
        fill="url(#cs-coat)"
      />
      {/* lapels and the collar */}
      <path d="M -70 60 L -16 128 L -10 62 Q -40 50 -70 60 Z" fill={P.trenchDeep} />
      <path d="M 70 60 L 16 128 L 10 62 Q 40 50 70 60 Z" fill={P.trenchDeep} />
      <path d="M -26 60 L 0 84 L 26 60 L 0 52 Z" fill={P.face} opacity={0.9} />
      <path d="M -6 74 L 0 110 L 6 74 Z" fill={P.fedoraBand} />
      {/* two columns of buttons */}
      {[112, 142, 172].map((y) => (
        <g key={y}>
          <circle cx={-18} cy={y} r={5} fill={P.fedoraBand} />
          <circle cx={18} cy={y} r={5} fill={P.fedoraBand} />
        </g>
      ))}
      {/* the belt and its buckle */}
      <rect x={-86} y={188} width={172} height={16} rx={4} fill={P.trenchDeep} />
      <rect x={-14} y={184} width={28} height={24} rx={4} fill="none" stroke={P.fedoraBand} strokeWidth={4} />
      {standing && (
        <g>
          <ellipse cx={-30} cy={hem + 8} rx={28} ry={11} fill={P.fedoraBand} />
          <ellipse cx={30} cy={hem + 8} rx={28} ry={11} fill={P.fedoraBand} />
        </g>
      )}
    </g>
  );
}

/**
 * The sloth private eye. Origin at the centre of his head; the body hangs
 * below it. `scale` sizes him; the head is ~130 units across at 1.
 */
export function Sleuth({
  pose,
  x,
  y,
  scale = 1,
  flip = false,
  breathe = true,
  holding,
}: {
  pose: SleuthPose;
  x: number;
  y: number;
  scale?: number;
  flip?: boolean;
  breathe?: boolean;
  /** What he reads (the holding-page pose): given in scene coordinates, drawn between his body and the glass arm, so the glass is over it. */
  holding?: ReactNode;
}) {
  const breath: CSSProperties = breathe
    ? { animation: "cs-breathe 3.5s ease-in-out infinite", transformOrigin: "0px 120px" }
    : {};
  const body = (
    <g style={breath}>
      {pose === "hanging" && (
        <g>
          {/* both arms straight up to the bough, hooked over it */}
          <Arm side={-1} upper={168} fore={0} />
          <Arm side={1} upper={-168} fore={0} glass />
          <Coat standing />
          <Head tilt={0} />
        </g>
      )}
      {pose === "reading" && (
        <g>
          <Arm side={-1} upper={14} fore={-30} open />
          <Coat />
          <Head tilt={8} />
          <Arm side={1} upper={-44} fore={-128} glass />
        </g>
      )}
      {pose === "holding-page" && (
        <g>
          {/* seated low behind the desk with a page in front of him: the free claw folded in his lap, the glass over the page */}
          <Arm side={-1} upper={30} fore={-90} open />
          <Coat />
          <Head tilt={8} />
          {holding && <g transform={`scale(${1 / scale}) translate(${-x} ${-y})`}>{holding}</g>}
          <Arm side={1} upper={-44} fore={-128} glass />
        </g>
      )}
      {pose === "pointing" && (
        <g>
          <Arm side={-1} upper={10} fore={-20} />
          <Coat />
          <Head tilt={-4} />
          <Arm side={1} upper={-96} fore={-6} open />
        </g>
      )}
      {pose === "holding-door" && (
        <g>
          {/* standing at the door, one claw on its edge: the arm bent down and back up, elbow low */}
          <Arm side={-1} upper={12} fore={0} glass />
          <Coat standing />
          <Head tilt={-4} />
          <Arm side={1} upper={-57} fore={-80} open />
        </g>
      )}
      {pose === "tipping-hat" && (
        <g>
          <Arm side={-1} upper={12} fore={0} glass />
          <Coat standing />
          <g>
            <Face />
            <Hat tip />
          </g>
          <Arm side={1} upper={-150} fore={-44} />
        </g>
      )}
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      {pose === "hanging" ? (
        <g style={{ animation: "cs-hang 5s ease-in-out infinite", transformOrigin: "0px -170px" }}>{body}</g>
      ) : (
        body
      )}
    </g>
  );
}

// ── The case folder and the stamp ────────────────────────────────────────────
export type Verdict = "READY" | "NEARLY" | "NOT READY";

/** The verdict, stamped: lands once (`landed`), then holds. The word is a prop. */
export function VerdictStamp({
  x,
  y,
  word,
  landed = true,
  delay = 0.6,
  scale = 1,
  ink = P.stamp,
}: {
  x: number;
  y: number;
  word: string;
  landed?: boolean;
  delay?: number;
  scale?: number;
  ink?: string;
}) {
  const w = Math.max(150, word.length * 30 + 48);
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g
        style={
          landed
            ? {
                animation: `cs-stamp 0.32s cubic-bezier(0.2, 0.9, 0.3, 1) ${delay}s both`,
                transformOrigin: "0px 0px",
              }
            : { opacity: 0.55, transform: "rotate(-8deg)" }
        }
      >
        <g filter="url(#cs-grit)" opacity={0.9}>
          <rect x={-w / 2} y={-34} width={w} height={68} rx={8} fill="none" stroke={ink} strokeWidth={6} />
          <text
            x={0}
            y={14}
            textAnchor="middle"
            fontFamily={SANS}
            fontSize={40}
            fontWeight={900}
            letterSpacing={4}
            fill={ink}
          >
            {word}
          </text>
        </g>
      </g>
    </g>
  );
}

/** A manila case folder with a tab; `label` is a prop, never drawn into the atom. Closed, or open flat with children on its right leaf. */
export function CaseFolder({
  x,
  y,
  w = 260,
  h = 190,
  label,
  open = false,
  dim = false,
  children,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  label?: string;
  open?: boolean;
  dim?: boolean;
  children?: ReactNode;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {open ? (
        <g>
          {/* the back leaf, flat on the desk, and the front leaf folded open to the right */}
          <rect x={-4} y={4} width={w * 2 + 12} height={h} rx={6} fill="#000" opacity={0.35} />
          <rect x={0} y={0} width={w} height={h} rx={6} fill="url(#cs-manila)" />
          <rect x={w + 2} y={0} width={w} height={h} rx={6} fill={P.manila} />
          <rect x={w + 2} y={0} width={w} height={h} rx={6} fill={P.manilaDeep} opacity={0.25} />
          <path d={`M 10 -16 L 92 -16 L 100 0 L 2 0 Z`} fill={P.manilaDeep} />
          {children}
        </g>
      ) : (
        <g>
          <rect x={6} y={8} width={w} height={h} rx={6} fill="#000" opacity={0.35} />
          <rect x={0} y={0} width={w} height={h} rx={6} fill="url(#cs-manila)" />
          <path d={`M 10 -16 L 92 -16 L 100 0 L 2 0 Z`} fill={P.manilaDeep} />
          {/* the fold, and two pages peeking out of the top */}
          <rect x={0} y={0} width={10} height={h} rx={3} fill={P.manilaDeep} opacity={0.6} />
          <rect x={30} y={-6} width={w - 60} height={8} fill={P.paper} />
          {label && (
            <text
              x={w / 2 + 8}
              y={h / 2 + 10}
              textAnchor="middle"
              fontFamily={SANS}
              fontSize={24}
              fontWeight={700}
              letterSpacing={1.5}
              fill={P.trenchEdge}
            >
              {label.toUpperCase()}
            </text>
          )}
          {children}
          {dim && <rect x={-2} y={-18} width={w + 10} height={h + 20} rx={6} fill={P.wall} opacity={0.55} />}
        </g>
      )}
    </g>
  );
}

// ── The typed page: the product's own text, on paper under the lamp ─────────
export type Tone = "type" | "soft" | "gun" | "loose" | "hunch" | "clean" | "dim" | "stamp";
export interface TypedLine {
  text: string;
  tone?: Tone;
  bold?: boolean;
}
const TONE: Record<Tone, string> = {
  type: P.type,
  soft: P.typeSoft,
  gun: P.gun,
  loose: "#a07400",
  hunch: "#1f7f88",
  clean: "#1f7a36",
  dim: P.dim,
  stamp: P.stamp,
};

/**
 * A sheet rolled out of the typewriter or lying on the blotter. Monospace,
 * the lines as given, one tone per line. `typing` types the dots of a line
 * in one at a time: the index of the line whose trailing dots animate.
 */
export function TypedPage({
  x,
  y,
  w,
  lines,
  fontSize = 15,
  rotate = -1.5,
  typing,
  pad = 26,
  delay = 0.3,
}: {
  x: number;
  y: number;
  w: number;
  lines: TypedLine[];
  fontSize?: number;
  rotate?: number;
  typing?: number;
  pad?: number;
  delay?: number;
}) {
  const lh = fontSize * 1.5;
  const h = pad * 2 + lines.length * lh;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <g style={settle(delay, 0.7)}>
        <rect x={8} y={10} width={w} height={h} fill="#000" opacity={0.4} filter="url(#cs-soft)" />
        <rect x={0} y={0} width={w} height={h} fill="url(#cs-paper)" />
        <rect x={0} y={0} width={w} height={h} fill="none" stroke={P.paperEdge} strokeWidth={1.5} />
        <g fontFamily={MONO} fontSize={fontSize} style={{ whiteSpace: "pre" }}>
          {lines.map((l, i) => {
            const ty = pad + lh * (i + 0.8);
            if (typing === i) {
              const m = /^(.*?)(\.+)( .*)?$/.exec(l.text);
              if (m) {
                const [, head, dots, tail = ""] = m;
                const charW = fontSize * 0.6;
                return (
                  <g key={i} fill={TONE[l.tone ?? "type"]} fontWeight={l.bold ? 700 : 400}>
                    <text x={pad} y={ty} xmlSpace="preserve">
                      {head}
                    </text>
                    {dots.split("").map((_, j) => (
                      <text
                        key={j}
                        x={pad + (head.length + j) * charW}
                        y={ty}
                        style={{ animation: `cs-type 0.05s linear ${delay + 0.6 + j * 0.16}s backwards` }}
                      >
                        .
                      </text>
                    ))}
                    <text
                      x={pad + (head.length + dots.length) * charW}
                      y={ty}
                      xmlSpace="preserve"
                      style={{
                        animation: `cs-type 0.05s linear ${delay + 0.6 + dots.length * 0.16 + 0.3}s backwards`,
                      }}
                    >
                      {tail}
                    </text>
                  </g>
                );
              }
            }
            return (
              <text
                key={i}
                x={pad}
                y={ty}
                xmlSpace="preserve"
                fill={TONE[l.tone ?? "type"]}
                fontWeight={l.bold ? 700 : 400}
              >
                {l.text}
              </text>
            );
          })}
        </g>
      </g>
    </g>
  );
}

// ── The office ───────────────────────────────────────────────────────────────
export const DESK_Y = 600;

export function OfficeWall() {
  return (
    <g>
      <rect x={-40} y={-40} width={1680} height={DESK_Y + 60} fill="url(#cs-wallglow)" />
      {/* the floor, and the desk's shadow on it */}
      <rect x={-40} y={DESK_Y + 20} width={1680} height={400} fill={P.floor} />
      <rect x={-40} y={DESK_Y + 20} width={1680} height={6} fill={P.wallLit} opacity={0.5} />
    </g>
  );
}

/** Light through the slats, lying on the wall and across the desk: stripes of the jungle's green. */
export function SlatLight({
  x = 560,
  y = 110,
  w = 440,
  h = 560,
  tint = P.canopyLit,
  strength = 1,
}: {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  tint?: string;
  strength?: number;
}) {
  return (
    <g
      style={{ animation: "cs-slat 4s ease-in-out infinite", transformOrigin: `${x}px ${y}px` }}
      opacity={0.55 * strength}
    >
      {Array.from({ length: Math.ceil(h / 50) }, (_, i) => (
        <path
          key={i}
          d={`M ${x} ${y + i * 46} L ${x + w} ${y + i * 46 + 10} L ${x + w + 40} ${y + i * 46 + 36} L ${x - 30} ${y + i * 46 + 24} Z`}
          fill={tint}
          opacity={0.16 - i * 0.008}
          filter="url(#cs-soft)"
        />
      ))}
    </g>
  );
}

/**
 * The window: a frame, the jungle behind it, slat blinds across it, one bloom
 * showing through. `dark` is the jungle unkept: dusk behind the glass, the
 * greens a stop down, the bloom muted. Bright is the jungle safe.
 */
export function Window({
  x = 600,
  y = 90,
  w = 400,
  h = 400,
  open = 0,
  dark = false,
}: {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  open?: number;
  dark?: boolean;
}) {
  const slats = 13;
  const gap = h / slats;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-18} y={-18} width={w + 36} height={h + 36} rx={4} fill={P.deskEdge} />
      {/* the jungle behind the glass */}
      <rect x={0} y={0} width={w} height={h} fill={dark ? "url(#cs-sky-dusk)" : "url(#cs-sky)"} />
      <path
        d={`M 0 ${h * 0.35} Q ${w * 0.2} ${h * 0.2} ${w * 0.4} ${h * 0.38} T ${w * 0.8} ${h * 0.3} T ${w} ${h * 0.4} L ${w} ${h} L 0 ${h} Z`}
        fill={dark ? P.canopyDeep : P.canopy}
      />
      <path
        d={`M 0 ${h * 0.6} Q ${w * 0.25} ${h * 0.45} ${w * 0.5} ${h * 0.62} T ${w} ${h * 0.58} L ${w} ${h} L 0 ${h} Z`}
        fill={dark ? P.canopyNight : P.canopyDeep}
      />
      {dark && (
        <g>
          <path
            d={`M ${w * 0.3} 0 q -10 ${h * 0.2} 14 ${h * 0.42}`}
            fill="none"
            stroke={P.canopyNight}
            strokeWidth={5}
          />
          <path
            d={`M ${w * 0.86} 0 q 12 ${h * 0.15} -8 ${h * 0.3}`}
            fill="none"
            stroke={P.canopyNight}
            strokeWidth={4}
          />
        </g>
      )}
      <g opacity={dark ? 0.4 : 1}>
        <ellipse cx={w * 0.72} cy={h * 0.5} rx={30} ry={22} fill={P.orchid} />
        <ellipse cx={w * 0.78} cy={h * 0.44} rx={18} ry={14} fill={P.orchidLit} />
        <ellipse
          cx={w * 0.22}
          cy={h * 0.7}
          rx={14}
          ry={34}
          fill={P.heliconia}
          transform={`rotate(-20 ${w * 0.22} ${h * 0.7})`}
        />
      </g>
      {dark && (
        <ellipse
          cx={w * 0.5}
          cy={h * 0.82}
          rx={w * 0.4}
          ry={h * 0.08}
          fill={P.fog}
          opacity={0.22}
          filter="url(#cs-soft)"
        />
      )}
      {/* the blinds: slats that let more jungle through as `open` grows */}
      {Array.from({ length: slats }, (_, i) => (
        <rect
          key={i}
          x={-4}
          y={i * gap}
          width={w + 8}
          height={Math.max(6, gap * (0.72 - open * 0.3))}
          fill={P.wallLit}
        />
      ))}
      {Array.from({ length: slats }, (_, i) => (
        <rect
          key={`s${i}`}
          x={-4}
          y={i * gap + Math.max(6, gap * (0.72 - open * 0.3)) - 3}
          width={w + 8}
          height={3}
          fill={P.wall}
          opacity={0.6}
        />
      ))}
      <rect x={w / 2 - 2} y={-14} width={4} height={h + 28} fill={P.deskEdge} opacity={0.6} />
      {/* the cord */}
      <line x1={w + 10} y1={-10} x2={w + 10} y2={h * 0.7} stroke={P.paperEdge} strokeWidth={2} />
    </g>
  );
}

/** One desk lamp, the room's light source: a brass shade and its cone on the blotter. */
export function Lamp({ x = 380, y = DESK_Y }: { x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* the cone on the desk, and the bloom of it on the wall */}
      <ellipse cx={120} cy={-120} rx={360} ry={260} fill="url(#cs-lamp)" />
      <ellipse cx={160} cy={14} rx={300} ry={40} fill={P.lamp} opacity={0.18} filter="url(#cs-soft)" />
      <ellipse cx={0} cy={0} rx={46} ry={10} fill={P.fedoraBand} />
      <rect x={-6} y={-150} width={12} height={150} rx={5} fill={P.trenchDeep} />
      <path
        d="M 0 -150 Q 60 -200 110 -170"
        fill="none"
        stroke={P.trenchDeep}
        strokeWidth={12}
        strokeLinecap="round"
      />
      <path d="M 70 -186 L 150 -150 L 118 -112 L 38 -148 Z" fill={P.trenchDeep} />
      <path d="M 74 -182 L 146 -150 L 118 -118 L 44 -150 Z" fill={P.trenchLit} />
      <ellipse cx={128} cy={-128} rx={30} ry={10} fill={P.lampHot} opacity={0.9} filter="url(#cs-soft)" />
    </g>
  );
}

/** The desk: a dark wood top with a leather blotter, standing on the floor. */
export function Desk({ x = 300, w = 1000 }: { x?: number; w?: number }) {
  return (
    <g>
      <rect x={x} y={DESK_Y} width={w} height={26} rx={4} fill={P.deskLit} />
      <rect x={x} y={DESK_Y + 22} width={w} height={14} fill={P.deskEdge} />
      <rect x={x + 10} y={DESK_Y + 36} width={w - 20} height={150} fill={P.desk} />
      <rect x={x + 10} y={DESK_Y + 36} width={w - 20} height={150} fill={P.deskEdge} opacity={0.5} />
      {/* drawers */}
      {[0, 1].map((i) => (
        <g key={i}>
          <rect
            x={x + 40 + i * 120}
            y={DESK_Y + 56}
            width={100}
            height={48}
            rx={3}
            fill={P.deskLit}
            opacity={0.35}
          />
          <rect
            x={x + 80 + i * 120}
            y={DESK_Y + 76}
            width={20}
            height={6}
            rx={3}
            fill={P.trenchLit}
            opacity={0.7}
          />
        </g>
      ))}
      {/* the blotter */}
      <rect
        x={x + 220}
        y={DESK_Y + 2}
        width={w - 440}
        height={20}
        rx={3}
        fill={P.canopyNight}
        opacity={0.55}
      />
    </g>
  );
}

export function Typewriter({
  x = 900,
  y = DESK_Y,
  keyBeat = false,
}: {
  x?: number;
  y?: number;
  keyBeat?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-110} y={-70} width={220} height={74} rx={10} fill={P.fedoraBand} />
      <rect x={-104} y={-66} width={208} height={64} rx={8} fill="#2c2622" />
      <rect x={-92} y={-100} width={184} height={40} rx={6} fill="#3a332e" />
      <rect x={-120} y={-108} width={240} height={12} rx={6} fill={P.fedoraBand} />
      <circle cx={-126} cy={-102} r={9} fill={P.trenchDeep} />
      <circle cx={126} cy={-102} r={9} fill={P.trenchDeep} />
      {/* keys, four rows */}
      {[0, 1, 2, 3].map((r) => (
        <g key={r} style={keyBeat && r === 2 ? { animation: "cs-key 0.16s ease-in-out 1.2s 12" } : undefined}>
          {Array.from({ length: 9 - (r % 2) }, (_, c) => (
            <circle key={c} cx={-80 + (r % 2) * 10 + c * 20} cy={-52 + r * 14} r={6} fill={P.paperDeep} />
          ))}
        </g>
      ))}
      <rect x={-60} y={-8} width={120} height={8} rx={4} fill="#3a332e" />
    </g>
  );
}

/** Coffee, with his own face on the mug. */
export function Mug({ x = 1080, y = DESK_Y - 2, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M ${-10 + i * 12} -60 q 8 -14 0 -28`}
          fill="none"
          stroke={P.paper}
          strokeWidth={4}
          strokeLinecap="round"
          style={{ animation: `cs-steam 3s ease-out ${i * 0.9}s infinite`, opacity: 0 }}
        />
      ))}
      <path d="M 30 -46 q 24 0 24 18 q 0 18 -24 18" fill="none" stroke={P.paper} strokeWidth={9} />
      <rect x={-30} y={-62} width={60} height={62} rx={6} fill={P.paper} />
      <rect x={-30} y={-62} width={60} height={62} rx={6} fill={P.paperDeep} opacity={0.3} />
      <ellipse cx={0} cy={-62} rx={30} ry={7} fill={P.paperDeep} />
      {/* the face on the mug: hat, eyes with their stripes, the smile */}
      <ellipse cx={0} cy={-30} rx={16} ry={14} fill={P.fur} />
      <path d="M -12 -32 Q -14 -18 0 -18 Q 14 -18 12 -32 Q 6 -40 0 -40 Q -6 -40 -12 -32 Z" fill={P.face} />
      <circle cx={-5} cy={-31} r={2.5} fill={P.stripe} />
      <circle cx={5} cy={-31} r={2.5} fill={P.stripe} />
      <path d="M -6 -25 Q 0 -20 6 -25" fill="none" stroke={P.stripe} strokeWidth={1.4} />
      <path d="M -16 -42 L -14 -52 Q 0 -56 14 -52 L 16 -42 Z" fill={P.fedora} />
      <rect x={-20} y={-44} width={40} height={3} fill={P.fedora} />
    </g>
  );
}

/**
 * A card leaving as an Envelope: ToolKit's own object, its geometry drawn to
 * match ToolKit's (paper, a 2px ink border, a hard offset shade, the flap as
 * a V, the type's post-it on the corner, the id bottom-left), with nothing
 * imported, so this file stands on its own.
 * `posted` runs it off the desk and out the door, once, and it holds there.
 */
export function Envelope({
  x,
  y,
  w = 112,
  id,
  type = "bug",
  posted = false,
  delay = 1.2,
}: {
  x: number;
  y: number;
  w?: number;
  id?: string;
  type?: "bug" | "task";
  posted?: boolean;
  delay?: number;
}) {
  const h = Math.round(w * 0.62);
  const tk = {
    paper: "#f4f2ec",
    ink: "#1c1c1f",
    inkSoft: "#5b5a60",
    shade: "#c9c6cf",
    bug: "#b9e0c4",
    task: "#f4c2cc",
  };
  const pw = Math.max(20, Math.round(w * 0.22));
  return (
    <g transform={`translate(${x} ${y})`}>
      <g
        style={
          posted
            ? {
                animation: `cs-post 1.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}s both`,
                transformOrigin: "0px 0px",
              }
            : undefined
        }
      >
        <rect x={3} y={3} width={w} height={h} fill={tk.shade} />
        <rect x={0} y={0} width={w} height={h} fill={tk.paper} stroke={tk.ink} strokeWidth={2} />
        <polyline points={`2,2 ${w / 2},${h * 0.5} ${w - 2},2`} fill="none" stroke={tk.ink} strokeWidth={2} />
        <g transform={`translate(-6 -8) rotate(-8 ${pw / 2} ${pw / 2})`}>
          <rect x={0} y={0} width={pw} height={pw} fill={tk[type]} />
          <rect x={4} y={7} width={pw - 8} height={3} fill={tk.ink} opacity={0.18} />
          <rect x={4} y={13} width={pw - 10} height={3} fill={tk.ink} opacity={0.18} />
        </g>
        {id && (
          <text x={8} y={h - 5} fontFamily={MONO} fontSize={9} fill={tk.inkSoft} letterSpacing={0.5}>
            {id}
          </text>
        )}
      </g>
    </g>
  );
}

/** The cork board behind the desk: a case map, pins, one note; words are props. */
export function CorkBoard({
  x = 300,
  y = 150,
  w = 250,
  h = 250,
  note,
}: {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  note?: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-10} y={-10} width={w + 20} height={h + 20} rx={4} fill={P.deskEdge} />
      <rect x={0} y={0} width={w} height={h} fill={P.trenchDeep} />
      <rect x={0} y={0} width={w} height={h} fill={P.manilaDeep} opacity={0.35} />
      {/* the case map */}
      <rect x={24} y={24} width={w * 0.6} height={h * 0.5} fill={P.paper} transform="rotate(-2 24 24)" />
      <path d={`M 40 60 L 90 50 L 120 90 L 150 70`} fill="none" stroke={P.typeSoft} strokeWidth={2} />
      <path d={`M 50 110 L 100 95 L 140 120`} fill="none" stroke={P.typeSoft} strokeWidth={2} />
      {[
        [60, 56, P.stamp],
        [118, 88, P.stamp],
        [102, 96, P.hunch],
      ].map(([cx, cy, c], i) => (
        <circle key={i} cx={cx as number} cy={cy as number} r={5} fill={c as string} />
      ))}
      <line x1={60} y1={56} x2={118} y2={88} stroke={P.stamp} strokeWidth={1.5} />
      {/* the pinned note */}
      <g transform={`translate(${w * 0.06} ${h * 0.6}) rotate(-3)`}>
        <rect x={0} y={0} width={96} height={64} fill={P.hibiscus} />
        <circle cx={48} cy={4} r={5} fill={P.stamp} />
        {note && (
          <text
            x={48}
            y={40}
            textAnchor="middle"
            fontFamily={SANS}
            fontSize={11}
            fontWeight={700}
            fill={P.type}
          >
            {note}
          </text>
        )}
      </g>
      {[20, w - 20].map((px, i) => (
        <circle key={i} cx={px} cy={14} r={5} fill={P.stamp} />
      ))}
    </g>
  );
}

/** The door: frosted glass with the name on it (a prop), closed or opened onto lamplight from another room. */
export function Door({
  x = 1130,
  y = 130,
  name,
  open = false,
}: {
  x?: number;
  y?: number;
  name?: string;
  open?: boolean;
}) {
  const w = 190;
  const h = DESK_Y + 20 - y;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-14} y={-14} width={w + 28} height={h + 14} fill={P.deskEdge} />
      {open ? (
        <g>
          {/* the room beyond, lit */}
          <rect x={0} y={0} width={w} height={h} fill={P.lamp} opacity={0.75} />
          <rect x={0} y={0} width={w} height={h} fill="url(#cs-lamp)" />
          {/* the door swung in, seen edge-on */}
          <path d={`M 0 0 L 48 24 L 48 ${h + 10} L 0 ${h} Z`} fill={P.desk} />
          <path d={`M 4 20 L 44 36 L 44 ${h * 0.5} L 4 ${h * 0.5 - 10} Z`} fill={P.glass} opacity={0.5} />
        </g>
      ) : (
        <g>
          <rect x={0} y={0} width={w} height={h} fill={P.desk} />
          <rect x={16} y={16} width={w - 32} height={h * 0.5} fill={P.glass} opacity={0.35} />
          <rect x={16} y={16} width={w - 32} height={h * 0.5} fill={P.lamp} opacity={0.14} />
          {name && (
            <g>
              {/* the name on the glass, one word a line: the glass is narrower than the name */}
              {name.split(" ").map((word, i) => (
                <text
                  key={word}
                  x={w / 2}
                  y={h * 0.16 + i * 30}
                  textAnchor="middle"
                  fontFamily={SANS}
                  fontSize={22}
                  fontWeight={800}
                  letterSpacing={3}
                  fill={P.type}
                  opacity={0.75}
                >
                  {word}
                </text>
              ))}
              <line
                x1={34}
                y1={h * 0.16 + name.split(" ").length * 30 - 10}
                x2={w - 34}
                y2={h * 0.16 + name.split(" ").length * 30 - 10}
                stroke={P.type}
                strokeWidth={2}
                opacity={0.5}
              />
            </g>
          )}
          <rect x={16} y={h * 0.5 + 40} width={w - 32} height={h * 0.38} fill={P.deskLit} opacity={0.5} />
          <circle cx={w - 30} cy={h * 0.56} r={7} fill={P.trenchLit} />
        </g>
      )}
    </g>
  );
}

// ── The jungle ───────────────────────────────────────────────────────────────
function Leaf({
  x,
  y,
  s = 1,
  rot = 0,
  fill = P.canopy,
}: {
  x: number;
  y: number;
  s?: number;
  rot?: number;
  fill?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M 0 0 Q 90 -70 180 0 Q 90 70 0 0 Z" fill={fill} />
      <path d="M 4 0 L 172 0" stroke={P.canopyDeep} strokeWidth={3} opacity={0.5} />
      {[30, 60, 90, 120, 150].map((lx) => (
        <path
          key={lx}
          d={`M ${lx} 0 L ${lx + 14} -22 M ${lx} 0 L ${lx + 14} 22`}
          stroke={P.canopyDeep}
          strokeWidth={2}
          opacity={0.35}
        />
      ))}
    </g>
  );
}

function Frond({
  x,
  y,
  s = 1,
  rot = 0,
  fill = P.canopyLit,
}: {
  x: number;
  y: number;
  s?: number;
  rot?: number;
  fill?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M 0 0 Q 40 -160 0 -300" fill="none" stroke={P.canopyDeep} strokeWidth={6} />
      {[-40, -80, -120, -160, -200, -240].map((ly, i) => (
        <g key={ly}>
          <path
            d={`M ${8 - i} ${ly} q -70 -30 -120 ${-30 - i * 2}`}
            fill="none"
            stroke={fill}
            strokeWidth={14 - i}
            strokeLinecap="round"
          />
          <path
            d={`M ${8 - i} ${ly} q 70 -30 120 ${-30 - i * 2}`}
            fill="none"
            stroke={fill}
            strokeWidth={14 - i}
            strokeLinecap="round"
          />
        </g>
      ))}
    </g>
  );
}

export function Orchid({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={0} cy={-26} rx={14} ry={28} fill={P.orchid} transform={`rotate(${a})`} />
      ))}
      {[36, 180, 324].map((a) => (
        <ellipse
          key={a}
          cx={0}
          cy={-20}
          rx={9}
          ry={18}
          fill={P.orchidLit}
          transform={`rotate(${a})`}
          opacity={0.9}
        />
      ))}
      <circle cx={0} cy={0} r={8} fill={P.hibiscus} />
      <circle cx={0} cy={0} r={4} fill={P.stamp} />
    </g>
  );
}

export function Heliconia({ x, y, s = 1, rot = 0 }: { x: number; y: number; s?: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M 0 0 L 0 -220" stroke={P.canopyDeep} strokeWidth={6} />
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M 0 ${-40 - i * 40} q ${i % 2 ? -1 : 1} 0 ${i % 2 ? -70 : 70} -36 q ${i % 2 ? 16 : -16} 34 ${i % 2 ? 70 : -70} 36 Z`}
          fill={i % 2 ? P.heliconia : P.bromeliad}
        />
      ))}
      <path d="M 0 -220 l 0 -30" stroke={P.hibiscus} strokeWidth={8} strokeLinecap="round" />
    </g>
  );
}

export function Bromeliad({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[-50, -30, -10, 10, 30, 50].map((a) => (
        <path key={a} d="M 0 0 q -16 -90 0 -170 q 16 -90 0 0 Z" fill={P.canopy} transform={`rotate(${a})`} />
      ))}
      {[-24, 0, 24].map((a) => (
        <path
          key={a}
          d="M 0 0 q -12 -70 0 -120 q 12 -70 0 0 Z"
          fill={P.bromeliad}
          transform={`rotate(${a})`}
        />
      ))}
      <circle cx={0} cy={-30} r={10} fill={P.hibiscus} />
    </g>
  );
}

/** A bough across the frame, for the sleuth to hang from, with moss and a vine. */
export function Bough({ y = 150 }: { y?: number }) {
  return (
    <g>
      <path
        d={`M -40 ${y + 20} Q 400 ${y - 30} 800 ${y} T 1640 ${y - 10}`}
        fill="none"
        stroke={P.bough}
        strokeWidth={56}
        strokeLinecap="round"
      />
      <path
        d={`M -40 ${y + 8} Q 400 ${y - 40} 800 ${y - 12} T 1640 ${y - 22}`}
        fill="none"
        stroke={P.boughLit}
        strokeWidth={18}
        strokeLinecap="round"
        opacity={0.7}
      />
      <path
        d={`M 300 ${y + 10} q 40 -30 90 -8 M 1100 ${y - 2} q 50 -26 100 -4`}
        fill="none"
        stroke={P.canopyLit}
        strokeWidth={10}
        strokeLinecap="round"
        opacity={0.6}
      />
      {/* a vine hanging off it */}
      <path
        d={`M 1180 ${y + 20} q -20 120 30 220 q 20 60 -10 100`}
        fill="none"
        stroke={P.canopy}
        strokeWidth={6}
      />
      <path
        d={`M 1196 ${y + 140} l -30 24 M 1210 ${y + 220} l 34 18`}
        stroke={P.canopy}
        strokeWidth={10}
        strokeLinecap="round"
      />
    </g>
  );
}

/** A clipboard hung from the bough: the case map. The pinned word is a prop. */
export function Clipboard({ x, y, note }: { x: number; y: number; note?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <line x1={0} y1={-90} x2={0} y2={-20} stroke={P.paperEdge} strokeWidth={3} />
      <rect x={-56} y={-20} width={112} height={140} rx={6} fill={P.trenchDeep} />
      <rect x={-48} y={-6} width={96} height={118} fill={P.paper} />
      <rect x={-20} y={-26} width={40} height={16} rx={4} fill={P.typeSoft} />
      <path d="M -36 20 L -10 12 L 10 36 L 34 24" fill="none" stroke={P.typeSoft} strokeWidth={2} />
      <circle cx={-10} cy={12} r={4} fill={P.stamp} />
      <circle cx={34} cy={24} r={4} fill={P.hunch} />
      {note && (
        <text x={0} y={92} textAnchor="middle" fontFamily={SANS} fontSize={12} fontWeight={700} fill={P.type}>
          {note}
        </text>
      )}
    </g>
  );
}

/** A trunk, mossy, rising out of frame; something can be pinned to it. */
export function Trunk({ x, w = 90, top = 60 }: { x: number; w?: number; top?: number }) {
  return (
    <g>
      <path
        d={`M ${x - w / 2} 960 L ${x - w / 2 + 6} ${top} L ${x + w / 2 - 6} ${top} L ${x + w / 2 + 10} 960 Z`}
        fill={P.bough}
      />
      <path
        d={`M ${x - w / 2 + 14} 960 L ${x - w / 2 + 18} ${top} L ${x - w / 2 + 34} ${top} L ${x - w / 2 + 36} 960 Z`}
        fill={P.boughLit}
        opacity={0.5}
      />
      <path
        d={`M ${x + w / 2 - 20} 960 Q ${x + w / 2 - 30} 600 ${x + w / 2 - 12} 300`}
        fill="none"
        stroke={P.canopyLit}
        strokeWidth={10}
        strokeLinecap="round"
        opacity={0.6}
      />
      <path d={`M ${x + w / 2 + 2} 700 q 60 -20 90 20 q -60 10 -90 -20 Z`} fill={P.canopy} />
    </g>
  );
}

/** Something small catching the light, down in the undergrowth. Stronger in the dark. */
export function Glint({ x, y, strong = false }: { x: number; y: number; strong?: boolean }) {
  const r = strong ? 44 : 30;
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle
        cx={0}
        cy={0}
        r={r}
        fill={P.hibiscus}
        opacity={strong ? 0.7 : 0.5}
        filter="url(#cs-blur)"
        style={{ animation: "cs-glint 5s ease-in-out infinite" }}
      />
      <path
        d="M -10 0 L 0 -10 L 10 0 L 0 10 Z"
        fill={P.lampHot}
        style={{ animation: "cs-glint 5s ease-in-out infinite" }}
      />
    </g>
  );
}

/**
 * The dusk wash: laid over the jungle and whatever hangs in it, so the props
 * go dark with the trees; what is placed after it stays lit. Multiply, so it
 * darkens and cools rather than covers.
 */
export function Dusk({ opacity = 1 }: { opacity?: number }) {
  return (
    <rect
      x={-40}
      y={-40}
      width={1680}
      height={980}
      fill={P.dusk}
      opacity={opacity}
      style={{ mixBlendMode: "multiply" }}
    />
  );
}

/** One shaft of light down through the canopy, for the one thing in the dark jungle that is lit. */
export function LightShaft({ x, w = 220, opacity = 0.7 }: { x: number; w?: number; opacity?: number }) {
  return (
    <polygon
      points={`${x - w * 0.3} -40 ${x + w * 0.3} -40 ${x + w * 0.8} 900 ${x - w * 0.8} 900`}
      fill="url(#cs-shaft)"
      opacity={opacity}
    />
  );
}

/**
 * The jungle from the ground: sky, light shafts, canopy layers, the dark
 * undergrowth. It is the repository's state. Bright is the repo safe:
 * beautiful, lit in shafts, the blooms loud. `dark` is the repo unkept: dusk,
 * the greens a stop down, vines hanging, fog low in the undergrowth, no
 * shafts, and the glint the brightest thing in it. A bit scary, on purpose.
 */
export function Jungle({ glint = true, dark = false }: { glint?: boolean; dark?: boolean }) {
  const tone = (fill: string) => {
    if (!dark) return fill;
    if (fill === P.canopyLit) return P.canopy;
    if (fill === P.canopy) return P.canopyDeep;
    return P.canopyNight;
  };
  return (
    <g>
      <rect x={-40} y={-40} width={1680} height={980} fill={dark ? "url(#cs-sky-dusk)" : "url(#cs-sky)"} />
      {/* shafts of light coming down through the leaves: only where the jungle is safe */}
      {!dark &&
        [260, 620, 1060].map((sx, i) => (
          <polygon
            key={sx}
            points={`${sx} -40 ${sx + 90} -40 ${sx + 260} 900 ${sx + 60} 900`}
            fill="url(#cs-shaft)"
            opacity={0.6 - i * 0.1}
          />
        ))}
      {/* the far canopy */}
      <g style={{ animation: "cs-drift 9s ease-in-out infinite" }}>
        {[
          [-60, 120, 1.6, 10, P.canopyDeep],
          [260, 40, 1.4, -14, P.canopy],
          [620, 90, 1.5, 6, P.canopyDeep],
          [980, 30, 1.6, -8, P.canopy],
          [1300, 110, 1.5, 12, P.canopyDeep],
          [120, 300, 1.3, -30, P.canopy],
          [1180, 320, 1.3, 28, P.canopy],
        ].map(([lx, ly, s, r, f], i) => (
          <Leaf
            key={i}
            x={lx as number}
            y={ly as number}
            s={s as number}
            rot={r as number}
            fill={tone(f as string)}
          />
        ))}
      </g>
      {/* the middle band: more leaves than sky, which is the point */}
      <g style={{ animation: "cs-drift 11s ease-in-out -4s infinite" }}>
        {[
          [-120, 420, 1.5, 16, P.canopyDeep],
          [200, 470, 1.2, -22, P.canopy],
          [560, 400, 1.1, 30, P.canopyDeep],
          [860, 450, 1.3, -12, P.canopy],
          [1220, 420, 1.4, 20, P.canopyDeep],
          [1480, 470, 1.2, -28, P.canopy],
        ].map(([lx, ly, s, r, f], i) => (
          <Leaf
            key={i}
            x={lx as number}
            y={ly as number}
            s={s as number}
            rot={r as number}
            fill={tone(f as string)}
          />
        ))}
      </g>
      {/* the near canopy, brighter, swaying */}
      <g style={{ animation: "cs-sway 7s ease-in-out infinite", transformOrigin: "800px 0px" }}>
        {[
          [-80, 240, 1.3, 24, P.canopyLit],
          [420, 200, 1.1, -18, P.canopyLit],
          [1080, 220, 1.2, 20, P.canopyLit],
          [1400, 260, 1.3, -26, P.canopy],
        ].map(([lx, ly, s, r, f], i) => (
          <Leaf
            key={i}
            x={lx as number}
            y={ly as number}
            s={s as number}
            rot={r as number}
            fill={tone(f as string)}
          />
        ))}
      </g>
      {/* unkept: vines hanging out of the canopy, nobody cut them back */}
      {dark && (
        <g style={{ animation: "cs-sway 8s ease-in-out -3s infinite", transformOrigin: "800px -40px" }}>
          {[
            [200, 420, -1],
            [690, 520, 1],
            [940, 360, -1],
            [1180, 480, 1],
          ].map(([vx, vl, dir], i) => (
            <g key={i}>
              <path
                d={`M ${vx} -40 q ${dir * 30} ${vl * 0.5} ${dir * -14} ${vl}`}
                fill="none"
                stroke={P.canopyNight}
                strokeWidth={7}
                strokeLinecap="round"
              />
              <path
                d={`M ${vx + dir * 8} ${vl * 0.55 - 40} l ${dir * -26} 20 M ${vx + dir * -2} ${vl * 0.85 - 40} l ${dir * 24} 18`}
                stroke={P.canopyNight}
                strokeWidth={10}
                strokeLinecap="round"
              />
            </g>
          ))}
        </g>
      )}
      {/* the undergrowth: fronds, blooms, and the dark where things hide */}
      <rect
        x={-40}
        y={dark ? 380 : 500}
        width={1680}
        height={dark ? 560 : 440}
        fill={dark ? "url(#cs-under-dusk)" : "url(#cs-under)"}
      />
      <g style={{ animation: "cs-sway 6s ease-in-out -2s infinite", transformOrigin: "800px 900px" }}>
        <Frond x={180} y={900} s={1.1} rot={-18} fill={tone(P.canopyLit)} />
        <Frond x={1420} y={900} s={1.2} rot={16} fill={tone(P.canopy)} />
        <Frond x={760} y={940} s={0.9} rot={4} fill={tone(P.canopy)} />
        <g opacity={dark ? 0.45 : 1}>
          <Bromeliad x={360} y={880} s={0.9} />
          <Bromeliad x={1240} y={900} s={1.1} />
          <Heliconia x={520} y={900} s={0.9} rot={-10} />
          <Heliconia x={1100} y={920} s={0.8} rot={14} />
          <Orchid x={300} y={700} s={1.2} />
          <Orchid x={1330} y={660} s={1.0} />
          <Orchid x={1390} y={720} s={0.7} />
        </g>
      </g>
      <Trunk x={1290} w={70} top={-40} />
      {/* unkept: fog lying low in the undergrowth, drifting */}
      {dark && (
        <g style={{ animation: "cs-drift 13s ease-in-out -6s infinite" }}>
          <ellipse cx={700} cy={760} rx={760} ry={70} fill={P.fog} opacity={0.16} filter="url(#cs-blur)" />
          <ellipse cx={1000} cy={850} rx={900} ry={80} fill={P.fog} opacity={0.2} filter="url(#cs-blur)" />
        </g>
      )}
      {glint && <Glint x={900} y={790} strong={dark} />}
    </g>
  );
}

/** A package hanging upside down from a branch, by its tape. */
export function HangingPackage({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(8)`}>
      <line x1={0} y1={-60} x2={0} y2={0} stroke={P.paperEdge} strokeWidth={4} />
      <rect x={-44} y={0} width={88} height={70} rx={4} fill={P.manila} />
      <rect x={-44} y={0} width={88} height={70} rx={4} fill={P.manilaDeep} opacity={0.4} />
      <rect x={-44} y={30} width={88} height={10} fill={P.paperDeep} opacity={0.7} />
      <rect x={-6} y={0} width={12} height={70} fill={P.paperDeep} opacity={0.7} />
    </g>
  );
}

/** A note pinned to a trunk. The word is a prop. */
export function PinnedNote({ x, y, note }: { x: number; y: number; note?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(-5)`}>
      <rect x={-40} y={-30} width={80} height={60} fill={P.hibiscus} />
      <circle cx={0} cy={-26} r={5} fill={P.stamp} />
      {note && (
        <text x={0} y={10} textAnchor="middle" fontFamily={SANS} fontSize={13} fontWeight={700} fill={P.type}>
          {note}
        </text>
      )}
    </g>
  );
}
