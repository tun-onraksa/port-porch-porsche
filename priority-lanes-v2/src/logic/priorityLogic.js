// ============================================================
// AT THE GATE — PRIORITY / URGENCY MODEL
// ============================================================
//
// PURPOSE:
//
// This file controls HOW containers are prioritized.
//
// The rest of the application does not need to know how the
// score was calculated. It only expects:
//
// {
//   score: 0-100,
//   level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
//   reasons: []
// }
//
// This means this file can later be replaced with:
// - a different weighted model
// - Gaussian / statistical scoring
// - ML-based scoring
// - company-specific business rules
//
// without changing the simulator or UI.
// ============================================================


// ============================================================
// MODEL CONFIGURATION
// ============================================================
//
// Hackathon model weights.
// Change these numbers to tune the model.
//

export const PRIORITY_CONFIG = {

    // Conflicting operational data
    DATA_DISCREPANCY: 40,
  
    // Inspection is required
    INSPECTION_REQUIRED: 25,
  
    // Customs/legal block
    CUSTOMS_HOLD: 35,
  
    // Last free day approaching
    LAST_FREE_DAY: 20,
  
    // Container is already in inspection
    IN_INSPECTION: 15,
  
    // High operational risk
    HIGH_RISK: 20,
  
    // Medium operational risk
    MEDIUM_RISK: 10,
  
    // Cost exposure weighting
    COST_EXPOSURE_PER_100: 2,
  
    // Maximum score
    MAX_SCORE: 100,
  }
  
  
  // ============================================================
  // MAIN PRIORITY FUNCTION
  // ============================================================
  //
  // IMPORTANT:
  //
  // This is the contract used by the rest of the app.
  //
  // Anyone can replace the math inside this function,
  // but should continue returning:
  //
  // {
  //   score,
  //   level,
  //   reasons
  // }
  //
  
  export function calculatePriority(container) {
  
    let score = 0
  
    const reasons = []
  
  
    // ==========================================================
    // 1. DATA DISCREPANCY
    // ==========================================================
  
    const carrierSaysEmpty =
      container.scenario?.carrierRecord === 'EMPTY'
  
    const terminalWeight =
      container.scenario?.terminalScaleKg ?? 0
  
  
    if (
      carrierSaysEmpty &&
      terminalWeight > 1000 &&
      !container.simulation?.inspected
    ) {
  
      score += PRIORITY_CONFIG.DATA_DISCREPANCY
  
      reasons.push({
        factor: 'DATA_DISCREPANCY',
        points: PRIORITY_CONFIG.DATA_DISCREPANCY,
        explanation:
          `Carrier reports EMPTY while terminal scale reports ${terminalWeight.toLocaleString()} kg.`,
      })
    }
  
  
    // ==========================================================
    // 2. INSPECTION REQUIRED
    // ==========================================================
  
    if (
      container.scenario?.inspectionRequired === true &&
      !container.simulation?.inspected
    ) {
  
      score += PRIORITY_CONFIG.INSPECTION_REQUIRED
  
      reasons.push({
        factor: 'INSPECTION_REQUIRED',
        points: PRIORITY_CONFIG.INSPECTION_REQUIRED,
        explanation:
          'Container requires physical investigation.',
      })
    }
  
  
    // ==========================================================
    // 3. CUSTOMS HOLD
    // ==========================================================
  
    if (
      container.scenario?.customsHold === true
    ) {
  
      score += PRIORITY_CONFIG.CUSTOMS_HOLD
  
      reasons.push({
        factor: 'CUSTOMS_HOLD',
        points: PRIORITY_CONFIG.CUSTOMS_HOLD,
        explanation:
          'Container is blocked by customs.',
      })
    }
  
  
    // ==========================================================
    // 4. LAST FREE DAY
    // ==========================================================
  
    if (
      container.scenario?.lastFreeDay === 'Tomorrow'
    ) {
  
      score += PRIORITY_CONFIG.LAST_FREE_DAY
  
      reasons.push({
        factor: 'LAST_FREE_DAY',
        points: PRIORITY_CONFIG.LAST_FREE_DAY,
        explanation:
          'Last free day is approaching.',
      })
    }
  
  
    // ==========================================================
    // 5. CURRENTLY IN INSPECTION
    // ==========================================================
  
    if (
      container.simulation?.location === 'INSPECTION'
    ) {
  
      score += PRIORITY_CONFIG.IN_INSPECTION
  
      reasons.push({
        factor: 'IN_INSPECTION',
        points: PRIORITY_CONFIG.IN_INSPECTION,
        explanation:
          'Container is consuming limited inspection capacity.',
      })
    }
  
  
    // ==========================================================
    // 6. OPERATIONAL RISK
    // ==========================================================
  
    if (
      container.simulation?.risk === 'HIGH'
    ) {
  
      score += PRIORITY_CONFIG.HIGH_RISK
  
      reasons.push({
        factor: 'HIGH_RISK',
        points: PRIORITY_CONFIG.HIGH_RISK,
        explanation:
          'Container currently has high operational risk.',
      })
    }
  
    else if (
      container.simulation?.risk === 'MEDIUM'
    ) {
  
      score += PRIORITY_CONFIG.MEDIUM_RISK
  
      reasons.push({
        factor: 'MEDIUM_RISK',
        points: PRIORITY_CONFIG.MEDIUM_RISK,
        explanation:
          'Container currently has medium operational risk.',
      })
    }
  
  
    // ==========================================================
    // 7. COST EXPOSURE
    // ==========================================================
  
    const hourlyCost =
      container.scenario?.hourlyCostExposure ?? 0
  
  
    if (hourlyCost > 0) {
  
      const costPoints =
        Math.min(
          15,
          Math.round(
            (hourlyCost / 100) *
            PRIORITY_CONFIG.COST_EXPOSURE_PER_100
          )
        )
  
  
      score += costPoints
  
  
      reasons.push({
        factor: 'COST_EXPOSURE',
        points: costPoints,
        explanation:
          `$${hourlyCost}/hr estimated cost exposure.`,
      })
    }
  
  
    // ==========================================================
    // NORMALIZE TO 0–100
    // ==========================================================
  
    score =
      Math.min(
        PRIORITY_CONFIG.MAX_SCORE,
        Math.max(0, score)
      )
  
  
    // ==========================================================
    // PRIORITY LEVEL
    // ==========================================================
  
    let level = 'LOW'
  
  
    if (score >= 80) {
      level = 'CRITICAL'
    }
  
    else if (score >= 60) {
      level = 'HIGH'
    }
  
    else if (score >= 30) {
      level = 'MEDIUM'
    }
  
  
    return {
      score,
      level,
      reasons,
    }
  }
  
  
  // ============================================================
  // RANK MULTIPLE CONTAINERS
  // ============================================================
  
  export function rankContainers(containers) {
  
    return containers
      .map((container) => {
  
        const priority =
          calculatePriority(container)
  
  
        return {
          container,
          priority,
        }
      })
  
      .sort(
        (a, b) =>
          b.priority.score -
          a.priority.score
      )
  }