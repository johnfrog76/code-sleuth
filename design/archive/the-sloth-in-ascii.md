---
id: f222e500-2653-408e-86a0-643f5510f314
description: "The sloth detective drawn in ASCII: the three options drafted for the README, the one chosen, and the small banner"
---

# The sloth in ASCII

**Closed:** 2026-11-02
**Outcome:** shipped. Option A, the sloth hanging from a branch, opens the README. The small banner is kept
for a compact use such as `code-sleuth --help`. B and C are kept here as the character's other poses.

All three share one sloth: a fedora, a round face whose dark eye stripes run down and outward from each eye
(stripes that run inward read as tears), a small nose, a wide smile, a double-breasted coat, and three hooked
claws. Every line is printable ASCII, with no tabs, and at most 72 columns.

## A: hanging from a branch (chosen, in the README)

```text
 ===============___=============================================
 ==============( ( (============================================
                \ \                _.-""""""""""""-._
                 \ \              /____________________\
                  \ \        .---'                      '---.
                   \ \       `------------------------------'
                    \ \           .-""""""""""""""""-.
                     \ \         |  (o)            (o)  |
                      \ \        |  ///    .--.    \\\  |
                       \ \       | //      `--'      \\ |
                        \ \       \      \______/      /
                         \ \       '-.______________.-'
                          \ \     |\   .----------.   /|__
                           \ \____| \  |   o  o   |  / | \ \
                            \_____|  \_|   o  o   |_/  |  \_\__.----.
                                  `----'----------`----'       /      \
                                                               \      /
                                                                `----'

                  Point it at a repo, pick a goal, run.
```

## B: the portrait, through the glass

One plain eye, and one magnified eye with its stripes enlarged inside the glass.

```text
                       _.-""""""""""""-._
                      /____________________\
                 .---'                      '---.
                 `------------------------------'
                      .-""""""""""""-.-'''''''-.
                     |  (o)        /           \
                     |  ///       |   (  O  )   |
                     | //    .--. |   \\\\\\\   |
                      \      `--' |    \\\\\    |
                       \   \____/  \           /
                        '-.________.'-._____.-'
                       |\   .----------.  /|\ \
                       | \  |   o  o   | / | \ \
                       |  \_|   o  o   |_/  |  \ \
                       `----'----------`----'  ( ( (

                Point it at a repo, pick a goal, run.
```

## C: at the desk

One paw tipping the hat, the other holding the glass over a case file.

```text
                   _.-""""""""""""-._
                  /____________________\
         ( ( (---'                      '---.
          \ \ `------------------------------'
           \ \     .-""""""""""""""""-.
            \ \   |  (o)            (o)  |
             \ \  |  ///    .--.    \\\  |
              \ \ | //      `--'      \\ |
               \ \ \      \______/      /            .----.
                \ \ '-.______________.-'            /      \
                 \ \ |\   .----------.   /|         \      /
                  \ \| \  |   o  o   |  / | \ \       `----'
                   \_|  \_|   o  o   |_/  |  \ \_____/
                     |    |          |    |   ( ( (   .----------.
 ==================================================|__________|=======
 |                                                                  |
 |                        [  o  ]                                   |

                 Point it at a repo, pick a goal, run.
```

## The small banner

Cut from B: at most 8 lines and 29 columns. In a TypeScript string literal, every backslash has to be
doubled, or the banner goes in a `String.raw` template.

```text
       _.-""""""""-._
   .--'______________'--.
   `-----------.-'''''-.
     |  (o)   / (  O  ) \
     |  ///  |  \\\\\\\  |
     | //  .- \  \\\\\  /
      \    `-  `-.___.-'\ \
       '-.____          ( ( (
```
