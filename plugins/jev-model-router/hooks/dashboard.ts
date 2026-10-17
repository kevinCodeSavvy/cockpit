/**
 * jev-model-router — the `/jev-dashboard` page.
 *
 * Pure: takes what the router keeps in `$.store` and returns one
 * self-contained HTML file (inline CSS, no scripts, no network). It leads with
 * one plain verdict (does Jev agree with Opus, and is that improving?), then
 * today's four numbers, then how often Jev is right at each confidence level.
 *
 * It shows counts and generated sentences only, never a prompt.
 */
import { countByConfidence, SHADOW_CAP } from './shadow.ts'
import type { ShadowRecord } from './shadow.ts'
import { summarizeSwitches } from './switchlog.ts'
import type { SwitchRecord } from './switchlog.ts'
import { DAY, dayKey, describeEntry, effectiveFloor } from './tune.ts'
import type { AuditEntry, Stats, TuneState } from './tune.ts'

export interface DashboardInput {
  now: number
  /** `unsureBelow` as configured. */
  configured: number
  autoTune: boolean
  state: TuneState
  trail: readonly AuditEntry[]
  stats: Stats
  log: readonly ShadowRecord[]
  /** Main-loop switch decisions, oldest first. */
  switches?: readonly SwitchRecord[]
}

export interface DayRow {
  /** `YYYY-MM-DD`, UTC. */
  date: string
  prompts: number
  /** Mean tier confidence of the day's counted prompts, or null when none was kept. */
  avgConfidence: number | null
  /** Prompts that went to Opus as unsure. */
  escalated: number
  shadow: number
  agree: number
  disagree: number
  noTier: number
  /** The day's floor moves, e.g. `raise 0.30 → 0.35`. */
  moves: string[]
}

export const DASHBOARD_DAYS = 14
/** Switch decisions listed on the page. */
export const SWITCH_ROWS = 15

/** Text made safe to place inside HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** One row per day, newest first, from the counters, the shadow log and the audit trail. */
export function dayRows(input: DashboardInput, days: number = DASHBOARD_DAYS): DayRow[] {
  const today = Math.floor(input.now / DAY)
  const rows: DayRow[] = []
  for (let back = 0; back < days; back++) {
    const day = today - back
    const key = String(day)
    const counted = input.stats[key]
    const row: DayRow = {
      date: new Date(day * DAY).toISOString().slice(0, 10),
      prompts: counted?.prompts ?? 0,
      avgConfidence:
        counted?.confSum !== undefined && counted.confN ? counted.confSum / counted.confN : null,
      escalated: counted?.unsure ?? 0,
      shadow: 0,
      agree: 0,
      disagree: 0,
      noTier: 0,
      moves: [],
    }
    for (const record of input.log) {
      if (dayKey(record.at) !== key) continue
      row.shadow += 1
      if (record.agree === null) row.noTier += 1
      else if (record.agree) row.agree += 1
      else row.disagree += 1
    }
    for (const entry of input.trail) {
      if (dayKey(entry.at) !== key) continue
      row.moves.push(
        entry.action === 'rollback'
          ? `rollback ${entry.from.toFixed(2)} → ${entry.to.toFixed(2)}`
          : `${entry.action} ${entry.from.toFixed(2)} → ${entry.to.toFixed(2)}`,
      )
    }
    rows.push(row)
  }
  return rows
}

const share = (part: number, whole: number): string =>
  whole === 0 ? '–' : `${Math.round((100 * part) / whole)}%`

const pct = (value: number): string => `${Math.round(100 * value)}%`

/** Plain names for the confidence buckets. */
const BUCKET_NAMES: Record<string, string> = {
  '<0.30': 'Under 30% sure',
  '0.30-0.49': '30–49% sure',
  '0.50-0.69': '50–69% sure',
  '0.70-0.89': '70–89% sure',
  '>=0.90': '90% or more sure',
  'n/d': 'No confidence given',
}

/** Share of compared records where Jev and Opus picked the same tier, or null when none was compared. */
function agreeRate(records: readonly ShadowRecord[]): number | null {
  const compared = records.filter((r) => r.agree !== null)
  return compared.length === 0 ? null : compared.filter((r) => r.agree).length / compared.length
}

/** Fewest compared records worth calling a trend. */
const TREND_MIN = 20

/** The older half of the shadow log against the newer half, or null when there is too little to compare. */
export function trendOf(log: readonly ShadowRecord[]): { older: number; newer: number } | null {
  const compared = log.filter((r) => r.agree !== null).sort((a, b) => a.at - b.at)
  if (compared.length < TREND_MIN) return null
  const mid = Math.floor(compared.length / 2)
  return { older: agreeRate(compared.slice(0, mid)) as number, newer: agreeRate(compared.slice(mid)) as number }
}

/** The sentences at the top of the page. */
function verdict(log: readonly ShadowRecord[]): string[] {
  const compared = log.filter((r) => r.agree !== null)
  const overall = agreeRate(log)
  if (overall === null) return ['Not enough checks yet. Opus double-checks some answers as you work; the verdict appears once it has.']
  const lines = [`Jev picked the same tier as Opus on <b>${pct(overall)}</b> of ${compared.length} checked prompts.`]

  const sure = agreeRate(log.filter((r) => (r.jev.confidence ?? 0) >= 0.7))
  const unsure = agreeRate(log.filter((r) => r.jev.confidence !== null && r.jev.confidence < 0.5))
  if (sure !== null && unsure !== null) {
    const worthTrusting = sure - unsure >= 0.15
    lines.push(
      `When Jev was 70% sure or more it agreed <b>${pct(sure)}</b> of the time; when it was under 50% sure, <b>${pct(unsure)}</b>. ${
        worthTrusting
          ? 'Its confidence is a useful signal: the surer it is, the more often it is right.'
          : 'Its confidence is not telling right from wrong yet.'
      }`,
    )
  }

  const trend = trendOf(log)
  if (trend === null) {
    lines.push(`Is it improving? Too early to say; this needs ${TREND_MIN} or more checked prompts.`)
  } else {
    const diff = Math.round(100 * (trend.newer - trend.older))
    const word = diff >= 5 ? 'getting better' : diff <= -5 ? 'getting worse' : 'about the same'
    lines.push(
      `Is it improving? Older half of the checks: ${pct(trend.older)} agreed. Newer half: ${pct(trend.newer)}. So it is <b>${word}</b>.`,
    )
  }
  return lines
}

/** Chart size and margins, in SVG units. */
const CHART = { w: 640, h: 180, left: 40, right: 16, top: 12, bottom: 28 }

/**
 * Daily agreement with Opus as an inline SVG line, oldest day on the left, or
 * a one-line note when fewer than two days have checks. A line rising means
 * Jev is improving. Each point's tooltip gives its day and counts.
 */
export function agreementChart(rows: readonly DayRow[]): string {
  const days = rows
    .filter((r) => r.agree + r.disagree > 0)
    .reverse()
    .map((r) => ({ date: r.date, agree: r.agree, total: r.agree + r.disagree }))
  if (days.length < 2) {
    return '<p class="sub">The line appears once two different days have checked prompts.</p>'
  }
  const { w, h, left, right, top, bottom } = CHART
  const x = (i: number) => left + ((w - left - right) * i) / (days.length - 1)
  const y = (rate: number) => top + (h - top - bottom) * (1 - rate)
  const points = days.map((d, i) => ({ ...d, cx: x(i), cy: y(d.agree / d.total) }))
  const grid = [0, 0.5, 1]
    .map(
      (g) =>
        `<line x1="${left}" x2="${w - right}" y1="${y(g)}" y2="${y(g)}" class="grid"/><text x="${left - 6}" y="${y(g) + 4}" text-anchor="end" class="axis">${Math.round(100 * g)}%</text>`,
    )
    .join('')
  const ends = [points[0], points[points.length - 1]] as const
  const labels = ends
    .map(
      (p, i) =>
        `<text x="${p.cx}" y="${h - 8}" text-anchor="${i === 0 ? 'start' : 'end'}" class="axis">${p.date.slice(5)}</text>`,
    )
    .join('')
  const dots = points
    .map(
      (p) =>
        `<circle cx="${p.cx}" cy="${p.cy}" r="4" class="dot"><title>${p.date}: ${share(p.agree, p.total)} agreed (${p.agree} of ${p.total})</title></circle>`,
    )
    .join('')
  const line = points.map((p) => `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ')
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Share of checked prompts where Opus agreed with Jev, by day">${grid}<polyline points="${line}" class="line"/>${dots}${labels}</svg>`
}

const CSS = `
:root{--bg:#fafaf7;--card:#fff;--ink:#1d1d1b;--dim:#6b6b66;--line:#e3e2dc;--blue:#2a6fdb;--amber:#b7791f;--bar:#cfe0fb}
@media (prefers-color-scheme:dark){:root{--bg:#161614;--card:#1f1f1c;--ink:#ecebe6;--dim:#9a9990;--line:#33332f;--blue:#6ea4f5;--amber:#e0a84a;--bar:#27406b}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:32px 0 4px}
.sub{color:var(--dim);font-size:13px;margin:0 0 8px}
.verdict{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--blue);border-radius:10px;padding:14px 16px;margin-top:20px}
.verdict p{margin:0 0 6px}.verdict p:last-child{margin:0}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}
.big{font-size:26px;font-weight:600;line-height:1.2}
.lbl{font-size:13px;margin-top:2px}.note{font-size:12px;color:var(--dim);margin-top:4px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:13px}
th,td{padding:7px 10px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}
th{font-weight:600;color:var(--dim);font-size:12px}th:first-child,td:first-child{text-align:left}
tr:last-child td{border-bottom:0}td.z{color:var(--dim)}td.moves{text-align:left;white-space:normal;color:var(--dim)}td.kept{color:var(--amber);font-weight:600}td.ok{color:var(--blue)}
.bar{display:inline-block;height:8px;background:var(--bar);border-radius:3px;vertical-align:middle;margin-left:6px}
.wrap{overflow-x:auto}
ul{margin:6px 0;padding-left:20px;font-size:13px}li{margin:3px 0}
.chart{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-top:16px}.chart svg{width:100%;height:auto;display:block}.line{fill:none;stroke:var(--blue);stroke-width:2.5}.dot{fill:var(--blue)}.grid{stroke:var(--line)}.axis{fill:var(--dim);font-size:11px}
details{margin-top:28px}summary{cursor:pointer;font-size:16px;font-weight:600}
@media (max-width:760px){.cards{grid-template-columns:1fr 1fr}}
`

/** A percentage with a bar as long as the percentage. */
function rateCell(agree: number, disagree: number): string {
  const total = agree + disagree
  if (total === 0) return '<td class="z">–</td>'
  const width = Math.round((80 * agree) / total)
  return `<td>${share(agree, total)}<span class="bar" style="width:${width}px"></span></td>`
}

/** The whole page. */
export function buildDashboard(input: DashboardInput): string {
  const rows = dayRows(input)
  const today = rows[0] as DayRow
  const floor = effectiveFloor(input.configured, input.state, input.autoTune)
  const frozen = input.now < input.state.frozenUntil
  const tuned = input.autoTune && input.configured > 0 && input.state.value !== null

  const floorNote = !input.autoTune
    ? 'auto-tune off'
    : input.configured <= 0
      ? 'floor off, nothing to tune'
      : frozen
        ? `frozen until ${new Date(input.state.frozenUntil).toISOString().slice(0, 10)}`
        : tuned
          ? `tuned; configured ${input.configured.toFixed(2)}`
          : 'as configured, not tuned'

  const busy = rows.filter((r) => r.prompts > 0 || r.shadow > 0)
  const quiet = rows.length - busy.length
  const dayTable = busy
    .map(
      (r) =>
        `<tr><td>${r.date}</td><td>${r.prompts}</td><td>${r.escalated}</td><td>${r.agree + r.disagree}</td>${rateCell(
          r.agree,
          r.disagree,
        )}<td class="moves">${escapeHtml(r.moves.join(', '))}</td></tr>`,
    )
    .join('\n')

  const buckets = countByConfidence(input.log)
    .filter((b) => b.agree + b.disagree > 0)
    .map(
      (b) =>
        `<tr><td>${escapeHtml(BUCKET_NAMES[b.bucket] ?? b.bucket)}</td><td>${b.agree + b.disagree}</td>${rateCell(
          b.agree,
          b.disagree,
        )}</tr>`,
    )
    .join('\n')

  const trail = input.trail.slice(-10).reverse()
  const trailList =
    trail.length === 0
      ? '<li>No tuning changes yet.</li>'
      : trail.map((entry) => `<li>${escapeHtml(describeEntry(entry))}</li>`).join('\n')

  const switches = input.switches ?? []
  const counts = summarizeSwitches(switches)
  const switchRows = switches
    .slice(-SWITCH_ROWS)
    .reverse()
    .map(
      (r) =>
        `<tr><td>${new Date(r.at).toISOString().slice(5, 16).replace('T', ' ')}</td><td>${r.from} → ${r.to}</td><td class="${
          r.allowed ? 'ok' : 'kept'
        }">${r.allowed ? 'switched' : 'kept ' + r.from}</td><td class="moves">${escapeHtml(r.reason || 'cache check off')}</td></tr>`,
    )
    .join('\n')

  const generated = new Date(input.now).toISOString().slice(0, 16).replace('T', ' ')
  const todayRate = share(today.agree, today.agree + today.disagree)

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jev Router Stats</title><style>${CSS}</style></head>
<body><main>
<h1>Is Jev getting it right?</h1>
<p class="sub">Snapshot at ${generated} UTC. Type /jev-dashboard again to refresh. Days are UTC.</p>

<div class="verdict">
${verdict(input.log)
  .map((line) => `<p>${line}</p>`)
  .join('\n')}
</div>

<div class="chart">
<div class="lbl">Share of checked prompts where Opus agreed with Jev, by day. Going up means Jev is improving.</div>
${agreementChart(rows)}
</div>

<div class="cards">
<div class="card"><div class="big">${today.prompts}</div><div class="lbl">prompts today</div><div class="note">${
    today.avgConfidence === null ? 'no confidence reported' : `Jev was ${pct(today.avgConfidence)} sure on average`
  }</div></div>
<div class="card"><div class="big">${todayRate}</div><div class="lbl">Jev matched Opus today</div><div class="note">${today.agree} of ${
    today.agree + today.disagree
  } checked</div></div>
<div class="card"><div class="big">${today.escalated}</div><div class="lbl">sent to Opus as unsure</div><div class="note">${share(
    today.escalated,
    today.prompts,
  )} of today's prompts</div></div>
<div class="card"><div class="big">${floor.toFixed(2)}</div><div class="lbl">unsure cutoff</div><div class="note">below this Jev's answer goes to Opus; ${escapeHtml(
    floorNote,
  )}</div></div>
</div>

<h2>Is Jev right when it is sure?</h2>
<p class="sub">Each row groups checked prompts by how sure Jev said it was. A good Jev agrees more often further down.</p>
<div class="wrap"><table>
<tr><th>Jev said</th><th>Checked</th><th>Opus agreed</th></tr>
${buckets || '<tr><td colspan="3">No shadow records yet.</td></tr>'}
</table></div>

<h2>Day by day</h2>
<p class="sub">${quiet > 0 ? `${quiet} of the last ${DASHBOARD_DAYS} days had no activity and are hidden.` : `Last ${DASHBOARD_DAYS} days.`}</p>
<div class="wrap"><table>
<tr><th>Day</th><th>Prompts</th><th>Sent to Opus as unsure</th><th>Checked</th><th>Opus agreed</th><th>Cutoff changes</th></tr>
${dayTable || '<tr><td colspan="6">No activity yet.</td></tr>'}
</table></div>

<details>
<summary>Model switches (${counts.allowed} switched, ${counts.kept} kept)</summary>
<p class="sub">${switches.length === 0 ? 'None recorded yet.' : `Newest ${Math.min(SWITCH_ROWS, switches.length)} shown. "Kept" means switching would have cost more once the cold cache was counted.`}</p>
<div class="wrap"><table>
<tr><th>When (UTC)</th><th>Move</th><th>Result</th><th>Why</th></tr>
${switchRows || '<tr><td colspan="4">No main-loop switch has been judged yet.</td></tr>'}
</table></div>
</details>

<details>
<summary>Cutoff changes</summary>
<ul>
${trailList}
</ul>
</details>

<details>
<summary>How to read this</summary>
<ul>
<li>"Opus agreed" means Opus picked the same tier Jev did. It is a second opinion, not proof a cheaper model would have failed.</li>
<li>Opus checks every unsure prompt (up to the hourly cap) and a sample of the rest. The log keeps the newest ${SHADOW_CAP} checks, so older days can be partial.</li>
<li>Prompt counts only cover prompts where Jev reported a confidence.</li>
</ul>
</details>
</main></body></html>
`
}
