import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { BOXES, HERO_ID } from './data/scenario.ts'
import type { DrillId, Mode } from './engine/context.ts'
import { NOW, buildCtx } from './engine/context.ts'
import { evaluateAll } from './engine/evaluate.ts'
import { fullPlan, simulate } from './engine/simulate.ts'
import type { Decisions, SimResult } from './engine/simulate.ts'
import { BASE_RELIABILITY } from './engine/trust.ts'
import type { Reliability } from './engine/trust.ts'
import type { ActionKey, Evaluation } from './engine/types.ts'
import type { Ctx as EngineCtx } from './engine/context.ts'
import { MIN } from './engine/time.ts'

export type Screen = 'radar' | 'gate' | 'box' | 'forecast' | 'drill' | 'security' | 'learning' | 'built'
export type View = 'ops' | 'security'
const SCREENS: Screen[] = ['radar', 'gate', 'box', 'forecast', 'drill', 'security', 'learning', 'built']
const hashFlag = (k: string) => window.location.hash.split('&').includes(k)

export interface Approval { state: 'approved' | 'modified' | 'rejected'; key: ActionKey; proposed: ActionKey; reason?: string; at: number }
export interface LogEntry { at: number; who: string; text: string; boxId?: string; kind: 'approve' | 'modify' | 'reject' | 'plan' | 'notify' | 'learn' | 'system' }

type LiveMode = 'ordinary' | 'disruption'

interface AppCtx {
  screen: Screen
  go: (s: Screen, boxId?: string) => void
  mode: Mode
  setMode: (m: Mode) => void
  drill: DrillId
  setDrill: (d: DrillId) => void
  view: View
  setView: (v: View) => void
  boxId: string
  ctx: EngineCtx
  evals: Evaluation[]
  evalById: (id: string) => Evaluation | undefined
  approvals: Record<string, Approval>
  approve: (e: Evaluation) => void
  approveAll: () => void
  modify: (e: Evaluation, key: ActionKey, reason: string) => void
  reject: (e: Evaluation, reason: string) => void
  resetApprovals: () => void
  decisions: Decisions
  blunt: SimResult
  plan: SimResult
  full: SimResult
  pending: number
  log: LogEntry[]
  addLog: (e: Omit<LogEntry, 'at' | 'who'> & { who?: string }) => void
  rel: Reliability
  setRel: (r: Reliability) => void
  tasksDone: Record<string, boolean>
  toggleTask: (id: string) => void
  notified: Record<string, number>
  notify: (id: string, text: string) => void
  guide: number | null
  setGuide: (n: number | null) => void
  clock: number
}

const AppContext = createContext<AppCtx | null>(null)
export const useApp = () => {
  const c = useContext(AppContext)
  if (!c) throw new Error('useApp outside provider')
  return c
}

export function AppProvider({ children }: { children: ReactNode }) {
  // Deep links: #gate, #box, #forecast … open a screen directly (handy for demos).
  const [screen, setScreen] = useState<Screen>(() => {
    const h = window.location.hash.slice(1).split('&')[0] as Screen
    return SCREENS.includes(h) ? h : 'radar'
  })
  const [mode, setModeRaw] = useState<Mode>(() => (hashFlag('drill') ? 'drill' : hashFlag('ordinary') ? 'ordinary' : 'disruption'))
  const [drill, setDrill] = useState<DrillId>('wind_cranes_12h')
  const [view, setView] = useState<View>(() => (hashFlag('security') || window.location.hash === '#security' ? 'security' : 'ops'))
  const [boxId, setBoxId] = useState(HERO_ID)
  const [approvalsByMode, setApprovals] = useState<Record<LiveMode, Record<string, Approval>>>({ ordinary: {}, disruption: {} })
  const [log, setLog] = useState<LogEntry[]>([
    { at: NOW - 2 * MIN, who: 'System', text: 'Power fault: lanes 5–8 down, ETA 14:00. Playbook loaded.', kind: 'system' },
    { at: NOW - 1 * MIN, who: 'System', text: '112 boxes reconciled across Terminal49, TOS, crane, reefer and customs feeds.', kind: 'system' },
  ])
  const [rel, setRel] = useState<Reliability>(BASE_RELIABILITY)
  const [tasksDone, setTasks] = useState<Record<string, boolean>>({})
  const [notified, setNotified] = useState<Record<string, number>>({})
  const [guide, setGuide] = useState<number | null>(() => (window.location.hash && !hashFlag('guide') ? null : 0))
  const [actions, setActions] = useState(0) // planner clock advances a minute per decision

  const clock = NOW + Math.min(actions, 25) * MIN
  const ctx = useMemo(() => buildCtx(mode, drill), [mode, drill])
  const evals = useMemo(() => evaluateAll(BOXES, ctx, rel), [ctx, rel])
  const byId = useMemo(() => new Map(evals.map((e) => [e.box.id, e])), [evals])
  const liveMode: LiveMode = mode === 'ordinary' ? 'ordinary' : 'disruption'
  const approvals = mode === 'drill' ? {} : approvalsByMode[liveMode]

  const decisions = useMemo<Decisions>(() => {
    if (mode === 'drill') return fullPlan(evals) // drills show the proposed plan; nothing is approved live
    const d: Decisions = {}
    for (const e of evals) {
      const a = approvals[e.box.id]
      d[e.box.id] = !a || a.state === 'rejected' ? null : a.key
    }
    return d
  }, [evals, approvals, mode])

  const blunt = useMemo(() => simulate(evals, ctx, 'blunt'), [evals, ctx])
  const plan = useMemo(() => simulate(evals, ctx, 'plan', decisions), [evals, ctx, decisions])
  const full = useMemo(() => simulate(evals, ctx, 'plan', fullPlan(evals)), [evals, ctx])
  const pending = mode === 'drill' ? 0 : evals.filter((e) => !approvals[e.box.id]).length

  const addLog = useCallback((e: Omit<LogEntry, 'at' | 'who'> & { who?: string }) => {
    setActions((n) => n + 1)
    setLog((l) => [{ at: NOW + Math.min(l.length, 25) * MIN, who: e.who ?? 'M. Delgado (planner, fictional)', ...e }, ...l])
  }, [])

  const put = (id: string, a: Approval) => setApprovals((s) => ({ ...s, [liveMode]: { ...s[liveMode], [id]: a } }))

  const value: AppCtx = {
    screen,
    go: (s, id) => {
      if (id) setBoxId(id)
      setScreen(s)
      history.replaceState(null, '', `#${s}`)
      window.scrollTo({ top: 0 })
    },
    mode,
    setMode: (m) => {
      setModeRaw(m)
      if (m === 'drill') setScreen('drill')
    },
    drill,
    setDrill,
    view,
    setView,
    boxId,
    ctx,
    evals,
    evalById: (id) => byId.get(id),
    approvals,
    approve: (e) => {
      if (mode === 'drill') return
      put(e.box.id, { state: 'approved', key: e.rec.key, proposed: e.rec.key, at: clock })
      addLog({ kind: 'approve', boxId: e.box.id, text: `Approved ${e.rec.key} for ${e.box.number}` })
    },
    approveAll: () => {
      if (mode === 'drill') return
      const pendingEvals = evals.filter((e) => !approvals[e.box.id])
      setApprovals((s) => {
        const next = { ...s[liveMode] }
        for (const e of pendingEvals) next[e.box.id] = { state: 'approved', key: e.rec.key, proposed: e.rec.key, at: clock }
        return { ...s, [liveMode]: next }
      })
      const tallies: Record<string, number> = {}
      for (const e of pendingEvals) tallies[e.rec.key] = (tallies[e.rec.key] ?? 0) + 1
      addLog({ kind: 'plan', text: `Plan approved: ${pendingEvals.length} actions (${Object.entries(tallies).map(([k, n]) => `${n} ${k}`).join(', ')}). Notifications drafted to truckers, importers and CBP.` })
    },
    modify: (e, key, reason) => {
      put(e.box.id, { state: 'modified', key, proposed: e.rec.key, reason, at: clock })
      addLog({ kind: 'modify', boxId: e.box.id, text: `Modified ${e.box.number}: ${e.rec.key} → ${key}. Reason: “${reason}”` })
    },
    reject: (e, reason) => {
      put(e.box.id, { state: 'rejected', key: e.rec.key, proposed: e.rec.key, reason, at: clock })
      addLog({ kind: 'reject', boxId: e.box.id, text: `Rejected ${e.rec.key} for ${e.box.number}. Reason: “${reason}”` })
    },
    resetApprovals: () => {
      setApprovals((s) => ({ ...s, [liveMode]: {} }))
      addLog({ kind: 'system', who: 'System', text: 'Approvals reset for the demo.' })
    },
    decisions,
    blunt,
    plan,
    full,
    pending,
    log,
    addLog,
    rel,
    setRel,
    tasksDone,
    toggleTask: (id) => setTasks((t) => ({ ...t, [id]: !t[id] })),
    notified,
    notify: (id, text) => {
      setNotified((n) => ({ ...n, [id]: Date.now() }))
      addLog({ kind: 'notify', text })
    },
    guide,
    setGuide,
    clock,
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
