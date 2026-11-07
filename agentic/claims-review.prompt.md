# Claims review: one doc, pass or fail

A prompt for an independent reviewer. It judges **one** user-facing document against the code it describes,
and changes nothing. Run it once per document, with a fresh reviewer each time, who has not seen how the
document was written.

## Your task

You are reviewing `{{DOC}}` in the Code Sleuth repository, at the root of your working folder. Read that
document in full. Then read the code and tests it describes, as much as you need to check each claim. Where
to look:

- the commands, flags and words of the output: `src/cli/` (`copy.ts` holds the words, `--help` included)
- the checks and the goals: `src/engine/` (`checks/`, `goals.ts`, `copy.ts`)
- the case file and the cards: `src/case/`
- the polish pass: `src/polish/`; the ToolKit hand-off: `src/toolkit/` and `toolkit/handoff.ps1`
- the tests: `test/`; the contract: `spec/code-sleuth.spec.md`
- the other user-facing documents, for shared facts: `README.md`, `docs/*.md`, `SECURITY.md`

Do not edit, create or delete any file. Do not run anything that writes into the repository. You may run
read-only commands (`grep`, `git log`, reading files), and `npm test` only if the document makes a claim you
cannot check by reading.

## What to check

### (a) Claims

A claim is any statement of fact about what Code Sleuth does, reads, writes, sends, prints, refuses, or
promises, and any number. For each claim, record:

- **the claim**, quoted or closely paraphrased;
- **where**: the document's line number;
- **the evidence**: a file and line in the code, or a test, that shows it is true -- or what you found
  instead;
- **the verdict**, one of:
  - **backed** -- the code or a test shows it;
  - **unbacked** -- you could not find anything that shows it;
  - **overclaim** -- the code does less than the sentence says (a "never" with an exception, an "every" that
    misses one, a promise the code does not keep);
  - **stale** -- it was true once, and the code has moved on.

Statements of intent ("planned for a later release"), definitions, and advice to the reader are not claims
about the code; list them only if they contradict it. Nor is stated provenance: a sentence that says plainly it
is the maintainers' own account of something done outside the repository (a run, a test against a real
service), and says its records are not in the repository. List it as provenance, and judge only whether it is
worded that way.

### (b) Scope

- The checklist is never presented as **the** list. It is a helpful place to start; every project's bar is
  its own.
- MET is never presented as "safe to publish", or as permission. It means nothing on the checklist stands
  in the way.
- No goal, feature or platform is presented as available before it is. Only the public-facing goal can be
  investigated in this release.

### (c) Value first

- The document's opening says what the reader gets from it, or from the feature it describes.
- There is no fear or risk framing in the opening or the pitch ("what could hurt you", "before it's too
  late"). The weight words -- smoking gun, loose end, hunch -- belong to the checklist, not to the pitch.
- There is no "Disclaimer:" label. A limit is said inside an ordinary sentence.

### (d) Agreement

Every fact this document shares with another document (a flag, a path, a default, a count, a check's name,
weight or behaviour, an environment variable, a version) agrees with it. Quote both sides of any
disagreement.

### (e) Stage rules

The document is written for strangers:

- no person's name (the license's copyright line and the code of conduct's attribution are exempt);
- no private repository's name;
- no path from somebody's machine (`/Users/<name>/`, `/home/<name>/`, `C:\Users\<name>\`). A path written with
  `~`, `$HOME` or an environment variable is fine.

The project's own public URLs (its repository and its pages) and the ToolKit project's public page are fine.

## Your answer

1. A table of claims: claim, where, evidence, verdict.
2. One short paragraph each for (b), (c), (d) and (e), saying what you checked and what you found.
3. The last line is exactly `PASS` or `FAIL`.

The document **fails** if any claim is unbacked, an overclaim or stale, or if anything in (b) to (e) does
not hold. When it fails, list above that last line every failing line, quoted in full, each with its line
number and the one reason it fails. Do not suggest rewrites beyond a few words each: the author fixes it.

Judge what is written, not what you imagine was meant. When you are unsure whether a claim is backed, look
further before you decide; if you still cannot find it, it is unbacked.
