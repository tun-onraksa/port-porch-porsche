import { writeFileSync } from 'node:fs'
import { BOXES } from '../src/data/scenario.ts'
import { evaluateAll } from '../src/engine/evaluate.ts'
import { buildCtx } from '../src/engine/context.ts'
import { BASE_RELIABILITY } from '../src/engine/trust.ts'
const evaluations = evaluateAll(BOXES, buildCtx('disruption', null), BASE_RELIABILITY)
const cargo = evaluations.map(e => ({...e.box, priorityScore:e.urgency.score, recommendedAction:e.rec.key, blocked:!e.rec.releasable, holdReason:e.blocker || e.rec.blocker || e.conflicts.map(c=>c.summary).join('; ')}))
writeFileSync(new URL('../../src/priority-data.js', import.meta.url), '// Generated from Priority Lanes V2. Tracking identities are real for four records; all operational evidence is mocked.\nconst PRIORITY_CARGO='+JSON.stringify(cargo)+';\n')
