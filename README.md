# cockpit

A panel above the Claude Code prompt that shows what is going on, plus suggested next steps, plus smart model routing. One install.

- **Deck**: context window, 5-hour and 7-day limits with reset countdowns, this session's **spend**, the **prompt-cache timer** with the cost of a cold re-write, and the model route. Opens expanded in every new session.
- **Next steps**: up to three suggested next prompts in a panel of their own above Deck. Press 1, 2 or 3 to draft one, 0 to dismiss.
- **Jev model router**: picks the model and reasoning effort for each task using [TypeSafe's Jev](https://typesafe.ai), and Deck shows each decision live.

![The cockpit panel in Claude Code Desktop: model route, context, 5h and 7d limits, session spend and the prompt-cache timer, with next-step suggestions beneath](docs/panel.png)

*Deck in Claude Code Desktop: the Jev model route, context, 5-hour and 7-day limits, this session's spend, and the prompt-cache timer with the cost of a cold re-write. The next-step suggestions sit in their own panel above it.*

Works in Claude Code Desktop and the terminal. Needs Claude Code 2.1.287 or later.

## Install

```
/plugin marketplace add kevinCodeSavvy/cockpit
/plugin install cockpit@cockpit
```

Restart Claude Code (or run `/reload-plugins`). Installing `cockpit` pulls in `deck`, `next-steps` and `jev-model-router` as dependencies. You can also install any one of them on its own: `/plugin install deck@cockpit`.

## Add your TypeSafe key (optional)

Model routing works with no key, using Claude Code's built-in classifier, and nothing leaves your machine. With a TypeSafe key you get Jev's calibrated confidence.

1. Create a key in your TypeSafe account.
2. Open the plugin's settings (`/plugin`, then **jev-model-router**, then configure) and paste it into **TypeSafe API key**. The field is stored as sensitive.
3. Leave **Backend** on `auto`; it picks TypeSafe when a key is set.

With a key, prompt text is sent to TypeSafe to classify it. Never put your key in a file you commit.

By default the router changes only subagent models and your main chat's effort. See `plugins/jev-model-router/README.md` for switching the main model too, and why that can cost more than it saves.

## Commands

| Command | What it does |
|---|---|
| `/deck` | Collapse or expand |
| `/deck always on\|off` | Open expanded in every new session (default on) |
| `/deck cache 1h\|5m` | Prompt-cache lifetime for the Cache row (1h subscription, 5m API key) |
| `/deck <row> on\|off` | Show or hide a row: `plans agents context limits spend cache route pet clock weather` |
| `/deck cost on` | Also track spend per day and month |
| `/deck status` | Print everything Deck shows |

More in `plugins/deck/README.md`. Spend is API-equivalent dollars; on a subscription it is not a bill.

## Credits and licences

Built on work by nvr0x5 (Deck), Thariq Shihipar (next-steps) and Daniel Ávila (jev-model-router), with changes described in [CREDITS.md](CREDITS.md). Each plugin keeps its own licence.
