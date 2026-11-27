# Reinforcement learning from scratch, for Laravel developers

An interactive 45 minute talk given at **Laravel Nagpur, 27 Nov 2026**, by Bhushan Gaikwad.
It teaches reinforcement learning by starting from TDD: a test suite is a reward function.

**Watch the slides:** https://bhushan.github.io/laravel-nagpur-reinforcement-learning-from-scratch/

The whole deck is one self-contained `index.html` (about 560 KB). Fonts, images and code are inlined,
and the page makes no network requests.

## What the talk covers

12 slides, about 45 minutes.

| Act | Time | Covers |
| --- | --- | --- |
| Opening | 1:20 | Title, who is talking |
| TDD | 5:00 | Red, green, refactor, a live cart kata, why a test is a good judge |
| From TDD to RL | 6:40 | The same loop with new names, a Q-learning gridworld you can run |
| Anatomy of RL | 25:10 | One training lap in ten steps: task, prompt, policy, answer, sandbox, reward, group, advantage, update, repeat |
| Real world | 7:00 | rl-gym, a Laravel coding environment with real numbers; five places RL is used; thank you |

## Controls

| Key | Does |
| --- | --- |
| `Left` / `Right`, `PgUp` / `PgDn` | Previous or next slide. The slide arrives fully shown. |
| `V` | Switch the arrows to move view by view inside a slide |
| `Space`, `Down` / `Up` | Step forward or back within a slide |
| `A` | Auto-play the current slide, paced from its planned time. Press again to stop. |
| `Home` / `End` | First or last slide |
| `Esc` | Slide overview |
| `M` | Section map |
| `N` | Speaker notes (with the key list) |
| `T` | Planned-time clock |
| `F` | Full screen |

Clicking does nothing, so a stray click never changes the slide. `N`, `M`, `T` and `Esc` draw on top of the
slide, so do not press them while sharing your screen.

URL options: `#7` opens slide 7, `?step=4` opens at a step, `?all` reveals every step, `?static` turns off motion.

## Develop

Needs Python 3 (standard library only). The browser tests also need Google Chrome.

```bash
python3 build.py                          # src/ + assets/ -> index.html
python3 -m unittest discover -s tests -v  # structure, timing, fonts, security, then headless Chrome
tools/shot.sh 8 9                         # screenshots to /tmp/rl-shots
```

- `src/slides/*.html`: one file per act. Speaker notes live inside each slide.
- `src/js/*.js`: a small step engine and the interactive widgets. Widgets register before the engine.
- `src/styles/*.css`: tokens, chrome and components.
- `assets/`: the fonts (Geist, Geist Mono and Fraunces, Latin subsets), portrait and screenshots, inlined at build time.

The fonts have no arrows or Greek letters, so the tests reject any character they cannot draw.
`index.html` is a build output, but it is committed because GitHub Pages serves it directly.

## Security

The page is static and needs nothing from the network. A Content-Security-Policy in the page forbids every
remote origin, network calls, forms, plugins and `<base>` changes. Only the page's own inline code, styles,
fonts and images can run. Outbound links open with `noopener noreferrer`, and the referrer policy is
`no-referrer`. GitHub Pages serves it over HTTPS only.

## Honesty

Illustrative visuals are labelled as illustrative. Real numbers come from the rl-gym project: the baseline
model solved 0 of 7 Laravel tasks and 11 of 15 toy tasks. No reinforcement learning training has run yet,
and the deck says so.
