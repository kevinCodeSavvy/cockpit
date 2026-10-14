# next-steps

After each turn, suggests up to three next prompts above the input box.

```
next:
  1: run the tests you just wrote
  2: do the same for the settings page
  3: /code-review high
  0: dismiss
```

Press `1`, `2` or `3` from an empty prompt box (or click one) and that prompt is written into the box as a draft. Edit it, then press Enter yourself. `0` dismisses. The top suggestion also shows as the box's dim ghost text, so Tab takes it.

The plugin never submits a prompt on its own.

## How it works

It is a function-hooks plugin (`hooks/register.tsx`):

- `turn.complete`: forks the session with `$.model.fork` to ask for likely next prompts. The fork shares the session's prompt cache, so it costs about one short reply.
- `$.command.list`: the session's skills and slash commands (plugin, user and MCP ones with their descriptions) go into the fork's question, so a suggestion can be `/skill arguments`. A suggestion that names a command the session does not have is dropped.
- `ui.render` on `AbovePrompt`: draws the suggestions as buttons.
- A press calls `$.prompt.fill`; the top suggestion goes to `$.prompt.suggest`.
- `turn.start`: hides the suggestions.

Suggestions draw above the prompt in the terminal. Where the session also draws on another surface (the desktop app), with `transcriptNotice` on they are also written to the transcript as a notice, one row per suggestion.

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `minAnswerChars` | `80` | Skip suggestions after answers shorter than this |
| `suggestSkills` | `true` | Tell the suggester which skills and slash commands the session has |
| `transcriptNotice` | `false` | On the desktop app, also write the suggestions into the chat as `/next N` notice lines |

## In the desktop app

The desktop app draws no buttons, so the suggestions appear as notice rows (`/next 1`, `/next 2`, ...). Type `/next 2` and suggestion 2 is written into the prompt box as a draft; edit it, then press Enter.

## Install

```
/plugin install next-steps --marketplace kevinCodeSavvy/cockpit
```
