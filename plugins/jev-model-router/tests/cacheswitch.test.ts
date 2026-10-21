import { describe, expect, mock, test, tier } from 'claude-code/testing'
import type { On, SessionStartInput } from 'claude-code'
import type { Engine } from 'claude-code/testing'

tier('user')

const NOW = 5_000_000
const session: SessionStartInput = { surface: null, isInteractive: false, cwd: '/work' }
const options = { typesafeApiKey: 'test-key', shadowOpus: false, routeMainModel: true, routeMainEffort: false }

/** Jev answering with a tier it is sure of: 'fast' makes the router want Haiku, 'balanced' keeps Sonnet. */
const answer = (choice: 'fast' | 'balanced') =>
  JSON.stringify({
    model: 'jev-1.13',
    answers: {
    tier: { type: 'choice', choice, confidence: 0.95, probabilities: { [choice]: 0.95 } },
    effort: { type: 'score', score: 0.5, confidence: 0.8 },
    risky: { type: 'noul', noul: 0.01 },
    },
  })

function world(on: On, stored: Map<string, unknown> = new Map()) {
  const logs: string[] = []
  const sent: string[] = []
  const jev = { choice: 'fast' as 'fast' | 'balanced' }
  // What `$.session.usage()` reports: tokens undefined is a session that has not measured yet.
  const sessionUsage: { tokens: number | undefined; fail: boolean; calls: number } = { tokens: undefined, fail: false, calls: 0 }
  // What `$.session.compact()` does: the mock stands in for the engine's compaction.
  const compact: { mode: 'ok' | 'throw' | 'skip'; tokensAfter: number | undefined; calls: number; instructions: (string | undefined)[] } = {
    mode: 'ok',
    tokensAfter: 20_000,
    calls: 0,
    instructions: [],
  }
  const usage: { next: { cache_creation_input_tokens: number; cache_read_input_tokens: number } | null } = { next: null }
  mock.clock(on, { now: NOW })
  on('store.get', ($, e) => ({ value: stored.get(e.key) }))
  on('store.set', ($, e) => {
    stored.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.log', ($, e) => {
    logs.push(e.text)
    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: answer(jev.choice) } }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('session.measure', () => ({ changed: [] }))
  on('session.compact', ($, e) => {
    compact.calls++
    compact.instructions.push(e.instructions)
    if (compact.mode === 'throw') throw new Error('compaction unavailable')
    if (compact.mode === 'skip') return { skip: 'a hook vetoed it' }
    return { messages: [{ role: 'user', text: 'summary of the conversation', toolUses: [] }], tokensBefore: 184_000, tokensAfter: compact.tokensAfter }
  })
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('session.usage', () => {
    sessionUsage.calls++
    if (sessionUsage.fail) throw new Error('usage unavailable')
    return { value: { startedAt: 0, context: { window: 1_000_000, tokens: sessionUsage.tokens }, rateLimits: [] } }
  })
  on('turn.step', async function* ($, e) {
    sent.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: usage.next ? { input_tokens: 10, output_tokens: 20, model: e.model, ...usage.next } : null }
  })
  return { logs, sent, jev, usage, sessionUsage, compact }
}

async function turn($: Engine, id: string, model: string, tokens: number) {
  await $.session.measure({ context: { tokens, window: 1_000_000 }, rateLimits: [], changed: [] })
  await $.prompt.submit({ text: 'a small task', wait: false, origin: { kind: 'composer' } })
  const step = $.turn.step({ turnId: id, index: 0, model, messageCount: 4 })
  for await (const _chunk of step) {
    // drain
  }
}

/** The end of a turn, as the engine reports it once the answer is in. */
async function complete($: Engine, id: string, over: { reason?: 'answer' | 'aborted'; agentId?: string } = {}) {
  const reason = over.reason ?? 'answer'
  await $.turn.complete({
    answer: 'done',
    durationMs: 1000,
    isAborted: reason === 'aborted',
    turnId: id,
    reason,
    ...(over.agentId ? { agentId: over.agentId } : {}),
  })
}

/** A turn with no `session.measure` before it, as the first turn of a restarted session has. */
async function turnUnmeasured($: Engine, id: string, model: string) {
  await $.prompt.submit({ text: 'a small task', wait: false, origin: { kind: 'composer' } })
  const step = $.turn.step({ turnId: id, index: 0, model, messageCount: 4 })
  for await (const _chunk of step) {
    // drain
  }
}

/** One turn Jev keeps on Sonnet, so Sonnet's cache counts as warm for the next. */
async function warmSonnet($: Engine, jev: { choice: 'fast' | 'balanced' }) {
  jev.choice = 'balanced'
  await turn($, 't0', 'claude-sonnet-5-5', 184_000)
  jev.choice = 'fast'
}

describe('cache-aware main-loop switching', () => {
  test('a small context switches to Haiku as before', { options }, async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    await turn($, 't1', 'claude-sonnet-5-5', 12_000)
    expect(w.sent[0]).toContain('haiku')
  })

  test('a 184k context stays on Sonnet, and the log says why', { options }, async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    await warmSonnet($, w.jev)
    await turn($, 't2', 'claude-sonnet-5-5', 184_000)
    expect(w.sent[1]).toBe('claude-sonnet-5-5')
    expect(w.logs.some((line) => line.includes('kept balanced') && line.includes('184k context'))).toBe(true)
  })

  test('cacheAware off switches at any size', { options: { ...options, cacheAware: false } }, async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    await warmSonnet($, w.jev)
    await turn($, 't2', 'claude-sonnet-5-5', 184_000)
    expect(w.sent[1]).toContain('haiku')
  })

  test('a longer horizon makes the 184k switch pay', { options: { ...options, cacheHorizonTurns: 10, cacheLockAbove: 0 } }, async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    await warmSonnet($, w.jev)
    await turn($, 't2', 'claude-sonnet-5-5', 184_000)
    expect(w.sent[1]).toContain('haiku')
  })

  test('with nothing warm, a cold Sonnet rebuild is dearer than a cold Haiku one, so it switches', { options }, async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    await turn($, 't1', 'claude-sonnet-5-5', 184_000)
    expect(w.sent[0]).toContain('haiku')
  })

  test('each judged switch is recorded with its context, tiers and result', { options }, async ($, on) => {
    const stored = new Map<string, unknown>()
    const w = world(on, stored)
    await $.session.start(session)
    await warmSonnet($, w.jev)
    await turn($, 't2', 'claude-sonnet-5-5', 184_000)
    const log = stored.get('switch-log') as { from: string; to: string; context: number; allowed: boolean; reason: string }[]
    const last = log[log.length - 1]
    expect(last).toEqual(expect.objectContaining({ from: 'balanced', to: 'fast', context: 184_000, allowed: false }))
    expect(last?.reason).toContain('kept balanced')
  })

  test('a turn that stays on its model records nothing', { options }, async ($, on) => {
    const stored = new Map<string, unknown>()
    const w = world(on, stored)
    await $.session.start(session)
    w.jev.choice = 'balanced'
    await turn($, 't1', 'claude-sonnet-5-5', 50_000)
    expect(stored.get('switch-log')).toBeUndefined()
  })

  test('a context over the lock stays on the warm model even when switching would save', { options }, async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    await warmSonnet($, w.jev)
    await turn($, 't2', 'claude-sonnet-5-5', 60_000)
    expect(w.sent[1]).toBe('claude-sonnet-5-5')
    expect(w.logs.some((line) => line.includes('kept balanced') && line.includes('40k'))).toBe(true)
  })

  test('after a switch the next turns hold the model, then release it', { options: { ...options, cacheLockAbove: 0 } }, async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    await turn($, 't1', 'claude-sonnet-5-5', 12_000)
    for (const id of ['t2', 't3', 't4']) await turn($, id, 'claude-sonnet-5-5', 30_000)
    expect(w.sent[0]).toContain('haiku')
    expect(w.sent[1]).toBe('claude-sonnet-5-5')
    expect(w.sent[2]).toBe('claude-sonnet-5-5')
    expect(w.sent[3]).toContain('haiku')
  })

  test('cacheMinStayTurns 0 switches every turn', { options: { ...options, cacheLockAbove: 0, cacheMinStayTurns: 0 } }, async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    await turn($, 't1', 'claude-sonnet-5-5', 12_000)
    await turn($, 't2', 'claude-sonnet-5-5', 30_000)
    expect(w.sent[1]).toContain('haiku')
  })

  test('a switch is stamped with what the API wrote to the new cache', { options }, async ($, on) => {
    const stored = new Map<string, unknown>()
    const w = world(on, stored)
    w.usage.next = { cache_creation_input_tokens: 90_000, cache_read_input_tokens: 0 }
    await $.session.start(session)
    await turn($, 't1', 'claude-sonnet-5-5', 12_000)
    const log = stored.get('switch-log') as { allowed: boolean; cold: boolean; written: number | null; read: number | null }[]
    expect(log[log.length - 1]).toEqual(expect.objectContaining({ allowed: true, cold: true, written: 90_000, read: 0 }))
  })

  test('a switch whose response carries no usage keeps its estimate and no figures', { options }, async ($, on) => {
    const stored = new Map<string, unknown>()
    const w = world(on, stored)
    await $.session.start(session)
    await turn($, 't1', 'claude-sonnet-5-5', 12_000)
    const log = stored.get('switch-log') as { cold: boolean; written: number | null }[]
    expect(log[log.length - 1]).toEqual(expect.objectContaining({ cold: true, written: null }))
    expect(w.sent[0]).toContain('haiku')
  })

  test('a held switch is never measured, since the model did not change', { options }, async ($, on) => {
    const stored = new Map<string, unknown>()
    const w = world(on, stored)
    w.usage.next = { cache_creation_input_tokens: 500, cache_read_input_tokens: 183_000 }
    await $.session.start(session)
    await warmSonnet($, w.jev)
    await turn($, 't2', 'claude-sonnet-5-5', 184_000)
    const log = stored.get('switch-log') as { allowed: boolean; written: number | null }[]
    expect(log[log.length - 1]).toEqual(expect.objectContaining({ allowed: false, written: null }))
  })

  describe('a context size the router has not been told', () => {
    type Log = { allowed: boolean; context: number | null; reason: string }[]

    test('is read from the session, and the switch is judged on it', { options }, async ($, on) => {
      const stored = new Map<string, unknown>()
      const w = world(on, stored)
      w.sessionUsage.tokens = 12_000
      await $.session.start(session)
      await turnUnmeasured($, 't1', 'claude-sonnet-5-5')
      expect(w.sent[0]).toContain('haiku')
      const log = stored.get('switch-log') as Log
      expect(log[log.length - 1]).toEqual(expect.objectContaining({ allowed: true, context: 12_000 }))
    })

    test('a large one read from the session is held by the lock like a measured one', { options }, async ($, on) => {
      const stored = new Map<string, unknown>()
      const w = world(on, stored)
      w.sessionUsage.tokens = 143_000
      await $.session.start(session)
      w.jev.choice = 'balanced'
      await turnUnmeasured($, 't0', 'claude-sonnet-5-5')
      w.jev.choice = 'fast'
      await turnUnmeasured($, 't1', 'claude-sonnet-5-5')
      expect(w.sent[1]).toBe('claude-sonnet-5-5')
      const log = stored.get('switch-log') as Log
      expect(log[log.length - 1]).toEqual(expect.objectContaining({ allowed: false, context: 143_000 }))
      expect(log[log.length - 1]?.reason).toContain('143k context')
    })

    test('one the session cannot give holds the switch for a turn, and says so', { options }, async ($, on) => {
      const stored = new Map<string, unknown>()
      const w = world(on, stored)
      await $.session.start(session)
      await turnUnmeasured($, 't1', 'claude-sonnet-5-5')
      expect(w.sent[0]).toBe('claude-sonnet-5-5')
      const log = stored.get('switch-log') as Log
      expect(log[log.length - 1]).toEqual(expect.objectContaining({ allowed: false, context: null }))
      expect(log[log.length - 1]?.reason).toContain('context size unknown')
    })

    test('is held once, not for the whole session', { options }, async ($, on) => {
      const w = world(on)
      await $.session.start(session)
      await turnUnmeasured($, 't1', 'claude-sonnet-5-5')
      await turnUnmeasured($, 't2', 'claude-sonnet-5-5')
      expect(w.sent[0]).toBe('claude-sonnet-5-5')
      expect(w.sent[1]).toContain('haiku')
    })

    test('a session that fails to answer is treated as unknown, not as an error', { options }, async ($, on) => {
      const w = world(on)
      w.sessionUsage.fail = true
      await $.session.start(session)
      await turnUnmeasured($, 't1', 'claude-sonnet-5-5')
      expect(w.sent[0]).toBe('claude-sonnet-5-5')
    })

    test('a measured size is used without asking the session', { options }, async ($, on) => {
      const w = world(on)
      await $.session.start(session)
      await turn($, 't1', 'claude-sonnet-5-5', 12_000)
      expect(w.sessionUsage.calls).toBe(0)
    })

    test('cacheAware off never holds for it', { options: { ...options, cacheAware: false } }, async ($, on) => {
      const w = world(on)
      await $.session.start(session)
      await turnUnmeasured($, 't1', 'claude-sonnet-5-5')
      expect(w.sent[0]).toContain('haiku')
    })
  })

  describe('compact-then-switch', () => {
    const compactOptions = { ...options, compactBeforeSwitch: true }

    /** Sonnet is warm and the conversation is 184k; Jev then wants Haiku, which the lock refuses. */
    async function wantCheaperOnBigContext($: Engine, w: ReturnType<typeof world>, id = 't1') {
      await warmSonnet($, w.jev)
      await turn($, id, 'claude-sonnet-5-5', 184_000)
    }

    test('compacts after the turn the lock held, and the next turn switches on the small context', { options: compactOptions }, async ($, on) => {
      const w = world(on)
      await $.session.start(session)
      await wantCheaperOnBigContext($, w)
      expect(w.sent[1]).toBe('claude-sonnet-5-5')
      expect(w.compact.calls).toBe(0)
      await complete($, 't1')
      expect(w.compact.calls).toBe(1)
      await turnUnmeasured($, 't2', 'claude-sonnet-5-5')
      expect(w.sent[2]).toContain('haiku')
      expect(w.logs.some((line) => line.includes('compact') && line.includes('184k') && line.includes('20k'))).toBe(true)
    })

    test('does nothing unless the option is on', { options }, async ($, on) => {
      const w = world(on)
      await $.session.start(session)
      await wantCheaperOnBigContext($, w)
      await complete($, 't1')
      expect(w.compact.calls).toBe(0)
    })

    test('a small context switches directly and is never compacted', { options: compactOptions }, async ($, on) => {
      const w = world(on)
      await $.session.start(session)
      await turn($, 't1', 'claude-sonnet-5-5', 12_000)
      await complete($, 't1')
      expect(w.sent[0]).toContain('haiku')
      expect(w.compact.calls).toBe(0)
    })

    test('a turn that was interrupted, or a subagent turn, is not compacted after', { options: compactOptions }, async ($, on) => {
      const w = world(on)
      await $.session.start(session)
      await wantCheaperOnBigContext($, w)
      await complete($, 't1', { reason: 'aborted' })
      await complete($, 't1', { agentId: 'agent-1' })
      expect(w.compact.calls).toBe(0)
      await complete($, 't1')
      expect(w.compact.calls).toBe(1)
    })

    test('is not repeated while the cooldown runs', { options: compactOptions }, async ($, on) => {
      const w = world(on)
      await $.session.start(session)
      await wantCheaperOnBigContext($, w)
      await complete($, 't1')
      await turn($, 't2', 'claude-sonnet-5-5', 184_000)
      await complete($, 't2')
      expect(w.compact.calls).toBe(1)
    })

    test('a compaction that throws is logged and the router carries on', { options: compactOptions }, async ($, on) => {
      const w = world(on)
      w.compact.mode = 'throw'
      await $.session.start(session)
      await wantCheaperOnBigContext($, w)
      await complete($, 't1')
      expect(w.logs.some((line) => line.includes('compact failed'))).toBe(true)
      await turn($, 't2', 'claude-sonnet-5-5', 184_000)
      expect(w.sent[2]).toBe('claude-sonnet-5-5')
    })

    test('a compaction a hook vetoed is logged with its reason', { options: compactOptions }, async ($, on) => {
      const w = world(on)
      w.compact.mode = 'skip'
      await $.session.start(session)
      await wantCheaperOnBigContext($, w)
      await complete($, 't1')
      expect(w.logs.some((line) => line.includes('compact skipped') && line.includes('a hook vetoed it'))).toBe(true)
    })

    test('with no size after the compaction, the stale one is not read back from the session', { options: compactOptions }, async ($, on) => {
      const w = world(on)
      w.compact.tokensAfter = undefined
      w.sessionUsage.tokens = 184_000
      await $.session.start(session)
      await wantCheaperOnBigContext($, w)
      await complete($, 't1')
      expect(w.compact.calls).toBe(1)
      const callsBefore = w.sessionUsage.calls
      await turnUnmeasured($, 't2', 'claude-sonnet-5-5')
      expect(w.sessionUsage.calls).toBe(callsBefore)
      expect(w.sent[2]).toBe('claude-sonnet-5-5')
    })

    test('tells the summary what to keep', { options: compactOptions }, async ($, on) => {
      const w = world(on)
      await $.session.start(session)
      await wantCheaperOnBigContext($, w)
      await complete($, 't1')
      expect(w.compact.instructions[0]).toContain('task')
    })
  })
})
