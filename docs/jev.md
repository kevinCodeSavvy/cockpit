# How Jev routing, the shadow log and the dashboard work

The [README](../README.md) says what Jev does in a sentence. This page explains the loop behind it, what `/jev-dashboard` shows, and what each command does. Every option and default is in the [jev-model-router README](../plugins/jev-model-router/README.md); setup is in the [guide](guide.md#set-up-jev-model-routing).

## The loop in one picture

```
 your prompt
     │
     ▼
 1. DECIDE    Jev rates the task: tier, effort, risk (+ how sure it is)
     │        the router sets effort and, for subagents, the model
     ▼
 2. CHECK     unsure prompts, and ~1 in 10 of the rest, are also
     │        put to Opus in the background (max 6 an hour)
     ▼
 3. RECORD    both answers go into the shadow log (newest 300 kept)
     │
     ▼
 4. TUNE      once per session, the router may nudge ONE number,
     │        the "unsure" line, by 0.05 (never more than once a day)
     ▼
 5. GUARD     if escalations to Opus jump after a move, the move is undone
```

## What "self-improving" means here, and what it does not

**Jev does not learn.** It is TypeSafe's model and this router never trains it. The only thing that adjusts itself is the router's own **"not sure" line** (`unsureBelow`, 0.3 by default): when Jev's confidence on a task falls under it, the task goes to the deep tier with `high` effort instead of staying where it was.

Auto-tune moves that line using the shadow log, and only that line:

- **Raise it by 0.05** when Opus rated more than 40% of at least 30 answers just *above* the line at a higher tier than Jev did. Those tasks stayed on a cheaper model and probably needed more.
- **Lower it by 0.05** when Opus wanted the deep tier for under 30% of at least 30 answers just *below* the line. Those tasks went to Opus for nothing.

Guards: the line stays between 0.15 and 0.50, moves are at least a day apart, a line you set to 0 is never touched, and every move is logged with the numbers behind it. **Rollback:** if the share of prompts escalated as unsure over the last two days is more than 1.5 times the share over the seven days before it (with enough prompts to judge), the tuned value is dropped, your configured one returns, and tuning pauses for seven days.

What it cannot do: the log does not record which model a turn ran on, so the upgrade and downgrade confidence bars are not tuned. And Opus is the only teacher, so the result is agreement with Opus, not proof that a cheaper model would have failed.

## The dashboard

`/jev-dashboard` writes one self-contained page to `~/.claude/jev-model-router/dashboard.html` (no scripts, no network, no prompt text) and opens it. It is a **snapshot**: the page only changes when you run the command again.

| Section | What it tells you |
|---|---|
| **How is Jev doing?** | Whether Jev and Opus agree more, less or about as often as before. It compares the older half of checked prompts with the newer half, and needs 20 or more checked prompts and a 5-point change to say anything. More agreement is not proof Jev improved. |
| **Agreement graph** | Per day, the share of checked prompts where Opus agreed with Jev. Needs two days with checks. |
| **How sure Jev said it was** | Per day, Jev's average stated confidence. That is its own claim, not a score of whether it was right. A dashed orange marker shows each day the "not sure" line moved. |
| **What happened today** | Plain counts, and where the "not sure" line sits now. |
| **How often is the costly model used?** | The share of prompts sent to Opus because Jev was unsure, before and after the last move of the line. Prompts, not dollars. |
| **Does Jev know when it is right?** | Checked prompts grouped by Jev's confidence, with how often Opus agreed in each band. |
| **Every day** | The last 14 days with activity: unsure, double-checked, share agreed, any change to the line. |
| **Does Jev learn from this?** | A plain "no", plus what the line last did and why. |
| **Collapsed sections** | The newest 15 model switches (with chat size) and the last ten changes to the line. |

Counts come from per-day counters and the shadow log, which keeps only the newest 300 records, so older days can be partial.

## Commands

Jev registers two commands. They read saved data and never change routing.

| Command | What it does |
|---|---|
| `/jev-dashboard` | Writes the dashboard page and opens it in your browser (`open` on macOS, `xdg-open` on Linux). |
| `/jev-dashboard no-open` | Writes the page without opening it. |
| `/jev-shadow` | Prints the shadow log as counts by Jev's confidence band (`<0.30`, `0.30-0.49`, `0.50-0.69`, `0.70-0.89`, `>=0.90`, `n/d`): how many records agree, disagree or got no tier from Opus, with the disagree share, then an `all` row. Also shows the "not sure" line in force and the last five tuning changes. Calls no model. |

The command is `/jev-dashboard`; there is no `/jev-dash`. Both start empty after install and fill as you work.

Related switches that live under Deck:

| Command | What it does |
|---|---|
| `/deck route on\|off` | Shows or hides the **Model route** row, which displays every decision live with Jev's confidence. |
| `/deck quiet on\|off` | Hides or shows the router's own log lines in the transcript. |

## Where to turn things off

- `autoTune`: stop the "not sure" line from moving.
- `shadowOpus`: stop all background Opus checks. The dashboard then has nothing new to show, and with it off the first 4000 characters of some prompts no longer go to Opus.
- `unsureBelow` set to `0`: turn the "not sure" escalation off entirely.

Set options with `claude plugin configure jev-model-router@cockpit`. The full list is in the [plugin README](../plugins/jev-model-router/README.md#options).
