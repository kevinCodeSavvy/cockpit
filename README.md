<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/banner-dark.svg">
    <img src="docs/assets/banner-light.svg" width="900" alt="cockpit: a panel above your Claude Code prompt">
  </picture>
</p>

<p align="center">
  <b>See what Claude is doing, what it costs, and when your limits run out,<br>without leaving the prompt.</b>
</p>

<p align="center">
  <a href="https://github.com/kevinCodeSavvy/cockpit/releases"><img src="https://img.shields.io/github/v/release/kevinCodeSavvy/cockpit?label=release&color=7dd3fc" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/Claude_Code-2.1.287%2B-a78bfa" alt="Claude Code 2.1.287 or later">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
</p>

<p align="center">
  <a href="#install">Install</a> · <a href="#whats-inside">What's inside</a> · <a href="docs/guide.md">Guide</a> · <a href="https://github.com/kevinCodeSavvy/cockpit/releases">Releases</a>
</p>

<p align="center">
  <img src="docs/assets/panel.svg" width="900" alt="Animation: the cockpit panel in Claude Code Desktop. Three suggested next prompts sit above Deck, which shows the model route, context, 5-hour and 7-day limits, spend and a prompt-cache bar that drains while the route changes from a low-effort decision to a high-effort one">
</p>

## Why

cockpit puts three small tools above the prompt: **Deck** (the panel), **next-steps** and the **Jev model router**. One install.

| When… | Without it | With cockpit |
|---|---|---|
| the prompt cache is about to go cold | The next reply quietly costs more | The Cache row turns red in the last minute, with the cost of a re-write |
| your usage is climbing | You find out at the limit | The row says when you'll hit it, if that comes before the reset |
| one task is a typo and the next is a migration | Every task gets the same effort | Jev picks the reasoning effort for each task and shows how sure it was |
| a reply ends and you're not sure what to ask next | You think of the next prompt yourself | Up to three suggestions; press 1, 2 or 3 to draft one |

## Install

```
/plugin marketplace add kevinCodeSavvy/cockpit
/plugin install cockpit@cockpit
```

Restart Claude Code (or run `/reload-plugins`), then run `/deck demo` to see a sample panel.

> [!NOTE]
> Needs Claude Code 2.1.287 or later. Works in Claude Code Desktop and the terminal. Model routing works with no key, using Claude Code's built-in classifier; a TypeSafe key adds Jev's confidence score (see the [guide](docs/guide.md#set-up-jev-model-routing)).

Update with `claude plugin update cockpit@cockpit`.

## What's inside

### Warns before the cache goes cold

<img src="docs/assets/cache.svg" width="900" alt="Animation: the Cache row drains over five minutes, green while warm, amber as it runs low, then red in the last minute reading 55s, rewrite about $0.50, with the countdown beside it">

In the last minute the row turns red and shows what a cold re-write would cost. Send any message to warm it again.

### Tells you when you'll hit a limit

<img src="docs/assets/forecast.svg" width="900" alt="Animation: the 5-hour limit row shows percent used and a reset countdown, then once the pace would hit the limit before the reset it shows a warning with the hit time, 3:50pm, and later 2:50pm as usage keeps rising, with the bar turning amber then red">

If your pace would reach the 5-hour or 7-day limit before it resets, the hit time replaces the reset countdown. It's an estimate, and needs about five minutes of rising usage.

### Picks the effort for each task

<img src="docs/assets/route.svg" width="900" alt="Animation: the Model route row for three prompts. A typo fix gets low effort and a haiku suggestion that is not applied, a question gets medium effort, and a risky database migration gets extra high effort with a risk flag. Each decision adds a square to the history">

[Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev) judges each prompt and sets the reasoning effort. Subagents get a model to match. Your main chat's model is only switched if you turn on `routeMainModel`, because switching mid-session throws away the cache.

### Suggests what to do next

<img src="docs/assets/next.svg" width="900" alt="Animation: after a reply, a box lists up to three suggested next prompts. Pressing 2 highlights that suggestion and puts it in the prompt box as an editable draft with a blinking cursor">

Up to three ideas after each reply. In the terminal press <kbd>1</kbd>, <kbd>2</kbd> or <kbd>3</kbd>; in Desktop run `/next 1`, `/next 2` or `/next 3`. <kbd>0</kbd> dismisses.

Deck also shows context, spend and the pet, in six bar styles. See the [guide](docs/guide.md#bar-styles).

## Settings

Show or hide rows and change the look with `/deck` commands, for example `/deck style`, `/deck cache 5m` or `/deck collapsed rings`. Every command is in the [guide](docs/guide.md#cockpit-commands).

## Cost and privacy

- **Local by default.** With no key, nothing leaves your machine.
- **With a TypeSafe key,** the text of each prompt is sent to `api.typesafe.ai` to be classified. Saved logs keep only a redacted 200-character summary.
- **Your key stays private.** You enter it at a hidden prompt, and Claude Code stores it as a sensitive value.
- **Spend is API-equivalent dollars.** On a subscription it isn't a bill.

## Documentation

- [Guide](docs/guide.md): first run, Jev setup, bar styles, every command, and what changed from the originals.
- [Deck](plugins/deck/README.md), [next-steps](plugins/next-steps/README.md) and [jev-model-router](plugins/jev-model-router/README.md): each plugin in detail.
- [Credits](CREDITS.md): this bundles other people's work, with changes.

## License

[MIT](LICENSE). Each bundled plugin keeps its own licence. This project is independent and not made or endorsed by Anthropic or TypeSafe.
