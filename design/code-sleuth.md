---
id: 5b24752c-24b4-4664-b1b7-61207681fdd5
---

# Repo Detective

> **The spec exists, 2026-10-31:** `spec/code-sleuth.spec.md`, version 0.1 draft, in review. The
> product is named **Code Sleuth**. Its decisions are D-CS1 to D-CS17 in the spec, section 3.

## What is it

An orchestrated tooling app that points at a codebase and tells you,
in plain PI language, what's going on with your repo.

> So, you want to know what's going on with your repo?

Is it safe, or is it up to no good?
Is it squeaky clean and ready to be out there,
or does it have skeletons in the closet?

## Why a sloth

Code Sleuth is a meticulous investigator. It shifts the focus from frantic speed to deep, comprehensive
security scanning. Like the animal's deliberate movements, it carefully analyzes dependencies and
configurations at each project milestone, to catch the vulnerabilities that rapid, superficial scans
often miss. It promotes an economy of effort: high-impact maintenance now, rather than chaotic debugging
later in development. The code sloth helps a codebase reach its milestones on sustainable, secure
footing rather than on rushed technical debt.

## Goal first

Repo Detective asks before it investigates:

- I want to scan my app for security issues?
- I want to scan my app to know what I need to do
  to get to a public milestone?
- Or another goal, like quality?

Check against a milestone — public, security, quality —
and run. One goal, one checklist.

## GUI and CLI

### CLI

Point it at a codebase and run the investigation:

- `repo-detective <repo-path>`
- Ask the goal first, then scan
- Output in PI language, not industry jargon
- No boring tool, fun to run on your own code

### GUI

The detective's office view:

- PI guy at a desk, slat blinds, name on the door
- Or an animal in a trench coat as a detective
- Report view: the case file, readable at a glance

## What it reports

- How far from public is this codebase?
- What are its issues?
- What packages are a security threat?
- A fun summary from the investigation
- A checklist to the goal you picked
- A work breakdown as cards

## Awesome edit: the Haiku pass

Cards come back, then you tweak them:

- Haiku, tweak my card if I want
- Via the Anthropic API, small and fast,
  Haiku does a great job of a card tweak
- Cards come back improved, ready to work

## Toolkit upsell: make the card

If you installed the Toolkit CLI, Repo Detective
doesn't stop at a report:

- Make a card with Toolkit, straight from
  the improved card
- Cards are the truth, cards live in the backlog,
  Team Agile reports them without duplication
- No Toolkit CLI installed? That's the upsell —
  install Toolkit, and your detective's cards
  become real work, in your own files

## Atoms, deck, docs

- **Atoms** — the building blocks of the investigation
- **Deck** — a short product deck
  telling the detective's story
- **Docs** — docs fill in the gaps

## Why it matters

Boring tools don't get used. Repo Detective makes it
fun to make public-facing code — point it at a repo,
get a detective's summary, get a checklist, get cards,
tweak them with Haiku, and, if you have Toolkit,
make them real cards. Investigate, summary, cards,
Haiku pass, Toolkit card — that's the loop.

## Journey

- 2026-10-31 Design: written as design/code-sleuth.md.
- 2026-10-31 Spec: became spec/code-sleuth.spec.md.
