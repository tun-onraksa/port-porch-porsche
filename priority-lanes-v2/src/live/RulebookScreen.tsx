// PortAble kit: Rulebook screen. Pick or edit the rules that rank cargo, and watch Gate Command re-rank.
import { useMemo, useState } from 'react'
import { Lock, SlidersHorizontal } from 'lucide-react'
import { useApp } from '../state.tsx'
import { BOXES } from '../data/scenario.ts'
import { evaluateAll } from '../engine/evaluate.ts'
import { actionLabel } from '../engine/actions.ts'
import { Btn, cx, Panel, RealTag, SampleTag, SimTag, UrgencyPill } from '../ui/primitives.tsx'
import { ScreenHeader } from '../ui/layout.tsx'
import {
  FIELDS, LOCKED_RULES, PRESETS, exportRulebook, getChangelog, getRulebook, loadRulebook, selectPreset, setField,
  useRulebookVersion, valueOf, withRulebook,
} from './rulebook.ts'

const WHO = 'Maria Delgado'
const GROUPS = [...new Set(FIELDS.map((f) => f.group))]

export function RulebookScreen({ terminalIntegration = false }: { terminalIntegration?: boolean }) {
  const app = useApp()
  const version = useRulebookVersion()
  const rb = getRulebook()
  const [error, setError] = useState<string | null>(null)
  const [json, setJson] = useState('')
  const [jsonMsg, setJsonMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Ranking under the default rules, to show what each edit moved.
  const baseline = useMemo(
    () => new Map(withRulebook(PRESETS.default, () => evaluateAll(BOXES, app.ctx, app.rel)).map((e, i) => [e.box.id, { rank: i + 1, score: e.urgency.score }])),
    [app.ctx, app.rel],
  )
  const top = app.evals.slice(0, 12)
  const moved = app.evals.filter((e, i) => baseline.get(e.box.id)?.rank !== i + 1).length

  function commit(key: string, value: string) {
    const err = setField(key, value, WHO)
    setError(err)
    if (!err) app.addLog({ kind: 'system', who: WHO, text: `Rulebook: ${FIELDS.find((f) => f.key === key)?.label} set to ${value}` })
  }
  function preset(id: string) {
    selectPreset(id, WHO)
    setError(null)
    app.addLog({ kind: 'system', who: WHO, text: `Rulebook preset: ${PRESETS[id].name}` })
  }

  return (
    <div>
      <ScreenHeader
        title="Rulebook"
        kicker={<><SlidersHorizontal size={13} aria-hidden /> <span>White-label priority rules</span></>}
        sub={terminalIntegration ? "Rules update the Priority Lanes appointment queue. Terminal costs and Gate forecast use the approved simulation resources." : "Pick a preset or edit the rules used by Gate Command, forecasts and drills."}
      />

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Rulebook preset">
        {Object.values(PRESETS).map((p) => (
          <button key={p.id} onClick={() => preset(p.id)} aria-pressed={rb.id === p.id}
            className={cx('h-9 rounded-lg border px-3 text-[13px] font-medium transition-colors', rb.id === p.id ? 'border-info bg-info text-white' : 'border-line-2 bg-panel-2 text-ink hover:bg-panel-3')}>
            {p.name.replace(' (default)', '')}
          </button>
        ))}
      </div>
      <p className="mb-4 max-w-3xl rounded-lg border border-line bg-panel px-3 py-2 text-[13px] text-ink-2">
        <b className="text-ink">{rb.name}.</b> {rb.note} {rb.illustrative && <SampleTag>Illustrative</SampleTag>}
        <span className="mt-1 block font-mono text-[12px] text-muted">Data source: {rb.dataSource}</span>
      </p>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="grid content-start gap-4">
          <Panel title="Your rules" sub="Editable. Changes apply from the next evaluation and are logged.">
            <div className="grid gap-5" key={version}>
              {GROUPS.map((g) => (
                <fieldset key={g} className="grid gap-1">
                  <legend className="mb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">{g}</legend>
                  {FIELDS.filter((f) => f.group === g).map((f) => {
                    const v = valueOf(rb, f.key), base = valueOf(PRESETS[rb.id] ?? PRESETS.default, f.key)
                    const id = 'rb-' + f.key.replace('.', '-')
                    return (
                      <div key={f.key} className="grid grid-cols-[minmax(0,1fr)_128px] items-center gap-3 border-b border-line py-1.5 last:border-0">
                        <label htmlFor={id} className="text-[13px] text-ink-2">{f.label}{f.help && <span className="block text-[11.5px] text-dim">{f.help}</span>}</label>
                        <span className={cx('flex items-center rounded-lg border bg-panel-2', v !== base ? 'border-serious' : 'border-line-2')}>
                          <input id={id} type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step} defaultValue={v}
                            onBlur={(e) => commit(f.key, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                            className="h-8 w-full min-w-0 bg-transparent px-2 text-right font-mono text-[13px] text-ink outline-none" />
                          <span className="pr-2 font-mono text-[10.5px] whitespace-nowrap text-muted">{f.unit}</span>
                        </span>
                      </div>
                    )
                  })}
                </fieldset>
              ))}
              {error && <p role="alert" className="text-[13px] text-crit">{error}</p>}
            </div>
          </Panel>
          <Panel title={<span className="flex items-center gap-2"><Lock size={14} aria-hidden /> Locked rules</span>} sub="No preset, edit or uploaded rulebook can change these.">
            <ul className="grid gap-2 text-[13px] text-ink-2">
              {LOCKED_RULES.map((t) => <li key={t} className="flex gap-2"><Lock size={13} className="mt-0.5 shrink-0 text-dim" aria-hidden />{t}</li>)}
            </ul>
          </Panel>
        </div>

        <div className="grid content-start gap-4">
          <Panel className="rulebook-ranking" title="Which box can’t wait, under these rules" sub={`Top 12 of ${app.evals.length} boxes. ${moved} boxes rank differently from the default rules.`} right={<SimTag>Simulated boxes</SimTag>} bodyClass="p-0">
            <ol className="divide-y divide-line">
              {top.map((e, i) => {
                const b = baseline.get(e.box.id)
                const d = b ? b.rank - (i + 1) : 0
                return (
                  <li key={e.box.id}>
                    <button onClick={() => app.go('box', e.box.id)} className="grid w-full grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left hover:bg-panel-2">
                      <span className="font-mono text-[15px] font-semibold text-ink">{i + 1}
                        {d !== 0 && <span className={cx('block text-[11px]', d > 0 ? 'text-good' : 'text-warn')}>{d > 0 ? `▲${d}` : `▼${-d}`}</span>}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2 font-mono text-[13px] font-semibold text-ink">{e.box.number}{e.box.real && <RealTag />}</span>
                        <span className="block truncate text-[12.5px] text-muted">{e.box.cargo} · suggests {actionLabel(e.rec.key).toLowerCase()}{e.rec.releasable === false ? ' · release locked' : ''}</span>
                      </span>
                      <span className="flex items-center gap-2"><UrgencyPill u={e.urgency} size="sm" />
                        {b && b.score !== e.urgency.score && <span className="font-mono text-[11px] text-muted">{e.urgency.score > b.score ? '+' : ''}{e.urgency.score - b.score}</span>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </Panel>

          <Panel title="Change log" sub="Also written to the decision log.">
            {getChangelog().length === 0
              ? <p className="text-[13px] text-muted">No changes yet. Pick a preset or edit a rule.</p>
              : <ul className="grid gap-1.5 text-[12.5px]">{getChangelog().slice().reverse().map((c, i) => (
                  <li key={i} className="grid grid-cols-[52px_minmax(0,1fr)] gap-2"><span className="font-mono text-dim">{new Date(c.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span className="text-ink-2">{c.who} · {c.label}: {c.from} → {c.to}</span></li>
                ))}</ul>}
          </Panel>

          <Panel title="Save or load a rulebook" sub="A rulebook is plain JSON: copy it to save, paste a customer’s to load and check it.">
            <textarea value={json} onChange={(e) => setJson(e.target.value)} placeholder="Paste a rulebook here, or press Show current." aria-label="Rulebook JSON" spellCheck={false}
              className="h-32 w-full rounded-lg border border-line-2 bg-panel-2 p-2 font-mono text-[11.5px] text-ink outline-none focus:border-info" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Btn size="sm" onClick={() => { setJson(exportRulebook()); setJsonMsg(null) }}>Show current</Btn>
              <Btn size="sm" onClick={() => { navigator.clipboard?.writeText(exportRulebook()).then(() => setJsonMsg({ ok: true, text: 'Copied.' }), () => { setJson(exportRulebook()); setJsonMsg({ ok: true, text: 'Shown above. Select and copy it.' }) }) }}>Copy</Btn>
              <Btn size="sm" variant="primary" onClick={() => { const r = loadRulebook(json, WHO); setJsonMsg({ ok: r.ok, text: r.message }); if (r.ok) app.addLog({ kind: 'system', who: WHO, text: `Rulebook loaded: ${getRulebook().name}` }) }}>Load pasted rulebook</Btn>
              {jsonMsg && <span role="status" className={cx('text-[12.5px]', jsonMsg.ok ? 'text-good' : 'text-crit')}>{jsonMsg.text}</span>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
