import type { ReactNode } from "react";
import { CopyLinkButton } from "../deck-engine/CopyLinkButton";
import { createMakeSlide } from "../deck-engine/makeSlide";
import { Beat, Context, Say } from "../deck-engine/PresenterNoteKit";
import { useCompactLayout } from "../deck-engine/useCompactLayout";
import type { Deck, Slide } from "./types";
import { DeckState } from "./types";
import {
  Bough,
  Camera,
  CaseFolder,
  Clipboard,
  CorkBoard,
  DESK_Y,
  Desk,
  Door,
  Envelope,
  HangingPackage,
  Jungle,
  Glint,
  Dusk,
  LightShaft,
  Lamp,
  MONO,
  Mug,
  OfficeWall,
  P,
  PinnedNote,
  Scene,
  SlatLight,
  Sleuth,
  STAGE_BG_JUNGLE_DARK,
  Trunk,
  Stage,
  TypedPage,
  Typewriter,
  VerdictStamp,
  Window,
  settle,
  type TypedLine,
} from "./code-sleuth-figures";

// Code Sleuth — the commercial. A sloth private eye takes the case of your
// repository: the jungle outside is the repo, dark while it is unkept and
// beautiful once it is tended; the old-school office
// inside is where he works, and the slat-blind window joins them. Every
// surface is the CLI's own text, verbatim, as a typed page under the lamp.
//
// It and code-sleuth-figures.tsx travel together, so this file imports nothing
// from another figures file and nothing from the engine but the player
// contract.

// ── Copy-panel kit, in this world's colours
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontFamily: MONO,
        fontSize: "0.75rem",
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: P.lamp,
        margin: "0 0 16px 0",
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <span style={{ display: "inline-block", width: "22px", height: "2px", backgroundColor: P.lamp, borderRadius: "1px", flexShrink: 0 }} />
      {children}
    </p>
  );
}

function SlideTitle({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        fontSize: "clamp(1.45rem, 6vw, 2.5rem)",
        fontWeight: 800,
        lineHeight: "1.22em",
        margin: "0 0 20px 0",
        background: `linear-gradient(172deg, #ffffff 0%, ${P.paper} 30%, ${P.trenchLit} 62%, ${P.lamp} 100%)`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        filter: "drop-shadow(0 0 14px rgba(255,217,160,0.22))",
        whiteSpace: "pre-line",
      }}
    >
      {children}
    </h2>
  );
}

function Lead({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: "1.25rem", lineHeight: 1.75, color: "#e6ddd0", margin: "0 0 24px 0", whiteSpace: "pre-line" }}>{children}</p>;
}

function CopyPanel({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", padding: "40px 88px 40px 48px" }}>{children}</div>;
}

const makeSlide = createMakeSlide({ CopyPanel, Eyebrow, SlideTitle, Lead });

// ── The office, assembled once ───────────────────────────────────────────────
/** The name on the door's glass: the deck's one copy of it. */
const DOOR_NAME = "CODE SLEUTH";

function Office({
  doorOpen = false,
  blinds = 0,
  keyBeat = false,
  mug = true,
  jungle = "unkept",
  typewriterX = 900,
  lampX = 380,
  boardX = 280,
  boardW = 250,
  doorName = DOOR_NAME,
  behindDesk,
  children,
}: {
  doorOpen?: boolean;
  blinds?: number;
  keyBeat?: boolean;
  mug?: boolean;
  typewriterX?: number;
  lampX?: number;
  boardX?: number;
  /** a closer camera shows less wall: a narrower board fits between the frame's left edge and the window */
  boardW?: number;
  /** the name on the door; null leaves it off: a camera slide does that on the phone, whose band cuts the door mid-word */
  doorName?: string | null;
  /** what the window shows: the repo unkept (dark, cool light on the wall) or tended (bright). Never "safe": a repository is not a state you can be in; the sleuth's verdict is MET, NEARLY MET or NOT MET against a checklist */
  jungle?: "unkept" | "tended";
  /** the seated sleuth: drawn behind the desk, so his coat and claws end at its edge */
  behindDesk?: ReactNode;
  children?: ReactNode;
}) {
  const compact = useCompactLayout();
  return (
    <g>
      <OfficeWall />
      <SlatLight tint={jungle === "tended" ? P.canopyLit : P.skyDusk} strength={jungle === "tended" ? 1 : 0.8} />
      <Window open={blinds} dark={jungle !== "tended"} />
      {/* the cork board is a secondary atom: on a phone it leaves the frame rather than be cut by the band */}
      {!compact && <CorkBoard x={boardX} y={120} w={boardW} note="CASE: PUBLIC" />}
      <Door name={doorName ?? undefined} open={doorOpen} />
      {behindDesk}
      <Desk />
      <Lamp x={lampX} />
      <Typewriter x={typewriterX} keyBeat={keyBeat} />
      {mug && <Mug />}
      {children}
    </g>
  );
}

// ── Surfaces: the CLI's own text, verbatim ───────────────────────────────────
// The help's banner and question; its version line is left out, so the page
// never dates.
const THE_QUESTION: TypedLine[] = [
  { text: "       _.-\"\"\"\"\"\"\"\"-._", tone: "soft" },
  { text: "   .--'______________'--.", tone: "soft" },
  { text: "   `-----------.-'''''-.", tone: "soft" },
  { text: "     |  (o)   / (  O  ) \\", tone: "soft" },
  { text: "     |  ///  |  \\\\\\\\\\\\\\  |", tone: "soft" },
  { text: "     | //  .- \\  \\\\\\\\\\  /", tone: "soft" },
  { text: "      \\    `-  `-.___.-'\\ \\", tone: "soft" },
  { text: "       '-.____          ( ( (", tone: "soft" },
  { text: "" },
  { text: "So, you want to know what's going on with your repo?", bold: true },
];

// The run typed with --offline, so the Out line is the product's "nothing" line
// (src/cli/output.ts): without it, the line names the ToolKit probe and any
// dependency lookups instead.
const THE_STAKEOUT: TypedLine[] = [
  { text: "code-sleuth messy --goal public --offline", tone: "soft" },
  { text: "" },
  { text: "Code Sleuth -- case 2026-10-31-public-1", bold: true },
  { text: "" },
  { text: "So, you want to know what's going on with your repo?" },
  { text: "" },
  { text: "  Repo  messy (main @ 4999d78, clean)" },
  { text: "  Goal  public facing" },
  { text: "  Out   nothing: this run makes no network calls" },
  { text: "" },
  { text: "Taking my time. 24 leads to run down ........................ done." },
];

const THE_VERDICT: TypedLine[] = [
  { text: "NOT MET  By my checklist: not met for public facing. One smoking gun, eight loose ends.", tone: "stamp", bold: true },
  { text: "" },
  { text: "Smoking guns", tone: "gun", bold: true },
  { text: "  [ ] names.deny              A name from the deny list: it was supposed to stay private. src/app.js:1, and 1 more", tone: "gun" },
  { text: "Loose ends", tone: "loose", bold: true },
  { text: "  [ ] paths.machine           A path from somebody's machine: it works there and nowhere else, and it names them. scripts/build.sh:4", tone: "loose" },
  { text: "  [ ] docs.contributing       No CONTRIBUTING: a stranger who wants to help has to guess how.", tone: "loose" },
  { text: "  [ ] docs.conduct            No CODE_OF_CONDUCT: nobody knows the house rules.", tone: "loose" },
];

// Three of the eight loose ends, as the terminal prints them (the id padded to
// 24 columns, the finding, then where); a line too long for the page wraps at
// the path, indented to the finding's column.
const THE_CHECKLIST: TypedLine[] = [
  { text: "Loose ends", tone: "loose", bold: true },
  { text: "  [ ] paths.machine           A path from somebody's machine: it works there and nowhere else,", tone: "loose" },
  { text: "                              and it names them. scripts/build.sh:4", tone: "loose" },
  { text: "  [ ] docs.security           No SECURITY.md: nobody knows where to report a problem quietly.", tone: "loose" },
  { text: "  [ ] workflows.prtarget      A pull_request_target workflow checks out the pull request:", tone: "loose" },
  { text: "                              a stranger's code runs with this repository's secrets.", tone: "loose" },
  { text: "                              .github/workflows/triage.yml:7", tone: "loose" },
];

// One card, whole: cards/05-add-a-security-policy.md of the fixture case, the
// fix paragraph wrapped to the sheet.
const THE_CARD: TypedLine[] = [
  { text: "# Task: Add a security policy", bold: true },
  { text: "" },
  { text: "No SECURITY.md: nobody knows where to report a problem quietly." },
  { text: "" },
  { text: "**What the books call it:** vulnerability disclosure policy" },
  { text: "" },
  { text: "**The fix**", bold: true },
  { text: "Add a SECURITY.md at the root, in .github/ or in docs/: which" },
  { text: "versions get fixes, and how to report a vulnerability privately" },
  { text: "(GitHub's private vulnerability reporting, or an address)." },
  { text: "" },
  { text: "**Done when**", bold: true },
  { text: "- [ ] `code-sleuth --goal public` reads `docs.security` as Clean." },
  { text: "" },
  { text: "**Source:** Code Sleuth" },
  { text: "" },
  { text: "Found by Code Sleuth: docs.security, case 2026-10-31-public-1,", tone: "soft" },
  { text: "at 4999d78.", tone: "soft" },
];

// The same card from a real polish run, as the sleuth wrote it and as the
// polish pass returned it; cropped after the fix, wrapped to the sheets, the
// words verbatim.
const THE_CARD_BEFORE: TypedLine[] = [
  { text: "# Task: Add a security policy", bold: true },
  { text: "" },
  { text: "No SECURITY.md: nobody knows where to report a" },
  { text: "problem quietly." },
  { text: "" },
  { text: "**What the books call it:** vulnerability" },
  { text: "disclosure policy" },
  { text: "" },
  { text: "**The fix**", bold: true },
  { text: "Add a SECURITY.md at the root, in .github/ or in" },
  { text: "docs/: which versions get fixes, and how to report" },
  { text: "a vulnerability privately (GitHub's private" },
  { text: "vulnerability reporting, or an address)." },
];
const THE_CARD_AFTER: TypedLine[] = [
  { text: "# Task: Add a security policy", bold: true },
  { text: "" },
  { text: "There is no SECURITY.md, so nobody knows where to" },
  { text: "report a problem privately." },
  { text: "" },
  { text: "**What the books call it:** vulnerability" },
  { text: "disclosure policy" },
  { text: "" },
  { text: "**The fix**", bold: true },
  { text: "Add a SECURITY.md at the root, in .github/ or in" },
  { text: "docs/. It should say which versions get fixes, and" },
  { text: "how to report a vulnerability privately (GitHub's" },
  { text: "private vulnerability reporting, or an address)." },
];

// The ToolKit lines as the terminal prints them: filedLine and skipLine from
// src/cli/copy.ts (the skipped line wrapped at its semicolon), and the case's
// last line, with the Space found from the repository's origin (toolkit.found).
const THE_TOOLKIT_LINES: TypedLine[] = [
  { text: "  Filed    names.deny as Bug K7M2, in widget/backlog/", bold: true },
  { text: "  Skipped  paths.machine: already filed as Task H3RE", tone: "soft" },
  { text: "           on 2026-10-30; --refile to file it again", tone: "soft" },
  { text: "" },
  { text: "ToolKit    found (tk, Space 'widget', this" },
  { text: "           repository's own); filed 1 card in" },
  { text: "           the Space 'widget' (Bug K7M2); 1 was" },
  { text: "           already filed." },
];

// The README's quick start, word for word: one line, run from the home folder.
const THE_QUICK_START: TypedLine[] = [{ text: "cd ~ && npx github:johnfrog76/code-sleuth#v0.2.0 path/to/your/repo --goal public", bold: true }];

// The opening lead, two sentences on both; the phone's second is shorter, where
// the copy panel is short and the chrome sits under it.
function JungleLead() {
  const compact = useCompactLayout();
  return compact ? (
    <>You built it, it works, and you want to share it. But a repository grows while you are busy, and the key you deleted last year could still be down there.</>
  ) : (
    <>
      You built it, it works, and you want to share it. But a repository grows while you are busy: packages hang from the
      branches, a note-to-self is pinned to a trunk, and the key you deleted last year could still be down there.
    </>
  );
}

// The ToolKit lead, two sentences on a desk and one on a phone, where the
// full lead runs under the pager.
function ToolkitLead() {
  const compact = useCompactLayout();
  return compact ? <>With ToolKit, the same author&apos;s tool, and the toolkit flag on, he asks once, then files each card in this repository&apos;s ToolKit Space, when there is one.</> : <>With ToolKit, the same author&apos;s tool, installed and the toolkit flag on, he asks once, then files each card through ToolKit&apos;s own command, in the ToolKit Space that belongs to this repository, when ToolKit has one. Without ToolKit, the case file is yours, and one line says what ToolKit would add.</>;
}

// ── Slide stages ─────────────────────────────────────────────────────────────

// 1. A Repo Is a Jungle — from the ground, unkept: dusk, vines, fog, too
// full, and one glint in the dark. No sleuth yet.
function JungleStage() {
  const compact = useCompactLayout();
  return (
    <Stage bg={STAGE_BG_JUNGLE_DARK}>
      <Scene>
        <Jungle dark glint={false} />
        <g style={settle(0.4)}>
          <Bough y={140} />
        </g>
        {/* each string starts in the bough (its centre line at that x), so the packages hang from the branch */}
        <g style={settle(0.9)}>
          <HangingPackage x={1020} y={200} top={140} />
          <HangingPackage x={560} y={185} s={0.8} top={129} />
        </g>
        <g style={settle(1.2)}>
          <Trunk x={360} />
          <PinnedNote x={372} y={470} note="TODO" />
          <HangingPackage x={compact ? 1180 : 1270} y={230} s={0.7} top={compact ? 146 : 150} />
        </g>
        <Dusk />
        <Glint x={900} y={790} strong />
      </Scene>
    </Stage>
  );
}

// 2. The Sloth Detective — the same dark jungle from the bough: he hangs,
// hat on, in the one shaft of light; the case map beside him; the glint below.
function BranchStage() {
  return (
    <Stage bg={STAGE_BG_JUNGLE_DARK}>
      <Scene>
        <Jungle dark glint={false} />
        <Bough y={120} />
        <Dusk />
        <LightShaft x={840} w={260} />
        <Glint x={900} y={790} strong />
        <g style={settle(0.6)}>
          <Clipboard x={520} y={200} note="CASE: PUBLIC" />
        </g>
        <g style={settle(0.3, 1.2)}>
          <Sleuth pose="hanging" x={820} y={300} scale={1.15} />
        </g>
      </Scene>
    </Stage>
  );
}

// 3. The Office — dark under one lamp; the jungle through the blinds; the
// first page in the typewriter: the question.
function OfficeStage() {
  const compact = useCompactLayout();
  return (
    <Stage>
      <Scene>
        <Office
          behindDesk={
            <g style={settle(0.5)}>
              <Sleuth pose="reading" x={540} y={400} scale={0.95} />
            </g>
          }
        >
          {compact ? (
            <TypedPage x={700} y={400} w={360} lines={THE_QUESTION_PHONE} fontSize={PHONE_TYPE} rotate={-1} delay={1.0} pad={16} />
          ) : (
            <TypedPage x={700} y={274} w={400} lines={THE_QUESTION} fontSize={12} rotate={-1} delay={1.0} pad={20} />
          )}
        </Office>
      </Scene>
    </Stage>
  );
}

// 4. One Goal, One Case — close on the desk: three folders, one drawn under
// the lamp, the other two behind it on the desk, dimmed, one peeking out each side.
function GoalStage() {
  const compact = useCompactLayout();
  return (
    <Stage>
      <Scene>
        <Camera cx={720} cy={520} k={1.25}>
          <Office
            mug={false}
            lampX={compact ? 170 : 380}
            typewriterX={1500}
            behindDesk={
              <g style={settle(0.4)}>
                <Sleuth pose="pointing" x={540} y={372} scale={0.95} />
              </g>
            }
          >
            <g style={settle(0.9)}>
              {/* the phone's narrower band shows one shelf folder, not two */}
              {!compact && <CaseFolder x={970} y={DESK_Y - 130} w={170} h={130} label="quality" dim />}
              <CaseFolder x={560} y={DESK_Y - 140} w={180} h={130} label="security" dim />
            </g>
            <g style={settle(1.3)}>
              <CaseFolder x={720} y={DESK_Y - 180} w={300} h={200} label="public facing" />
            </g>
          </Office>
        </Camera>
      </Scene>
    </Stage>
  );
}

// 5. The Stakeout — the run's header in the typewriter, its foot on the
// platen, the dots typing in.
function StakeoutStage() {
  const compact = useCompactLayout();
  return (
    <Stage>
      <Scene>
        <Office
          keyBeat
          behindDesk={
            <g style={settle(0.3)}>
              <Sleuth pose="reading" x={540} y={400} scale={0.95} />
            </g>
          }
        >
          {compact ? (
            <TypedPage x={700} y={250} w={464} lines={THE_STAKEOUT_PHONE} fontSize={PHONE_TYPE} rotate={-1} typing={6} delay={0.6} pad={16} />
          ) : (
            <TypedPage x={690} y={266} w={520} lines={THE_STAKEOUT} fontSize={11.5} rotate={-1} typing={10} delay={0.6} pad={20} />
          )}
        </Office>
      </Scene>
    </Stage>
  );
}

// 6. The Verdict — the folder open flat under the lamp, the page on it, the
// stamp landing on the corner and holding.
function VerdictStage() {
  const compact = useCompactLayout();
  return (
    <Stage>
      <Scene>
        <Camera cx={compact ? 800 : 900} cy={540} k={1.05}>
          <Office
            mug={false}
            doorName={compact ? null : DOOR_NAME}
            behindDesk={
              <g style={settle(0.2)}>
                <Sleuth pose="pointing" x={520} y={400} scale={0.9} />
              </g>
            }
          >
            {/* the open folder bleeds off the right edge on purpose: the page is cropped to the claim, the verdict and the groups */}
            <CaseFolder x={580} y={DESK_Y - 220} w={300} h={240} open>
              {compact ? (
                <TypedPage x={312} y={10} w={308} lines={THE_VERDICT_PHONE} fontSize={PHONE_TYPE} rotate={0} delay={0.6} pad={14} />
              ) : (
                <TypedPage x={312} y={10} w={640} lines={THE_VERDICT} fontSize={10} rotate={0} delay={0.6} pad={16} />
              )}
            </CaseFolder>
            <VerdictStamp x={730} y={DESK_Y - 80} word="NOT MET" delay={1.8} scale={0.9} />
          </Office>
        </Camera>
      </Scene>
    </Stage>
  );
}

// 7. A Checklist, Not a Report — case.md's loose ends on the blotter, three
// of them, each with where; the glass held at the page's left edge, the hand
// that holds it clear of the ids.
function ChecklistStage() {
  const compact = useCompactLayout();
  return (
    <Stage>
      <Scene>
        <Camera cx={compact ? 840 : 864} cy={500} k={1.15}>
          <Office
            mug={false}
            typewriterX={1500}
            lampX={170}
            boardX={400}
            boardW={180}
            doorName={compact ? null : DOOR_NAME}
            behindDesk={
              <g style={settle(0.6)}>
                <Sleuth
                  pose="holding-page"
                  x={compact ? 531 : 539}
                  y={525}
                  scale={0.95}
                  holding={
                    compact ? (
                      <TypedPage x={650} y={480} w={512} lines={THE_CHECKLIST_PHONE} fontSize={PHONE_TYPE} rotate={-0.6} delay={0.4} pad={16} />
                    ) : (
                      <TypedPage x={670} y={470} w={637} lines={THE_CHECKLIST} fontSize={10.5} rotate={-0.6} delay={0.4} pad={16} />
                    )
                  }
                />
              </g>
            }
          />
        </Camera>
      </Scene>
    </Stage>
  );
}

// 8. Card-Ready — one card, whole, under the lamp; the folder beside it with
// the rest fanned; the claw on the done-when box.
function CardStage() {
  const compact = useCompactLayout();
  return (
    <Stage>
      <Scene>
        <Camera cx={compact ? 770 : 800} cy={480} k={1}>
          <Office
            mug={false}
            typewriterX={1500}
            lampX={100}
            doorName={compact ? null : DOOR_NAME}
            behindDesk={
              <g>
                {compact ? (
                  <TypedPage x={632} y={420} w={476} lines={THE_CARD_PHONE} fontSize={PHONE_TYPE} rotate={-1} delay={0.4} pad={16} />
                ) : (
                  <TypedPage x={612} y={284} w={490} lines={THE_CARD} fontSize={11} rotate={-1} delay={0.4} pad={16} />
                )}
                <g style={settle(0.9)}>
                  <Sleuth pose="pointing" x={compact ? 372 : 392} y={compact ? 496 : 446} scale={0.9} />
                </g>
              </g>
            }
          >
            <g style={settle(1.2)}>
              {/* the rest of the cards, fanned out of the folder, which stands on the desk beside the lamp */}
              <rect x={1120} y={DESK_Y - 144} width={110} height={100} rx={3} fill={P.paper} transform={`rotate(-7 1175 ${DESK_Y - 94})`} opacity={0.9} />
              <rect x={1116} y={DESK_Y - 138} width={110} height={100} rx={3} fill={P.paperDeep} transform={`rotate(-3 1171 ${DESK_Y - 88})`} />
              <CaseFolder x={1112} y={DESK_Y - 120} w={120} h={120} />
            </g>
          </Office>
        </Camera>
      </Scene>
    </Stage>
  );
}

// 9. Polished, Every Path and Number Kept — the card as written standing on
// the blotter at his glass, the card polished beside it; the sleuth reads the pair.
function PolishStage() {
  const compact = useCompactLayout();
  return (
    <Stage>
      <Scene>
        <Camera cx={compact ? 830 : 860} cy={460} k={1.15}>
          <Office
            mug={false}
            typewriterX={1500}
            lampX={170}
            boardX={400}
            boardW={180}
            doorName={compact ? null : DOOR_NAME}
            behindDesk={
              <g style={settle(0.6)}>
                <Sleuth
                  pose="holding-page"
                  x={compact ? 560 : 535}
                  y={400}
                  scale={0.95}
                  holding={
                    compact ? (
                      <TypedPage x={724} y={384} w={436} lines={THE_CARD_BEFORE_PHONE} fontSize={PHONE_TYPE} rotate={-2} delay={0.4} pad={14} />
                    ) : (
                      <TypedPage x={706} y={388} w={305} lines={THE_CARD_BEFORE} fontSize={9.5} rotate={-2} delay={0.4} pad={14} />
                    )
                  }
                />
              </g>
            }
          >
            {compact ? (
              <TypedPage x={760} y={500} w={436} lines={THE_CARD_AFTER_PHONE} fontSize={PHONE_TYPE} rotate={1} delay={1.1} pad={14} />
            ) : (
              <TypedPage x={1018} y={388} w={305} lines={THE_CARD_AFTER} fontSize={9.5} rotate={1} delay={1.1} pad={14} />
            )}
          </Office>
        </Camera>
      </Scene>
    </Stage>
  );
}

// 10. Filed in ToolKit — the door open for the first time; the filed and
// skipped lines on the page; the sleuth with a claw on the door; the card
// goes out as an Envelope and holds in the lit room beyond.
function ToolkitStage() {
  const compact = useCompactLayout();
  return (
    <Stage>
      <Scene>
        <Office
          doorOpen
          mug={false}
          typewriterX={740}
          behindDesk={
            <g style={settle(0.3, 1.2)}>
              <Sleuth pose="holding-door" x={1010} y={360} scale={0.82} />
            </g>
          }
        >
          {compact ? (
            <TypedPage x={540} y={370} w={380} lines={THE_TOOLKIT_LINES_PHONE} fontSize={PHONE_TYPE} rotate={-1} delay={0.5} pad={16} />
          ) : (
            <TypedPage x={560} y={328} w={376} lines={THE_TOOLKIT_LINES} fontSize={11} rotate={-1} delay={0.5} pad={16} />
          )}
          <Envelope x={430} y={520} id={compact ? undefined : "K7M2"} type="bug" posted delay={1.6} />
        </Office>
      </Scene>
    </Stage>
  );
}

// ── The phone's trims: each page cropped to its one
// line, a size up, so it reads at phone size; the copy carries the rest. ──
const PHONE_TYPE = 20;
const THE_QUESTION_PHONE: TypedLine[] = [{ text: "So, you want to know what's" }, { text: "going on with your repo?" }];
const THE_STAKEOUT_PHONE: TypedLine[] = [
  { text: "code-sleuth messy", tone: "soft" },
  { text: "  --goal public --offline", tone: "soft" },
  { text: "" },
  { text: "Out   nothing: this run makes" },
  { text: "      no network calls" },
  { text: "Taking my time. 24 leads to run down" },
  { text: "........................ done." },
];
const THE_VERDICT_PHONE: TypedLine[] = [
  { text: "NOT MET", tone: "stamp", bold: true },
  { text: "By my checklist:", tone: "stamp", bold: true },
  { text: "not met for", tone: "stamp", bold: true },
  { text: "public facing.", tone: "stamp", bold: true },
  { text: "One smoking gun,", tone: "stamp", bold: true },
  { text: "eight loose ends.", tone: "stamp", bold: true },
];
const THE_CHECKLIST_PHONE: TypedLine[] = [
  { text: "  [ ] docs.security", tone: "loose" },
  { text: "      No SECURITY.md: nobody knows", tone: "loose" },
  { text: "      where to report a problem quietly.", tone: "loose" },
];
const THE_CARD_PHONE: TypedLine[] = [
  { text: "# Task: Add a security policy", bold: true },
  { text: "" },
  { text: "**Done when**", bold: true },
  { text: "- [ ] `code-sleuth --goal public`" },
  { text: "      reads `docs.security` as Clean." },
];
const THE_CARD_BEFORE_PHONE: TypedLine[] = [{ text: "No SECURITY.md: nobody knows" }, { text: "where to report a problem quietly." }];
const THE_CARD_AFTER_PHONE: TypedLine[] = [
  { text: "There is no SECURITY.md, so nobody" },
  { text: "knows where to report a problem" },
  { text: "privately." },
];
const THE_TOOLKIT_LINES_PHONE: TypedLine[] = [
  { text: "  Filed    names.deny", bold: true },
  { text: "           as Bug K7M2,", bold: true },
  { text: "           in widget/backlog/", bold: true },
];
const THE_QUICK_START_PHONE: TypedLine[] = [
  { text: "cd ~ && npx", bold: true },
  { text: "  github:johnfrog76/", bold: true },
  { text: "  code-sleuth#v0.2.0", bold: true },
  { text: "  path/to/your/repo", bold: true },
  { text: "  --goal public", bold: true },
];

// 11. Case Closed — the folder closed and stamped, the blinds a slat wider,
// the quick start in the typewriter, the sleuth at the open door tipping his hat.
function CaseClosedStage() {
  const compact = useCompactLayout();
  return (
    <Stage>
      <Scene>
        <Office
          doorOpen
          blinds={1}
          jungle="tended"
          behindDesk={
            <g style={settle(0.3, 1.2)}>
              <Sleuth pose="tipping-hat" x={compact ? 1158 : 1225} y={360} scale={0.82} />
            </g>
          }
        >
          <g style={settle(0.6)}>
            <CaseFolder x={420} y={DESK_Y - 160} w={240} h={170}>
              {/* two words at 0.62 fit the closed folder's 240; 0.7 ran past its edges */}
              <VerdictStamp x={120} y={95} word="NEARLY MET" scale={0.62} delay={1.2} />
            </CaseFolder>
          </g>
          {compact ? (
            <TypedPage x={560} y={272} w={400} lines={THE_QUICK_START_PHONE} fontSize={PHONE_TYPE} rotate={-1} delay={0.9} pad={20} />
          ) : (
            <TypedPage x={600} y={436} w={540} lines={THE_QUICK_START} fontSize={10} rotate={-1} delay={0.9} pad={20} />
          )}
        </Office>
      </Scene>
      <CopyLinkButton url="https://github.com/johnfrog76/code-sleuth" />
    </Stage>
  );
}

// ── Deck ─────────────────────────────────────────────────────────────────────

export const codeSleuthDeck: Deck = {
  id: "code-sleuth",
  project: "code-sleuth",
  // A product commercial, built in a separate studio; its live home is this repository's landing page. Its project keeps it out of every other build.
  state: DeckState.Complete,
  title: "Code Sleuth",
  summary:
    "A sloth private eye takes the case of your repository. You point him at a repo, pick a goal, and he takes his time: twenty-four leads, run down on your own machine, and nothing you wrote leaves it unless you ask him to have a model reword the cards. Back comes a verdict stamped on a case file, a checklist in plain private-eye language, and one card for each thing in the way, written so you can file it. The office is dark, the jungle outside is darker until the case is closed, and he never hurries.",
  tags: ["product", "code-sleuth", "security"],
  slides: (): Slide[] => [
    makeSlide({
      id: "a-repo-is-a-jungle",
      title: "A Repo Is a Jungle",
      eyebrow: "Slide 1 · The Jungle",
      lead: <JungleLead />,
      notes: (
        <>
          <Beat>Hold three seconds; let the fog drift and the glint catch before the first line. The jungle is dark because the repo is unkept.</Beat>
          <Say>Nobody here did anything wrong. You built something that works, and you want to share it.</Say>
          <Say>
            But a repository is a jungle. Packages hang from the branches. A note-to-self is pinned to a trunk. And the key you
            deleted last year could still be down there.
          </Say>
          <Say>Is it squeaky clean and ready to be out there, or does it have skeletons in the closet? From the ground, you can&apos;t tell.</Say>
          <Context>
            The pain in the product&apos;s own checks: deps.updates, quality.markers and secrets.history are the three things
            named, and the key file is files.sensitive. The before-state is a competent person with a repository that grew.
            The glint is the key; the deck does not say what it is until slide 5.
          </Context>
        </>
      ),
      content: <JungleStage />,
    }),
    makeSlide({
      id: "the-sloth-detective",
      title: "The Sloth Detective",
      eyebrow: "Slide 2 · The Sleuth",
      lead: "Code Sleuth is a sloth private eye for your repository. Point him at a repo, pick a goal, and a checklist and card-ready issues come back.",
      notes: (
        <>
          <Beat>Let him settle into the hang before the first line; the hat stays on, and that is the joke.</Beat>
          <Say>Code Sleuth is a sloth private eye for your repository. Point him at a repo, pick a goal, and a checklist and card-ready issues come back.</Say>
          <Say>He works on your machine, and he reads the repository without writing to it.</Say>
          <Say>The only calls he makes himself are the dependency lookups. He names every call before he starts, and run offline, nothing leaves at all.</Say>
          <Say>Two extras make him better, a model to reword the cards and ToolKit to file them, and he uses neither unless you ask.</Say>
          <Say>Slow is the point. He takes his time, and he runs every lead to the end.</Say>
          <Context>
            The product&apos;s own line, from package.json&apos;s description (&quot;Point it at a
            repo, pick a goal, run. A checklist and card-ready issues come back.&quot;). The calls: README.md, &quot;Without
            --polish, it makes no calls of its own but the dependency lookups, and it looks for ToolKit by starting PowerShell
            ... It names both before it runs, and --offline turns both off.&quot; docs/CONFIGURATION.md, &quot;What leaves the
            machine&quot;: the lookups send package names and versions to the npm registry or GitHub, never a file&apos;s
            contents, the path or the URL. The two extras, and neither required: README.md, the table. Read-only: docs/QUICKSTART.md; nothing it runs writes into the
            repository (CHANGELOG.md). The sloth is the README&apos;s ASCII sloth, drawn.
          </Context>
        </>
      ),
      content: <BranchStage />,
    }),
    makeSlide({
      id: "the-office",
      title: "The Office",
      eyebrow: "Slide 3 · The Office",
      lead: "Inside, it is an old-school office: one lamp, slat blinds, a typewriter, and the jungle, still dark, through the window. On the door, a name; on the first page, a question.",
      notes: (
        <>
          <Beat>Slow. Let the room be a room before the page is read.</Beat>
          <Say>This is the office. One lamp, a typewriter, the jungle through the blinds.</Say>
          <Say>Every case opens with the same question. So, you want to know what&apos;s going on with your repo?</Say>
          <Context>
            The office is drawn for the deck; it is not a screen of the product. The page is
            the first lines code-sleuth --help prints, with its version line left out; the same question opens
            every run.
          </Context>
        </>
      ),
      content: <OfficeStage />,
    }),
    makeSlide({
      id: "one-goal-one-case",
      title: "One Goal, One Case",
      eyebrow: "Slide 4 · The Goal",
      lead: "He asks one thing before he starts: what do you want to know? One goal, one checklist, and today's case: is it ready to be public facing?",
      notes: (
        <>
          <Beat>Hold on the three folders, then let the one slide under the lamp.</Beat>
          <Say>Before he reads a line, he asks what you want to know. One goal, one checklist.</Say>
          <Say>Today&apos;s case: is it ready to be public facing? Give him the goal on the command line, or he asks you in the terminal.</Say>
          <Context>
            Goal first: docs/CLI.md, &quot;Commands&quot;: with no --goal in a terminal it asks. If asked: only
            the public-facing goal ships today.
          </Context>
        </>
      ),
      content: <GoalStage />,
    }),
    makeSlide({
      id: "the-stakeout",
      title: "The Stakeout",
      eyebrow: "Slide 5 · The Stakeout",
      lead: "Twenty-four leads, run down on your own machine, to the last line ever added to the history. He names every call before he starts, and run offline, nothing leaves the room.",
      notes: (
        <>
          <Beat>Let the dots type at the sleuth&apos;s pace; do not speak over the first five.</Beat>
          <Say>
            Twenty-four leads, and he runs down every one. Secrets in the tree. Secrets in the history, every line ever added,
            so the key you deleted last year is still a key.
          </Say>
          <Say>Is there a license? Would a workflow run a stranger&apos;s code with your secrets?</Say>
          <Say>He never prints a secret whole. Run him offline and nothing leaves the room, and the page says so.</Say>
          <Context>
            24 is the public goal&apos;s check count (code-sleuth checks lists them, and the fixture case&apos;s counts line adds to it).
            The named checks: secrets.history reads git log -p --all; license.file; workflows.prtarget (docs/CHECKS.md). A
            secret is masked, never printed or stored whole: docs/CASE-FILE.md. The Out line is printed before any check runs and names every call the run will make; this run
            is typed with --offline, so it reads &quot;nothing&quot;. Without --offline it names the ToolKit probe (looking for
            ToolKit starts PowerShell, which may reach GitHub through gh) and any dependency lookups (docs/CONFIGURATION.md,
            &quot;What leaves the machine&quot;). The repo named is the product&apos;s fixture, messy.
          </Context>
        </>
      ),
      content: <StakeoutStage />,
    }),
    makeSlide({
      id: "the-verdict",
      title: "The Verdict",
      eyebrow: "Slide 6 · The Verdict",
      lead: "One verdict, stamped on the folder. Then the whole pile, sorted: smoking guns, loose ends, hunches, clean, and what he could not investigate, with the reason.",
      notes: (
        <>
          <Beat>The stamp lands, then hold a full second and a half before the first word. This is the held frame.</Beat>
          <Say>Met. Nearly met. Not met. One stamp, and he lands it.</Say>
          <Say>This one is not met: one smoking gun, a name that was supposed to stay private, and eight loose ends.</Say>
          <Say>
            Then the pile, sorted. Smoking guns stand between you and the goal. Loose ends should be tied before you go. Hunches
            are worth a look. Clean is clean. And a lead he could not run down says so, with the reason, and never reads as
            clean.
          </Say>
          <Context>
            Verdict and groups: docs/CASE-FILE.md. Not-investigated never reads clean: docs/CHECKS.md, opening. The page is the
            fixture case&apos;s case.md (its counts and checklist) in the terminal&apos;s layout (the stamp, then
            &quot;By my checklist: ...&quot;); the one smoking gun there is a deny-list name. The verdict words are
            the CLI&apos;s own, and so are the weights&apos; colours on the page.
          </Context>
        </>
      ),
      content: <VerdictStage />,
    }),
    makeSlide({
      id: "a-checklist-not-a-report",
      title: "A Checklist, Not a Report",
      eyebrow: "Slide 7 · The Checklist",
      lead: "Not a report you have to translate. A checklist in plain words: what he found and, when it lives in a file, the file and line.",
      notes: (
        <>
          <Beat>Let the viewer find the line that is theirs. Everyone has one.</Beat>
          <Say>He doesn&apos;t hand you a report. He hands you a checklist, in his own words.</Say>
          <Say>
            A path from somebody&apos;s machine: it works there and nowhere else. No SECURITY.md: nobody knows where to report a
            problem quietly. Each line says what he found and, when it lives in a file, the file and line.
          </Say>
          <Context>
            The lines are the checks&apos; own voice, from the fixture case, three of its eight loose ends as the terminal prints
            them; a finding with evidence carries path and line, and a missing file has neither (docs/CASE-FILE.md).
          </Context>
        </>
      ),
      content: <ChecklistStage />,
    }),
    makeSlide({
      id: "card-ready",
      title: "Card-Ready",
      eyebrow: "Slide 8 · The Card",
      lead: "One card for each thing in the way: a smoking gun is a Bug, a loose end is a Task. The card says the fix, and it is done when he reads the check as Clean.",
      notes: (
        <>
          <Beat>Hold on the done-when line; it is the whole idea of a card.</Beat>
          <Say>And one card for each thing in the way. A smoking gun makes a Bug. A loose end makes a Task. A hunch gets a card if you ask for all of them.</Say>
          <Say>
            The card says what the books call it, what the fix is, and when it is done: when he runs again and reads that
            check as Clean. The last line is the fingerprint, so you can find it in any backlog.
          </Say>
          <Context>Bug and Task, --all for hunches, the done-when, the fingerprint: docs/CASE-FILE.md, &quot;A card&quot;. The card is the fixture case&apos;s security-policy card, whole; the Source line above the fingerprint says which Code Sleuth wrote it. The version line is left off the page.</Context>
        </>
      ),
      content: <CardStage />,
    }),
    makeSlide({
      id: "polished-every-path-kept",
      title: "Polished, Every Path and Number Kept",
      eyebrow: "Slide 9 · The Polish",
      lead: "With an Anthropic API key and one flag, a small, efficient model rewords each card to read better. If a rewrite drops or changes a path, a number, a masked value or the fingerprint, or adds a link or too many words, he throws it away and keeps his own.",
      notes: (
        <>
          <Beat>Show both sheets for a beat before speaking; the viewer should see every path and number hold while the wording moved.</Beat>
          <Say>
            With an Anthropic API key and the polish flag, a small, efficient model rewords each card so it reads better. It is sent the card&apos;s text, masked, and the prompt that asks for the rewording: nothing else.
          </Say>
          <Say>
            What comes back is kept only if the hard facts survived: every path, every number, every masked value, the fingerprint.
            Change one, or add a link, or pad it out, and he throws it away and keeps the card he wrote.
          </Say>
          <Context>
            docs/POLISH.md: only with an Anthropic API key and --polish. The key lives in Code Sleuth&apos;s own .env, never the
            repository&apos;s (a key already in the environment wins). One request per card. The guard&apos;s list also refuses a
            rewrite that adds a link, a URL or HTML, or more than 15% more words than the card had. The two sheets
            are one card from a real polish run, before and after, word for word: four of four cards were polished and kept, and
            the run shifted &quot;quietly&quot; to &quot;privately&quot;, which the guard passes. If asked which model: the deck
            names the API, not the model.
          </Context>
        </>
      ),
      content: <PolishStage />,
    }),
    makeSlide({
      id: "a-real-toolkit-card",
      title: "Filed in ToolKit",
      eyebrow: "Slide 10 · ToolKit",
      lead: <ToolkitLead />,
      notes: (
        <>
          <Beat>Let the card land through the door, then hold.</Beat>
          <Say>ToolKit is the same author&apos;s tool. If it&apos;s installed and you add the toolkit flag, he asks once, saying how many cards and where they go.</Say>
          <Say>Say yes, and each card is filed through ToolKit&apos;s own command, in this repository&apos;s Space, when it has one. ToolKit gets the card exactly as he wrote it, never the polished copy.</Say>
          <Say>He keeps a ledger, so the same check is never filed twice unless you ask. And without ToolKit you still have the case file, and one line at the end says what ToolKit would add.</Say>
          <Context>
            A run of its own, not slide 5&apos;s: --toolkit can&apos;t go with --offline, because finding ToolKit starts
            PowerShell (docs/CLI.md). docs/TOOLKIT.md: --toolkit turns the filing on (README, &quot;ToolKit installed, and --toolkit&quot;); without it the
            case ends with the command to run. He finds ToolKit by asking it, and files nothing until you say yes, or give --yes. Each card goes to the
            Space&apos;s backlog folder, or to current on Azure DevOps, and a ledger beside this repository&apos;s cases remembers what was filed. The Space is the one
            --toolkit-space names, else the one whose address is this repository&apos;s origin, else ToolKit&apos;s active one, and
            the last line says which, unless --toolkit-space chose it. ToolKit gets the card as he wrote it, never a polished one. The ids on the page are
            placeholders.
          </Context>
        </>
      ),
      content: <ToolkitStage />,
    }),
    makeSlide({
      id: "case-closed",
      title: "Case Closed",
      eyebrow: "Slide 11 · Case Closed",
      lead: "One line, from your home folder, and the case is on your desk.\n\nTie the loose ends and the list is met: that is when the case is closed. Before you go, your software may have needs of its own.",
      notes: (
        <>
          <Beat>Let the hat tip sit before the first line, and let the page be read before the last. The jungle through the blinds is bright for the first time: the case is closed.</Beat>
          <Say>From your home folder, one line runs the release straight from GitHub and points him at your repo, with the goal.</Say>
          <Say>One line, and the case is on your desk. Tie the loose ends and the list is met: that is when the case is closed. Before you go, your software may have needs of its own.</Say>
          <Say>Code Sleuth. Case closed.</Say>
          <Context>
            The line is README.md&apos;s quick start, word for word: it needs Node 24 and git 2.31 or newer, pins the release
            with #v0.2.0, and starts in the home folder because npm reads the .npmrc of the folder it starts in. It is not on
            npm. Installing from a clone is the second way in (docs/QUICKSTART.md). The button opens the repository. The second line points to the case file&apos;s &quot;What MET doesn&apos;t cover&quot;, which has shipped:
            under a MET or a NEARLY MET verdict the case links to it. The stamp&apos;s word is the CLI&apos;s own. If asked: the
            project&apos;s page is johnfrog76.github.io/code-sleuth; once a month the first command is run against a decoy
            repository on Linux, macOS and Windows; and MET is a finding by this checklist, not permission to publish
            (docs/CHECKS.md).
          </Context>
        </>
      ),
      content: <CaseClosedStage />,
    }),
  ],
};
