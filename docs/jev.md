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

The page's own title is "How is Jev doing?". Sections appear in this order:

| Section | What it tells you |
|---|---|
| **What is this?** | A short box explaining that Jev picks how strong a model each prompt gets, and that Opus sometimes picks too as a check. |
| **Banner (headline)** | One sentence: Jev and Opus agree more often now, less often now, about as often as before, or "Too early to tell." It compares the older half of checked prompts with the newer half, and needs 20 or more checked prompts and a 5-point change to say anything but "about as often". More agreement is not proof Jev improved. |
| **What happened today** | Plain counts: prompts Jev looked at, how many it was not sure about (sent to Opus), how many Opus double-checked and how often it agreed. Also where the "not sure" line sits now and whether it was tuned. |
| **Day by day: how often Opus agreed with Jev** | A line graph, one dot per day (hover for counts). A rising line means they agree more often. Needs two days with checks. |
| **Day by day: how sure Jev said it was** | A line graph of Jev's average stated confidence per day. That is its own claim, not a score of whether it was right. A dashed orange line marks each day the "not sure" line moved. Needs two days with prompts. |
| **How often does the costly model get used?** | The share of prompts sent to Opus because Jev was unsure, over the busy days. If the line has moved, it gives the share up to and including the day of the last move and the share since (with "too few days to be sure" under seven days). It counts prompts, not dollars. |
| **Does Jev know when it is right?** | A table of double-checked prompts by Jev's confidence band ("Under 30% sure" up to "90% or more sure", plus "No confidence given"), with the count and a bar for how often Opus agreed. Healthy means the more sure Jev is, the longer the bar. |
| **Every day** | The last 14 UTC days with activity: prompts, how many Jev was not sure about, how many Opus double-checked, the share Opus agreed with, and any change to the "not sure" line. Days with no activity are hidden and counted. |
| **Does Jev learn from this?** | A plain "No". Only the router's own "not sure" line adjusts itself, at most once a day, and that changes which prompts go to Opus, not what Jev picks. It also says what the line last did and why. |
| **Words used on this page** | A glossary, open by default. |
| **Times the router changed your model** (collapsed) | The title shows the switched and kept counts. Lists the newest 15 judged switches: when, the move, chat size, whether it switched or kept the current model, and why. |
| **Times the "not sure" line was moved** (collapsed) | The last ten changes to the line. |
| **Small print** (collapsed) | The page keeps only the newest 300 double-checks, so older days can look thin, and prompt counts only cover prompts where Jev reported a confidence. |

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
