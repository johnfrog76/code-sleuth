import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Detection } from "../../src/toolkit/detect.js";
import { fileCard } from "../../src/toolkit/file.js";
import { findShell } from "../../src/toolkit/shell.js";
import { withScratch } from "../helpers/scratch.js";

// The code review's high finding 10, and medium 17 beside it: handoff.ps1 exited 0 when ToolKit wrote an error
// it did not throw, so a card that was never made went on the ledger; and it passed on $LASTEXITCODE, which is
// the last native program's, so a card ToolKit made read as failed. The real handoff.ps1, in the real pwsh,
// against a ToolKit that is a module of one verb in a scratch folder.

const CREATED = "[+] Created a.md in backlog/ -- Task K7M2, offline.";

// A ToolKit of one verb whose guard has the shape of ToolKit's own Invoke-ToolkitScript: it resets
// $LASTEXITCODE, runs the script, and reads the code it left: 2 a stated refusal, any other non-zero a failure, a
// throw a failure it states. It sets $LASTEXITCODE, and throws only under TOOLKIT_QUIET_STARTUP. A script's own
// `exit N` is `$global:LASTEXITCODE = N; return` here: an exit in a script block would end the shell.
const VERB = `function Invoke-FakeGuard {
  param([scriptblock]$Body, [switch]$IgnoresMarker)
  $refusal = ''
  $code = 0
  try {
    $global:LASTEXITCODE = 0
    $global:P20StatedError = $null
    & $Body
    $code = $LASTEXITCODE
    if ($code -eq 2) { $refusal = [string]$global:P20StatedError }
    elseif ($code) { throw "exit code $code" }
  }
  catch {
    $failure = $_.Exception.Message
    Write-Host "Error: $failure"
    Write-Host "Hint: Run tkLog -Errors for details."
    if ($code) { $global:LASTEXITCODE = $code } else { $global:LASTEXITCODE = 2 }
    if ($env:TOOLKIT_QUIET_STARTUP -and -not $IgnoresMarker) { throw $failure }
    return
  }
  if ($refusal) {
    $global:LASTEXITCODE = 2
    if ($env:TOOLKIT_QUIET_STARTUP -and -not $IgnoresMarker) { throw $refusal }
  }
}
function tkNewPrompt {
  param([string]$Title, [string]$Type, [string]$Description)
  $refuse = { Write-Host "Error: no such Space"; Write-Host "Hint: pick one"; $global:P20StatedError = 'no such Space'; $global:LASTEXITCODE = 2; return }
  if ($Title -eq 'refuses') { Invoke-FakeGuard $refuse; return }
  if ($Title -eq 'refuses-ignoring-the-marker') { Invoke-FakeGuard $refuse -IgnoresMarker; return }
  if ($Title -eq 'fails-silently') { Invoke-FakeGuard { $global:LASTEXITCODE = 5; return }; return }
  if ($Title -eq 'throws') { Invoke-FakeGuard { throw 'the hub is gone' }; return }
  if ($Title -eq 'writes-an-error') { Invoke-FakeGuard { Write-Error 'the hub is read-only'; $global:LASTEXITCODE = 0; return }; return }
  if ($Title -eq 'a-native-program-fails') { Invoke-FakeGuard { & git --no-such-flag 2>$null; Write-Host "${CREATED}"; $global:LASTEXITCODE = 0; return }; return }
  if ($Title -eq 'a-native-program-warns') { Invoke-FakeGuard { & git -C '/no/such/folder' status; Write-Host "${CREATED}"; $global:LASTEXITCODE = 0; return }; return }
  if ($Title -eq 'handles-its-own-error') { Invoke-FakeGuard { try { Get-Item '/no/such/file' -ErrorAction Stop } catch { }; Write-Host "${CREATED}"; $global:LASTEXITCODE = 0; return }; return }
  Invoke-FakeGuard { Write-Host "${CREATED}"; $global:LASTEXITCODE = 0; return }
}
Export-ModuleMember -Function tkNewPrompt, Invoke-FakeGuard
`;

const shell = findShell(process.env);

function file(scratch: string, title: string) {
  const mods = join(scratch, "mods");
  mkdirSync(join(mods, "FakeTK"), { recursive: true });
  writeFileSync(join(mods, "FakeTK", "FakeTK.psm1"), VERB);
  const detection: Extract<Detection, { state: "detected" }> = {
    state: "detected",
    via: "cli",
    shell: shell!,
    prefix: "tk",
    space: null,
    spaces: null,
    addresses: null,
    root: null,
    folders: null,
  };
  return fileCard(
    detection,
    { title, type: "Task", body: "the body" },
    { env: process.env, moduleRoot: mods },
  );
}

const hasGit = spawnSync("git", ["--version"], { stdio: "ignore" }).status === 0;

describe.skipIf(shell === undefined || !hasGit)("what handoff.ps1 reports is ToolKit's own outcome", () => {
  it("files a card ToolKit made", () =>
    withScratch((scratch) =>
      expect(file(scratch, "plain")).toMatchObject({ status: "filed", card: "Task K7M2" }),
    ));

  it("reads a stated refusal, which ToolKit's guard throws under TOOLKIT_QUIET_STARTUP", () =>
    withScratch((scratch) =>
      expect(file(scratch, "refuses")).toMatchObject({ status: "refused", sentence: "no such Space" }),
    ));

  it("reads a stated refusal from $LASTEXITCODE, from a ToolKit that returns without throwing", () =>
    withScratch((scratch) =>
      expect(file(scratch, "refuses-ignoring-the-marker")).toMatchObject({
        status: "refused",
        sentence: "no such Space",
      }),
    ));

  it("fails on a script that exits non-zero without a word", () =>
    withScratch((scratch) =>
      expect(file(scratch, "fails-silently")).toMatchObject({ status: "failed", sentence: "exit code 5" }),
    ));

  it("reads a script that throws as the failure ToolKit states, its exit 2", () =>
    withScratch((scratch) =>
      expect(file(scratch, "throws")).toMatchObject({ status: "refused", sentence: "the hub is gone" }),
    ));

  it("fails when ToolKit writes an error it does not handle, and files nothing", () =>
    withScratch((scratch) =>
      expect(file(scratch, "writes-an-error")).toMatchObject({
        status: "failed",
        sentence: "the hub is read-only",
      }),
    ));

  it("files a card ToolKit made, though a native program it ran exited non-zero", () =>
    withScratch((scratch) =>
      expect(file(scratch, "a-native-program-fails")).toMatchObject({ status: "filed", card: "Task K7M2" }),
    ));

  it("files a card ToolKit made, though a native program it ran wrote to stderr", () =>
    withScratch((scratch) =>
      expect(file(scratch, "a-native-program-warns")).toMatchObject({ status: "filed", card: "Task K7M2" }),
    ));

  // The code review's low finding TK-4: a value that is itself a parameter token could not be filed.
  it.each(["-Probe", "--", "-x: y", "-ModuleRoot", "-Title:inner"])("files a card titled %j", (title) =>
    withScratch((scratch) =>
      expect(file(scratch, title)).toMatchObject({ status: "filed", card: "Task K7M2" }),
    ),
  );

  it("files a card when ToolKit caught an error of its own on the way", () =>
    withScratch((scratch) =>
      expect(file(scratch, "handles-its-own-error")).toMatchObject({ status: "filed", card: "Task K7M2" }),
    ));
});

const CHECKOUT = process.env.CODE_SLEUTH_TOOLKIT;

describe.skipIf(!CHECKOUT || shell === undefined)(
  "a refusal from the real ToolKit (skipped: set CODE_SLEUTH_TOOLKIT to a ToolKit checkout to run it)",
  () => {
    it("reads the real NewPrompt's refusal of a hub that is not there as refused, and files nothing", () =>
      withScratch((scratch) => {
        const env: NodeJS.ProcessEnv = { ...process.env, PROMPTS_ROOT: join(scratch, "no-hub-here") };
        delete env.P20_ACTIVE_SPACE;
        const detection: Extract<Detection, { state: "detected" }> = {
          state: "detected",
          via: "cli",
          shell: shell!,
          prefix: "tk",
          space: null,
          spaces: null,
          addresses: null,
          root: null,
          folders: null,
        };
        const result = fileCard(
          detection,
          { title: "A refused card", type: "Task", body: "the body" },
          {
            env,
            moduleRoot: CHECKOUT!,
          },
        );
        expect(result.status).toBe("refused");
        expect(result.status === "refused" && result.sentence).toMatch(/^Hub not found/);
      }));
  },
);
