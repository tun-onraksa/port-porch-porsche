import {
    calculatePriority,
  } from '../logic/priorityLogic'
// ============================================================
// AT THE GATE — PORT DECISION SIMULATOR
// ============================================================

export const initialPortState = {
    gates: {
      total: 10,
      available: 6,
    },
  
    inspectionLanes: {
      total: 3,
      available: 1,
    },
  
    truckQueue: 14,
    containersWaiting: 8,
  
    metrics: {
      portFlow: 78,
      costExposure: 4200,
      containersCleared: 0,
    },
  }
  
  
  // ============================================================
  // CONTAINERS
  // ============================================================
  
  export const initialContainers = [
    {
      id: 'TRHU5485372',
  
      terminal49: {
        source: 'Terminal49 / Real',
        status: 'On ship',
        carrier: 'COSCO',
        origin: 'Tianjinxingang',
        destination: 'Los Angeles',
        terminal: 'APM Terminals',
        eta: '2026-10-28',
        equipment: '40-ft high-cube dry',
      },
  
      scenario: {
        source: 'Scenario / Simulated',
  
        carrierRecord: 'EMPTY',
        terminalScaleKg: 18400,
  
        inspectionRequired: true,
      },
  
      simulation: {
        location: 'YARD',
        delayHours: 0,
        risk: 'HIGH',
        status: 'AWAITING_DECISION',
        inspected: false,
        released: false,
        gate: null,
      },
    },
  
    {
      id: 'CSNU6554910',
  
      terminal49: {
        source: 'Terminal49 / Real',
        status: 'On ship',
        carrier: 'COSCO',
        origin: 'Tianjinxingang',
        destination: 'Los Angeles',
        terminal: 'APM Terminals',
        eta: '2026-10-28',
        equipment: '40-ft high-cube dry',
      },
  
      scenario: {
        source: 'Scenario / Simulated',
        lastFreeDay: 'Tomorrow',
        hourlyCostExposure: 125,
        inspectionRequired: false,
      },
  
      simulation: {
        location: 'YARD',
        delayHours: 0,
        risk: 'MEDIUM',
        status: 'AWAITING_DECISION',
        inspected: false,
        released: false,
        gate: null,
      },
    },
  
    {
      id: 'TGBU4865142',
  
      terminal49: {
        source: 'Terminal49 / Real',
        status: 'On ship',
        carrier: 'COSCO',
        origin: 'Tianjinxingang',
        destination: 'Los Angeles',
        terminal: 'APM Terminals',
        eta: '2026-10-28',
        equipment: '40-ft high-cube dry',
      },
  
      scenario: {
        source: 'Scenario / Simulated',
        customsHold: true,
        inspectionRequired: false,
      },
  
      simulation: {
        location: 'YARD',
        delayHours: 0,
        risk: 'HIGH',
        status: 'BLOCKED',
        inspected: false,
        released: false,
        gate: null,
      },
    },
  
    {
      id: 'OOCU8185051',
  
      terminal49: {
        source: 'Terminal49 / Real',
        status: 'On ship',
        carrier: 'COSCO',
        origin: 'Tianjinxingang',
        destination: 'Los Angeles',
        terminal: 'APM Terminals',
        eta: '2026-10-28',
        equipment: '40-ft high-cube dry',
      },
  
      scenario: {
        source: 'Scenario / Simulated',
        inspectionRequired: false,
      },
  
      simulation: {
        location: 'YARD',
        delayHours: 0,
        risk: 'LOW',
        status: 'NORMAL',
        inspected: false,
        released: false,
        gate: null,
      },
    },
  ]
  
  
  function clone(data) {
    return JSON.parse(JSON.stringify(data))
  }
  
  
  // ============================================================
  // ALERT ENGINE
  // ============================================================
  
  export function assessContainer(container) {
    const alerts = []
    let priority = 0
  
    const carrierSaysEmpty =
      container.scenario?.carrierRecord === 'EMPTY'
  
    const terminalWeight =
      container.scenario?.terminalScaleKg ?? 0
  
  
    // Weight discrepancy
    if (
      carrierSaysEmpty &&
      terminalWeight > 1000 &&
      !container.simulation.inspected
    ) {
      alerts.push({
        type: 'DATA_DISCREPANCY',
        severity: 'URGENT',
        title: 'Weight discrepancy detected',
  
        message:
          `Carrier record reports EMPTY, but terminal scale reports ${terminalWeight.toLocaleString()} kg.`,
  
        explanation:
          'Carrier data conflicts with physical terminal data.',
  
        investigationRequired: true,
        recommendedAction: 'INSPECT',
      })
  
      const priority =
        calculatePriority(container)
    }
  
  
    // Customs hold
    if (container.scenario?.customsHold === true) {
      alerts.push({
        type: 'CUSTOMS_HOLD',
        severity: 'BLOCKED',
        title: 'Customs hold active',
        message:
          'Container cannot be released until customs clears the hold.',
        investigationRequired: false,
        recommendedAction: 'SLOW',
      })
  
      priority += 30
    }
  
  
    // Cost / LFD risk
    if (container.scenario?.lastFreeDay === 'Tomorrow') {
      alerts.push({
        type: 'TIME_RISK',
        severity: 'WARNING',
        title: 'Last free day approaching',
        message:
          'Additional delay may create charges.',
        investigationRequired: false,
        recommendedAction: 'RELEASE',
      })
  
      priority += 20
    }
  
  
    const needsInvestigation =
      alerts.some(
        (alert) =>
          alert.investigationRequired === true
      )
  
    const isBlocked =
      alerts.some(
        (alert) =>
          alert.severity === 'BLOCKED'
      )
  
    const hasWarning =
      alerts.some(
        (alert) =>
          alert.severity === 'WARNING'
      )
  
  
    let status = 'NORMAL'
  
    if (needsInvestigation) {
      status = 'INTERVENE'
    } else if (isBlocked) {
      status = 'BLOCKED'
    } else if (hasWarning) {
      status = 'MONITOR'
    }
  
  
    if (container.simulation.released) {
      return {
        containerId: container.id,
        status,
        needsInvestigation,
        priority: priority.score,
        priorityLevel: priority.level,
        priorityReasons: priority.reasons,
        alerts,
        recommendedAction:
          alerts[0]?.recommendedAction ?? 'NONE',
      }
    }
  
  
    return {
      containerId: container.id,
      status,
      needsInvestigation,
      priority,
      alerts,
      recommendedAction:
        alerts[0]?.recommendedAction ?? 'NONE',
    }
  }
  
  
  // ============================================================
  // SIMULATION
  // ============================================================
  
  export function simulateAction(
    originalContainer,
    originalPortState,
    action
  ) {
    const container = clone(originalContainer)
    const port = clone(originalPortState)
  
    let success = true
    let message = ''
  
    const consequences = []
    const playback = []
  
  
    // ==========================================================
    // SLOW
    // ==========================================================
  
    if (action === 'SLOW') {
      container.simulation.status = 'SLOWED'
      container.simulation.delayHours += 0.5
  
      port.metrics.costExposure += 75
      port.metrics.portFlow -= 1
  
      playback.push(
        {
          minute: 0,
          text: 'Planner slows container movement.',
        },
        {
          minute: 10,
          text: 'Container remains in controlled holding area.',
        },
        {
          minute: 20,
          text: 'Weight discrepancy remains unresolved.',
        },
        {
          minute: 30,
          text: 'Container is still awaiting investigation.',
        }
      )
  
      consequences.push(
        'Delay +30 min',
        'Cost exposure +$75',
        'Port flow -1',
        'Weight discrepancy remains unresolved'
      )
  
      message =
        'Container movement slowed, but investigation is still required.'
    }
  
  
    // ==========================================================
    // REROUTE
    // ==========================================================
  
    else if (action === 'REROUTE') {
      if (container.scenario?.customsHold) {
        success = false
  
        playback.push({
          minute: 0,
          text: 'Reroute request rejected because customs hold is active.',
        })
  
        consequences.push(
          'Container remains blocked'
        )
  
        message =
          'Rerouting cannot bypass a customs hold.'
      }
  
      else if (port.gates.available <= 0) {
        success = false
  
        playback.push({
          minute: 0,
          text: 'No alternate gate capacity available.',
        })
  
        consequences.push(
          'Container remains in current location'
        )
  
        message =
          'Reroute blocked: no alternate gate capacity.'
      }
  
      else {
        port.gates.available -= 1
  
        container.simulation.location =
          'ALTERNATE_GATE'
  
        container.simulation.status =
          'REROUTED'
  
        container.simulation.delayHours += 0.5
  
        port.metrics.costExposure += 75
  
        playback.push(
          {
            minute: 0,
            text: 'Alternate route selected.',
          },
          {
            minute: 8,
            text: 'Container leaves normal processing flow.',
          },
          {
            minute: 18,
            text: 'Alternate gate capacity is occupied.',
          },
          {
            minute: 30,
            text: 'Container reaches alternate holding area.',
          }
        )
  
        consequences.push(
          'Gate capacity -1',
          'Delay +30 min',
          'Cost exposure +$75',
          'Weight discrepancy remains unresolved'
        )
  
        message =
          'Container rerouted, but the data discrepancy still requires investigation.'
      }
    }
  
  
    // ==========================================================
    // INSPECT
    // ==========================================================
  
    else if (action === 'INSPECT') {
      const assessment =
        assessContainer(container)
  
      if (!assessment.needsInvestigation) {
        success = false
  
        playback.push({
          minute: 0,
          text: 'No investigation is currently required.',
        })
  
        message =
          'Inspection is not required for this container.'
      }
  
      else if (
        port.inspectionLanes.available <= 0
      ) {
        success = false
  
        playback.push({
          minute: 0,
          text: 'Inspection request submitted, but all lanes are occupied.',
        })
  
        consequences.push(
          'Inspection capacity unavailable'
        )
  
        message =
          'All inspection lanes are currently occupied.'
      }
  
      else {
        port.inspectionLanes.available -= 1
  
        container.simulation.location =
          'INSPECTION'
  
        container.simulation.status =
          'INSPECTION_COMPLETE'
  
        container.simulation.inspected = true
  
        container.simulation.delayHours += 0.5
  
        container.simulation.risk = 'LOW'
  
        container.scenario.inspectionRequired =
          false
  
        port.metrics.costExposure =
          Math.max(
            0,
            port.metrics.costExposure - 500
          )
  
        port.metrics.portFlow -= 3
  
  
        playback.push(
          {
            minute: 0,
            text: 'Inspection request submitted.',
          },
          {
            minute: 8,
            text: 'Container routed to inspection lane.',
          },
          {
            minute: 18,
            text: 'Physical inspection in progress.',
          },
          {
            minute: 26,
            text: 'EMPTY vs. 18,400 kg discrepancy investigated.',
          },
          {
            minute: 30,
            text: 'Inspection complete. Container is eligible for release.',
          }
        )
  
  
        consequences.push(
          'Inspection lane capacity -1',
          'Delay +30 min',
          'Risk HIGH → LOW',
          'Cost exposure -$500',
          'Weight discrepancy investigated'
        )
  
  
        message =
          'Inspection resolves the operational discrepancy.'
      }
    }
  
  
    // ==========================================================
    // RELEASE
    // ==========================================================
  
    else if (action === 'RELEASE') {
      const assessment =
        assessContainer(container)
  
  
      if (container.scenario?.customsHold) {
        success = false
  
        playback.push(
          {
            minute: 0,
            text: 'Release request submitted.',
          },
          {
            minute: 4,
            text: 'Customs hold detected.',
          },
          {
            minute: 5,
            text: 'Release denied.',
          }
        )
  
        consequences.push(
          'Container remains blocked'
        )
  
        message =
          'RELEASE BLOCKED: customs hold is active.'
      }
  
  
      else if (assessment.needsInvestigation) {
        success = false
  
        playback.push(
          {
            minute: 0,
            text: 'Release request submitted.',
          },
          {
            minute: 3,
            text: 'Carrier record checked: EMPTY.',
          },
          {
            minute: 4,
            text: 'Terminal scale checked: 18,400 kg.',
          },
          {
            minute: 5,
            text: 'Conflict detected. Release denied.',
          }
        )
  
        consequences.push(
          'Unresolved discrepancy remains',
          'Inspection required before release'
        )
  
        message =
          'RELEASE BLOCKED: unresolved data discrepancy requires investigation.'
      }
  
  
      else {
        container.simulation.released = true
  
        container.simulation.status =
          'RELEASED'
  
        container.simulation.location =
          'EXIT'
  
        container.simulation.risk = 'NONE'
  
        port.containersWaiting =
          Math.max(
            0,
            port.containersWaiting - 1
          )
  
        port.metrics.containersCleared += 1
        port.metrics.portFlow += 5
  
        port.metrics.costExposure =
          Math.max(
            0,
            port.metrics.costExposure - 300
          )
  
  
        playback.push(
          {
            minute: 0,
            text: 'Release authorized.',
          },
          {
            minute: 10,
            text: 'Container enters outbound flow.',
          },
          {
            minute: 20,
            text: 'Gate processing completed.',
          },
          {
            minute: 30,
            text: 'Container cleared from terminal flow.',
          }
        )
  
  
        consequences.push(
          'Container cleared +1',
          'Port flow +5',
          'Cost exposure -$300'
        )
  
  
        message =
          'Container successfully released.'
      }
    }
  
  
    else {
      success = false
  
      message =
        `Unknown action: ${action}`
    }
  
  
    port.metrics.portFlow =
      Math.max(
        0,
        Math.min(
          100,
          port.metrics.portFlow
        )
      )
  
  
    return {
      success,
      action,
      message,
      consequences,
      playback,
      container,
      portState: port,
      assessment:
        assessContainer(container),
    }
  }
  
  
  // ============================================================
  // HELPERS
  // ============================================================
  
  export function getAttentionQueue(containers) {
    return containers
      .map((container) => ({
        container,
        assessment:
          assessContainer(container),
      }))
      .filter(
        ({ assessment }) =>
          assessment.status !== 'NORMAL'
      )
      .sort(
        (a, b) =>
          b.assessment.priority -
          a.assessment.priority
      )
  }
  
  
  export function resetScenario() {
    return {
      containers:
        clone(initialContainers),
  
      portState:
        clone(initialPortState),
    }
  }