# cockpit

A panel above the Claude Code prompt that shows what is going on, plus suggested next steps, plus smart model routing. One install.

- **Deck**: context window, 5-hour and 7-day limits with reset countdowns, this session's **spend**, the **prompt-cache timer** with the cost of a cold re-write, and the model route. Opens expanded in every new session.
- **Next steps**: up to three suggested next prompts in a panel of their own above Deck. Press 1, 2 or 3 to draft one, 0 to dismiss.
- **Jev model router**: picks the model and reasoning effort for each task using [TypeSafe's Jev](https://typesafe.ai), and Deck shows each decision live.

![The cockpit panel in Claude Code Desktop: next-step suggestions in their own panel above Deck, which shows the Jev model route, context, 5-hour and 7-day limits, session spend and the prompt-cache timer](docs/panel.png)

*The cockpit in Claude Code Desktop. Top: three suggested next prompts in their own panel (press 1, 2 or 3 to draft one, 0 to dismiss). Below it, Deck: the Jev model route, context, 5-hour and 7-day limits, this session's spend, and the prompt-cache timer with the cost of a cold re-write. (Composite of two screenshots from the same setup.)*

Works in Claude Code Desktop and the terminal. Needs Claude Code 2.1.287 or later.

## Install

```
/plugin marketplace add kevinCodeSavvy/cockpit
/plugin install cockpit@cockpit
```

Restart Claude Code (or run `/reload-plugins`). Installing `cockpit` pulls in `deck`, `next-steps` and `jev-model-router` as dependencies. You can also install any one of them on its own: `/plugin install deck@cockpit`.

## First run

The first time you start a session after installing, with no TypeSafe key set, the Jev router prints a **one-time** line in the transcript. It says routing is using Claude Code's built-in classifier and shows the command for saving a key (the same one in [Set up Jev model routing](#set-up-jev-model-routing)). It only prints the command: it asks for the key with hidden input and never reads or logs one.

- It shows **once**, then never again, so you can ignore it if you don't want a key.
- It stays quiet if a key is already set or you chose `provider: builtin`.
- After you save a key, restart Claude Code for it to take effect.

## Set up Jev model routing

The router asks [TypeSafe's Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), a small decision model, how hard each task is, then picks the model and reasoning effort for it: mechanical work goes to a cheaper model, hard or risky work goes to a deeper one. Deck's **Model route** row shows every decision live, with Jev's confidence.

**It works without a key.** (See [First run](#first-run) for the one-time reminder.) With no key the router uses Claude Code's built-in classifier: nothing leaves your machine, but there is no confidence score, and it can only move a task *up*. Add a TypeSafe key to get Jev's calibrated confidence and routing in both directions.

1. **Get a key.** Create an API key in your TypeSafe account at [typesafe.ai](https://typesafe.ai).
2. **Save it.** Run this in your own terminal. The prompt hides what you paste, and the key never goes into a chat, a file, or `settings.json` (Claude Code stores it as a sensitive value):

   ```sh
   printf 'TypeSafe API key (hidden): '; read -rs K; echo
   printf '{"typesafeApiKey":"%s"}' "$K" | claude plugin configure jev-model-router@cockpit --values-stdin
   unset K
   ```

   Check it took with `claude plugin configure jev-model-router@cockpit`, which lists every option and whether it is set.
3. **Restart Claude Code** and start a new session. Run `/deck quiet off` once and look for `[jev-model-router] ready on typesafe`. If you see `built-in` instead, the key was not picked up.

Leave **Backend** on `auto`: it uses TypeSafe when a key is set. A Vercel AI Gateway key (`gatewayApiKey`) works as a fallback.

**Privacy:** with a key, the text of each prompt is sent to `api.typesafe.ai` to be classified. Check that is acceptable before using it on work projects. Saved logs hold only a redacted 200-character summary, never full prompts.

### What it changes

| Switch | Controls | Default |
|---|---|---|
| `routeSubagentModel` | the model each subagent runs on | on |
| `routeMainEffort` | the reasoning effort of your main chat | on |
| `routeMainModel` | the model of your main chat | **off** |

The main-chat model is off on purpose. Switching it mid-session throws away the prompt cache, and re-caching a long conversation can cost more than the cheaper model saves. With `cacheAware` on (the default), the router also keeps the current model when a switch would cost more over the next few turns. Turn `routeMainModel` on once you have looked at your own sessions:

```sh
printf '{"routeMainModel":"true"}' | claude plugin configure jev-model-router@cockpit --values-stdin
```

### Shadow log and auto-tune

`/jev-shadow` and `/jev-dashboard` (see [Cockpit commands](#cockpit-commands)) start empty and fill as you work. Behind them, a **shadow log** spot-checks a sample of prompts (all the ones Jev is unsure about, plus about one in ten of the rest) against Opus in the background, at most 6 calls an hour. It never changes a routing decision or delays a turn. **Auto-tune** uses that log to nudge the "unsure" floor by 0.05 at most once a day and rolls it back if escalations jump. The full details, every option and the privacy notes are in [plugins/jev-model-router/README.md](plugins/jev-model-router/README.md).

## Cockpit commands

| Command | What it does |
|---|---|
| `/deck` | Collapse or expand Deck |
| `/deck always on\|off` | Open expanded in every new session (default on) |
| `/deck cache 1h\|5m` | Prompt-cache lifetime for the Cache row (1h subscription, 5m API key) |
| `/deck <row> on\|off` | Show or hide a row: `plans agents context limits spend cache route pet clock weather` |
| `/deck cost on` | Also track spend per day and month |
| `/deck quiet on\|off` | Hide or show the router's own log lines (Deck already shows the route) |
| `/deck status` | Print everything Deck shows |
| `/jev-shadow` | Shows how often Opus agreed with Jev, by Jev's confidence level, plus the confidence floor in force and the last tuning changes. Reads saved data only and calls no model. |
| `/jev-dashboard` | Writes a local HTML page of the router's daily numbers and opens it in your browser. `/jev-dashboard no-open` writes it without opening. |
| `/next 1`, `/next 2`, `/next 3` | Desktop app: put that next-step suggestion in the prompt box as an editable draft (the terminal uses the 1, 2, 3 and 0 keys instead) |

More Deck commands are in [plugins/deck/README.md](plugins/deck/README.md). Spend is API-equivalent dollars; on a subscription it is not a bill.

## Modifications

Deck, next-steps and the Jev router are other people's work, changed for this bundle. What changed in each is listed in its own README:

- [Deck modifications](plugins/deck/README.md#modifications): opens expanded in every new session, new Spend and Cache rows.
- [next-steps modifications](plugins/next-steps/README.md#modifications): suggestions drawn in their own panel above Deck.
- [Jev router](plugins/jev-model-router/README.md#credits): the original template plus the unsure floor, shadow log, commands, auto-tune and cache-aware switching.

## Credits and licences

Built on work by nvr0x5 (Deck), Thariq Shihipar (next-steps) and Daniel Ávila (jev-model-router), with changes described in [CREDITS.md](CREDITS.md). Each plugin keeps its own licence.
