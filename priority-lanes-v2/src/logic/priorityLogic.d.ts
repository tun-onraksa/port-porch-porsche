// Types for Yunna's priority model (priorityLogic.js, copied unchanged from the yunna-priority-logic branch).
export interface PriorityReason { factor: string; points: number; explanation: string }
export interface Priority { score: number; level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; reasons: PriorityReason[] }
export interface PriorityInput {
  scenario?: { carrierRecord?: 'EMPTY' | 'FULL'; terminalScaleKg?: number; inspectionRequired?: boolean; customsHold?: boolean; lastFreeDay?: string; hourlyCostExposure?: number }
  simulation?: { inspected?: boolean; location?: string; risk?: 'HIGH' | 'MEDIUM' | 'LOW' }
}
export const PRIORITY_CONFIG: Record<string, number>
export function calculatePriority(container: PriorityInput): Priority
export function rankContainers<T extends PriorityInput>(containers: T[]): { container: T; priority: Priority }[]
