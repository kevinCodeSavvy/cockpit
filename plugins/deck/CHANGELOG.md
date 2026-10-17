# Changelog

## 0.4.16

- New Tokens row: input and output tokens this session has used, summed across every response including subagents. Toggle with `/deck tokens on|off`.
- The `/deck collapsed rings` view shows the token total next to the spend ring.

## 0.4.15

- `/deck panel` now stays on. It reopens the panel each session and whenever it goes missing, until you run `/deck panel off`.

## 0.4.14

- The last-minute cache warning is shorter so the re-write cost is no longer clipped in the bar: `⚠ 45s · rewrite ~$0.80` instead of `⚠ expires in 45s · rewrite ~$0.80`. Nothing else about the warning changed.

## 0.4.13

- The Cache row warns in the last minute: it turns red and reads `⚠ expires in 45s · rewrite ~$0.80`, and the collapsed chip shows `cache ⚠45s`. The bar keeps draining, and nothing changes before the last minute.
- The 5h and 7d limit rows say when you will hit the limit at your current pace, if that comes before the reset: `hits ~4:12pm` (or `hits ~Thu 4pm` on a later day). The bar turns amber, and red inside two hours. In the expanded rows the right-hand column shows `⚠4:12pm` in place of the reset countdown; the collapsed chips and rings keep the reset and add the hit time. It needs at least five minutes of rising usage, like the burn rate, and shows nothing when the limit resets first.

## 0.4.12

- Deck opens expanded in every new session. It used to start however the last session left it, so one collapse stuck everywhere. `/deck always off` brings the old behaviour back.
- New **Spend** row: what this session has cost so far (and today's total when `/deck cost on`).
- New **Cache** row: a countdown to the prompt cache going cold and what re-writing it would cost (`warm · rewrite ~$1.01`, then `cold · rewrite ~$1.01`). `/deck cache 5m` switches the timer for an API key; `/deck cache on|off` and `/deck spend on|off` show or hide each row.
- The Context row shows on a fresh session (empty, with the window size) instead of waiting for the first reply.

## 0.4.11

- The "unsure → opus" tag names the deep model the turn was sent to, not the tier Jev named, and no longer adds a false "not applied" note.

## 0.4.10

- The Model route row marks a turn the router sent to the deep model because Jev was unsure: an amber "unsure → opus" tag beside the confidence (a "? unsure → opus" segment in the terminal). Needs jev-model-router 0.7.1 or later; with an older router nothing changes.

## 0.4.9

- `/deck version` shows which Deck version is running; `/deck status` ends with it too.
- README: the VS Code extension's chat panel draws neither Deck's band nor its panel yet; use its terminal mode.

## 0.4.8

- `/deck panel` opens Deck in a panel of its own, always expanded; `/deck panel off` closes it. It was meant for the VS Code extension, but as of extension 2.1.294 its chat panel draws no mod panels either.

## 0.4.7

- Claude Code for VS Code gets the Desktop look (SVG bars and the animated pet) once the extension draws mod panels. As of extension 2.1.294 its chat panel runs `/deck` but draws no panel; its terminal mode shows the full Deck.

## 0.4.6

- The Model route row now tells a suggestion from a change. "↓ cheaper" and "↑ deeper" appear only when the router really switched the model; when Jev picks a model the router doesn't apply (main-model routing is off by default), the row says `= kept` and "not applied".
- Route history: a filled square is a turn whose model the router changed, an outlined square is a suggestion only.

## 0.4.5

- Compact Desktop rows get 3px of space above and below, so the pills of neighboring rows no longer touch.

## 0.4.4

- Long prompts no longer squeeze the bars: the title column on Desktop is capped and long titles end in "…".
- Compact Desktop: when expanded, the pet walks along the header line next to the row count instead of its own strip.
- A plain chat turn (no tools, no agents) shows while Claude is thinking and disappears once it answers, instead of leaving "Done 0 tools".

## 0.4.3

- The Model route row now says when the router has no answer (out of credit, bad key, timeout) instead of showing the last good route: `kept opus · ! typesafe 402`. After three failures in a row it adds a hint to check the router's key or credit. Failed turns show as hollow squares in the route history.
- Desktop is more compact by default: tighter rows and a shorter pet lane. `/deck size roomy` brings back the old spacing.

## 0.4.2

- `/deck demo` now shows everything in a fresh session: a sample model route and sample 5h and 7d limits fill in until the real ones arrive, then real readings replace them.

## 0.4.1

- Removed Pet Runner (`/deck play`): it couldn't run smoothly enough inside Claude Code.
- Rings: labels no longer wrap onto several lines; spend reads "today · $4.30 this month".
- Chips: the Desktop app no longer hides a chip behind "+1" when there's room for it.
- Collapsed countdowns read `↻2h14m` instead of ticking seconds.
- The pet's lane is shorter, so a collapsed Deck takes less height.
- Spark in a narrow terminal keeps the label and rate whole; the sparkline shrinks instead.
- New `assets/styles.svg`: every bar style and collapsed look, on Desktop and in the terminal.

## 0.4.0

- **Rings**: a third collapsed look, `/deck collapsed rings`, with a ring per limit, its reset time, and spend.
- **Spend**: `/deck cost on` adds up what you spend today and this month across sessions (for pay-per-use API keys).
- **Spark**: a sixth bar style. Limits and context show a sparkline of recent history and a burn rate (`+12%/h`, `+5%/day`).
- **Pet Runner**: `/deck play`, a jump-over-the-bugs game that scores while Claude works and freezes when Claude needs you.
- Usage history is kept across sessions, so sparklines and rates survive a restart.

## 0.3.3

- Opening and closing Deck animate: rows unfold one after another (and fold back up on close). On Desktop each row also fades and rises in. Works from `0`, the footer button, `/deck`, and auto-expand.

## 0.3.2

- New collapsed look: `/deck collapsed text` shows one plain status line (limits, context, task, route, weather, clock). `/deck collapsed chips` keeps the mini bars.
- Two demos in the README, desktop and terminal, both drawn with Deck's own code and ending on the collapsed line.
- The test workflow asks for read-only access; added SECURITY.md.

## 0.3.1

- Agents started without a todo list now show as strips under the activity bar, with their model, like the demo.
- Both usage limits stay on screen when Claude Code reports only one window in an update.
- Bar titles show the words you typed, without system reminders or pasted blocks.
- The model route row no longer draws the confidence over the history squares.
- Agent names no longer run into their status in the strips.
- The terminal pet keeps a small margin from the band's right edge.
- The pet's lane is taller, so jumps aren't clipped.
- `/deck`, `/deck expand` and `/deck collapse` always reply.
- Tests run on every push (GitHub Actions).

## 0.3.0

First public release: plan bars, activity bar, subagent strips, context, 5h and 7d limits with reset countdowns, model route display, a pet, five bar styles, a style picker, clock and weather. CLI and Desktop.
