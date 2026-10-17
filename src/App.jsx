import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import { useEffect, useState } from 'react'
import './index.css'

import { containers } from './data/containers'

import {
  initialContainers,
  initialPortState,
  assessContainer,
  simulateAction,
} from './simulation/simulator'

import {
  calculatePriority,
} from './logic/priorityLogic'


// ============================================================
// SIMULATION LOOKUPS
// ============================================================

function getSimulationContainer(container) {
  return initialContainers.find(
    (item) =>
      item.id === container.containerNumber
  )
}


function getAssessmentForContainer(container) {
  const simulationContainer =
    getSimulationContainer(container)

  if (!simulationContainer) {
    return {
      status: 'NORMAL',
      needsInvestigation: false,
      priority: 0,
      alerts: [],
      recommendedAction: 'NONE',
    }
  }

  return assessContainer(simulationContainer)
}


// ============================================================
// CONTAINER
// ============================================================

function ContainerBox({
  position,
  container,
  selected,
  onClick,
}) {
  const assessment =
    getAssessmentForContainer(container)

  const needsInvestigation =
    assessment.needsInvestigation === true


  return (
    <group position={position}>

      {/* ALERT ONLY IF FLAGGED */}

      {needsInvestigation && (
        <>
          <Text
            position={[0, 1.05, 0]}
            fontSize={0.22}
            color="#ff3b30"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.015}
            outlineColor="#000000"
          >
            🚨 ALERT
          </Text>

          <Text
            position={[0, 0.78, 0]}
            fontSize={0.12}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.01}
            outlineColor="#000000"
          >
            INVESTIGATE
          </Text>
        </>
      )}


      {/* CONTAINER */}

      <mesh
        onClick={(e) => {
          e.stopPropagation()
          onClick(container)
        }}
        scale={selected ? 1.08 : 1}
      >
        <boxGeometry args={[1.4, 0.55, 0.55]} />

        <meshStandardMaterial
          color={
            needsInvestigation
              ? '#ff2d2d'
              : selected
              ? '#ffb347'
              : '#c65f35'
          }
          emissive={
            needsInvestigation
              ? '#8b0000'
              : '#000000'
          }
          emissiveIntensity={
            needsInvestigation
              ? 0.8
              : 0
          }
        />
      </mesh>


      {/* NUMBER */}

      {(selected || needsInvestigation) && (
        <Text
          position={[0, 0.48, 0]}
          fontSize={0.14}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.008}
          outlineColor="#000000"
        >
          {container.containerNumber}
        </Text>
      )}

    </group>
  )
}


// ============================================================
// SHIP
// ============================================================

function Ship({
  selectedContainer,
  setSelectedContainer,
}) {
  const positions = [
    [-0.7, 1.15, -0.65],
    [0.9, 1.15, -0.65],
    [-0.7, 1.15, 0.15],
    [0.9, 1.15, 0.15],
  ]


  return (
    <group position={[0, 0.2, 0]}>

      {/* Hull */}

      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[7, 0.9, 2.6]} />
        <meshStandardMaterial color="#30343b" />
      </mesh>


      {/* Upper Hull */}

      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[6.5, 0.35, 2.3]} />
        <meshStandardMaterial color="#e7e3dc" />
      </mesh>


      {/* Bridge */}

      <mesh position={[-2.4, 1.2, 0]}>
        <boxGeometry args={[1.3, 1.3, 1.8]} />
        <meshStandardMaterial color="#f1f1f1" />
      </mesh>


      {/* Real containers */}

      {containers.map((container, index) => (
        <ContainerBox
          key={container.containerNumber}
          position={positions[index]}
          container={container}
          selected={
            selectedContainer?.containerNumber ===
            container.containerNumber
          }
          onClick={setSelectedContainer}
        />
      ))}


      <Text
        position={[0, 2.4, 0]}
        fontSize={0.28}
        color="white"
        anchorX="center"
      >
        EVER LAUREL
      </Text>

    </group>
  )
}


// ============================================================
// PORT
// ============================================================

function Port() {
  return (
    <group position={[7, 0, -1]}>

      {/* Dock */}

      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[6, 0.5, 5]} />
        <meshStandardMaterial color="#77736c" />
      </mesh>


      {/* Decorative container stacks */}

      {Array.from({ length: 14 }).map(
        (_, i) => {

          const x =
            (i % 4) * 1.15 - 1.7

          const z =
            Math.floor(i / 4) *
              0.8 -
            1.2


          return (
            <mesh
              key={i}
              position={[x, 0.8, z]}
            >
              <boxGeometry
                args={[1, 0.45, 0.5]}
              />

              <meshStandardMaterial
                color={
                  [
                    '#a94442',
                    '#476a8a',
                    '#d1893e',
                    '#52765d',
                  ][i % 4]
                }
              />
            </mesh>
          )
        }
      )}


      {/* Crane */}

      <mesh position={[-2, 2, -1.8]}>
        <boxGeometry args={[0.3, 4, 0.3]} />
        <meshStandardMaterial color="#d8b33e" />
      </mesh>


      <mesh position={[-0.8, 3.7, -1.8]}>
        <boxGeometry args={[2.7, 0.25, 0.25]} />
        <meshStandardMaterial color="#d8b33e" />
      </mesh>

    </group>
  )
}


// ============================================================
// OCEAN
// ============================================================

function Ocean() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.5, 0]}
    >
      <planeGeometry args={[40, 30]} />
      <meshStandardMaterial color="#356b87" />
    </mesh>
  )
}


// ============================================================
// SCENE
// ============================================================

function Scene({
  selectedContainer,
  setSelectedContainer,
}) {
  return (
    <>
      <ambientLight intensity={1.5} />

      <directionalLight
        position={[8, 10, 5]}
        intensity={2}
      />

      <Ocean />

      <Ship
        selectedContainer={selectedContainer}
        setSelectedContainer={setSelectedContainer}
      />

      <Port />

      <OrbitControls
        enableDamping
        minDistance={8}
        maxDistance={22}
        maxPolarAngle={Math.PI / 2.1}
      />
    </>
  )
}


// ============================================================
// ACTION BUTTON
// ============================================================

function ActionButton({
  action,
  selected,
  recommended,
  disabled,
  onClick,
}) {
  return (
    <button
      disabled={disabled}
      onClick={() => onClick(action)}
      style={{
        width: '100%',
        padding: '12px',
        borderRadius: '8px',

        border: selected
          ? '2px solid #ffb347'
          : recommended
          ? '1px solid #69e39d'
          : '1px solid #555',

        background: selected
          ? '#50361d'
          : recommended
          ? '#173b28'
          : '#242424',

        color: 'white',
        fontWeight: 700,

        cursor:
          disabled
            ? 'not-allowed'
            : 'pointer',

        opacity:
          disabled ? 0.45 : 1,
      }}
    >
      {recommended && !selected
        ? '✓ '
        : ''}

      {action}
    </button>
  )
}


// ============================================================
// PLAYBACK
// ============================================================

function Playback({
  result,
  running,
  progress,
  visibleEvents,
}) {
  if (!result) {
    return null
  }


  return (
    <div
      style={{
        marginTop: '18px',
        padding: '14px',
        borderRadius: '9px',
        background: '#181818',
        border: '1px solid #444',
      }}
    >

      {/* Playback header */}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <strong>
          {running
            ? '▶ SIMULATING'
            : '■ SIMULATION COMPLETE'}
        </strong>

        <strong>
          +{Math.round(progress * 30)} min
        </strong>
      </div>


      {/* Progress bar */}

      <div
        style={{
          width: '100%',
          height: '8px',
          background: '#333',
          borderRadius: '999px',
          overflow: 'hidden',
          marginTop: '12px',
          marginBottom: '14px',
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',

            background:
              result.success
                ? '#69e39d'
                : '#ff5757',

            transition:
              'width 0.15s linear',
          }}
        />
      </div>


      {/* Playback events */}

      {visibleEvents.map(
        (event, index) => (

          <div
            key={`${event.minute}-${index}`}
            style={{
              display: 'grid',
              gridTemplateColumns:
                '50px 1fr',
              gap: '8px',
              marginTop: '8px',
              fontSize: '13px',
            }}
          >

            <strong
              style={{
                opacity: 0.55,
              }}
            >
              {String(event.minute).padStart(
                2,
                '0'
              )}
              :00
            </strong>

            <span>
              {event.text}
            </span>

          </div>

        )
      )}


      {/* Final outcome */}

      {!running && (
        <div
          style={{
            marginTop: '16px',
            paddingTop: '14px',
            borderTop:
              '1px solid #444',
          }}
        >

          <strong
            style={{
              color:
                result.success
                  ? '#69e39d'
                  : '#ff5757',
            }}
          >
            {result.success
              ? 'PROJECTED OUTCOME'
              : 'ACTION BLOCKED'}
          </strong>


          <p
            style={{
              marginTop: '8px',
              marginBottom: '10px',
            }}
          >
            {result.message}
          </p>


          {result.consequences.map(
            (item, index) => (

              <div
                key={index}
                style={{
                  fontSize: '13px',
                  marginTop: '6px',
                  opacity: 0.85,
                }}
              >
                → {item}
              </div>

            )
          )}

        </div>
      )}

    </div>
  )
}


// ============================================================
// PRIORITY DISPLAY
// ============================================================

function PriorityDisplay({ priority }) {
  if (!priority) {
    return null
  }


  let levelColor = '#69e39d'

  if (priority.level === 'MEDIUM') {
    levelColor = '#ffd166'
  }

  if (priority.level === 'HIGH') {
    levelColor = '#ff9f43'
  }

  if (priority.level === 'CRITICAL') {
    levelColor = '#ff5757'
  }


  return (
    <div
      style={{
        marginTop: '14px',
        paddingTop: '14px',
        borderTop:
          '1px solid rgba(255,255,255,0.18)',
      }}
    >

      {/* SCORE + LEVEL */}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '12px',
        }}
      >

        <div>

          <div
            style={{
              fontSize: '11px',
              opacity: 0.65,
              marginBottom: '3px',
              letterSpacing: '0.5px',
            }}
          >
            URGENCY PRIORITY
          </div>


          <strong
            style={{
              fontSize: '26px',
            }}
          >
            {priority.score}

            <span
              style={{
                fontSize: '13px',
                opacity: 0.6,
              }}
            >
              {' '}/ 100
            </span>

          </strong>

        </div>


        <strong
          style={{
            color: levelColor,
          }}
        >
          {priority.level}
        </strong>

      </div>


      {/* SCORE BAR */}

      <div
        style={{
          width: '100%',
          height: '7px',
          background: '#2b2b2b',
          borderRadius: '999px',
          overflow: 'hidden',
          marginTop: '9px',
        }}
      >

        <div
          style={{
            width: `${priority.score}%`,
            height: '100%',
            background: levelColor,
            borderRadius: '999px',
          }}
        />

      </div>


      {/* SCORE BREAKDOWN */}

      {priority.reasons.length > 0 && (
        <div
          style={{
            marginTop: '12px',
          }}
        >

          <div
            style={{
              fontSize: '11px',
              opacity: 0.6,
              marginBottom: '6px',
              letterSpacing: '0.5px',
            }}
          >
            WHY THIS SCORE
          </div>


          {priority.reasons.map(
            (reason) => (

              <div
                key={reason.factor}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '10px',
                  fontSize: '12px',
                  marginTop: '5px',
                }}
              >

                <span
                  style={{
                    textTransform: 'capitalize',
                  }}
                >
                  {reason.factor
                    .replaceAll('_', ' ')
                    .toLowerCase()}
                </span>


                <strong>
                  +{reason.points}
                </strong>

              </div>

            )
          )}

        </div>
      )}

    </div>
  )
}


// ============================================================
// INFO PANEL
// ============================================================

function InfoPanel({
  selectedContainer,
}) {
  const [
    selectedAction,
    setSelectedAction,
  ] = useState(null)

  const [
    simulationResult,
    setSimulationResult,
  ] = useState(null)

  const [
    running,
    setRunning,
  ] = useState(false)

  const [
    progress,
    setProgress,
  ] = useState(0)

  const [
    visibleEvents,
    setVisibleEvents,
  ] = useState([])


  // Reset when another container is clicked

  useEffect(() => {
    setSelectedAction(null)
    setSimulationResult(null)
    setRunning(false)
    setProgress(0)
    setVisibleEvents([])
  }, [selectedContainer?.containerNumber])


  const simulationContainer =
    selectedContainer
      ? getSimulationContainer(
          selectedContainer
        )
      : null


  const assessment =
    simulationContainer
      ? assessContainer(
          simulationContainer
        )
      : null


  const needsInvestigation =
    assessment?.needsInvestigation === true


  // ==========================================================
  // PRIORITY MODEL
  // ==========================================================

  const priority =
    simulationContainer
      ? calculatePriority(
          simulationContainer
        )
      : null


  // ==========================================================
  // RUN SIMULATION
  // ==========================================================

  function runSimulation() {

    if (
      !simulationContainer ||
      !needsInvestigation ||
      !selectedAction ||
      running
    ) {
      return
    }


    const result =
      simulateAction(
        simulationContainer,
        initialPortState,
        selectedAction
      )


    setSimulationResult(result)
    setRunning(true)
    setProgress(0)
    setVisibleEvents([])


    // 30 simulated minutes = 4.5 real seconds

    const totalDuration = 4500
    const startTime = Date.now()


    const timer =
      setInterval(() => {

        const elapsed =
          Date.now() - startTime


        const nextProgress =
          Math.min(
            elapsed / totalDuration,
            1
          )


        const simulatedMinute =
          nextProgress * 30


        setProgress(nextProgress)


        setVisibleEvents(
          result.playback.filter(
            (event) =>
              event.minute <=
              simulatedMinute
          )
        )


        if (nextProgress >= 1) {

          clearInterval(timer)

          setRunning(false)

          setVisibleEvents(
            result.playback
          )
        }

      }, 100)
  }


  // ==========================================================
  // NOTHING SELECTED
  // ==========================================================

  if (!selectedContainer) {
    return (
      <div className="info-panel empty-panel">
        <p>
          Click one of the containers on the ship.
        </p>
      </div>
    )
  }


  const eta =
    new Date(
      selectedContainer.eta
    ).toLocaleDateString(
      'en-US',
      {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }
    )


  return (
    <div className="info-panel">


      {/* ======================================================
          ALERT + URGENCY SCORE
          ====================================================== */}

      {needsInvestigation && (
        <div
          style={{
            background: '#3b1111',
            border:
              '1px solid #ff4d4d',
            borderRadius: '8px',
            padding: '14px',
            marginBottom: '16px',
          }}
        >

          <strong
            style={{
              color: '#ff5757',
            }}
          >
            🚨 INTERVENTION REQUIRED
          </strong>


          <p
            style={{
              marginTop: '8px',
              marginBottom: '4px',
              fontWeight: 600,
            }}
          >
            {assessment.alerts[0]?.title}
          </p>


          <p
            style={{
              margin: 0,
              fontSize: '13px',
              opacity: 0.8,
            }}
          >
            {assessment.alerts[0]?.message}
          </p>


          {/* PRIORITY MODEL OUTPUT */}

          <PriorityDisplay
            priority={priority}
          />

        </div>
      )}


      {/* ======================================================
          CONTAINER INFO
          ====================================================== */}

      <div className="status-row">
        <span className="status-dot" />

        {needsInvestigation
          ? 'INVESTIGATION REQUIRED'
          : selectedContainer.status
              .replace('_', ' ')
              .toUpperCase()}
      </div>


      <h2>
        {selectedContainer.containerNumber}
      </h2>


      <div className="data-row">
        <span>Carrier</span>

        <strong>
          {selectedContainer.carrier}
        </strong>
      </div>


      <div className="data-row">
        <span>Vessel</span>

        <strong>
          {selectedContainer.vessel}
        </strong>
      </div>


      <div className="data-row">
        <span>Voyage</span>

        <strong>
          {selectedContainer.voyage}
        </strong>
      </div>


      <div className="data-row">
        <span>Origin</span>

        <strong>
          {selectedContainer.origin}
        </strong>
      </div>


      <div className="data-row">
        <span>Destination</span>

        <strong>
          {selectedContainer.destination}
        </strong>
      </div>


      <div className="data-row">
        <span>Terminal</span>

        <strong>
          {selectedContainer.terminal}
        </strong>
      </div>


      <div className="data-row">
        <span>Equipment</span>

        <strong>
          {selectedContainer.equipment.length}'{' '}
          {selectedContainer.equipment.height.replace(
            '_',
            ' '
          )}
        </strong>
      </div>


      <div className="data-row">
        <span>ETA</span>

        <strong>
          {eta}
        </strong>
      </div>


      <div className="divider" />


      <div className="data-row">
        <span>Pickup</span>

        <strong className="muted">
          {selectedContainer.availableForPickup
            ? 'Available'
            : 'Not available'}
        </strong>
      </div>


      <div className="data-row">
        <span>Last Free Day</span>

        <strong className="muted">
          {selectedContainer.pickupLfd ??
            'Not available yet'}
        </strong>
      </div>


      <div className="data-row">
        <span>Holds</span>

        <strong>
          {selectedContainer.holds.length === 0
            ? 'None reported'
            : selectedContainer.holds.length}
        </strong>
      </div>


      <div className="data-row">
        <span>Fees</span>

        <strong>
          ${selectedContainer.feesTotal}
        </strong>
      </div>


      <div className="divider" />


      <div className="data-row">
        <span>Latest Event</span>

        <strong>
          {selectedContainer.latestEvent.name}
        </strong>
      </div>


      <div className="data-row">
        <span>Event Location</span>

        <strong>
          {selectedContainer.latestEvent.location}
        </strong>
      </div>


      <div className="data-row">
        <span>Source</span>

        <strong>
          {selectedContainer.latestEvent.source}
        </strong>
      </div>


      {/* ======================================================
          ALERT-SPECIFIC DATA + DECISIONS
          ====================================================== */}

      {needsInvestigation && (
        <>

          <div className="divider" />


          <div className="data-row">
            <span>Carrier Record</span>

            <strong>
              {simulationContainer.scenario
                ?.carrierRecord ?? '—'}
            </strong>
          </div>


          <div className="data-row">
            <span>Terminal Scale</span>

            <strong
              style={{
                color: '#ff5757',
              }}
            >
              {simulationContainer.scenario
                ?.terminalScaleKg
                ?.toLocaleString() ?? '—'}{' '}
              kg
            </strong>
          </div>


          <div className="data-row">
            <span>Scenario Data</span>

            <strong
              style={{
                color: '#ffb347',
              }}
            >
              SIMULATED
            </strong>
          </div>


          {/* ==================================================
              ACTIONS
              ================================================== */}

          <div className="divider" />


          <h3>
            What should we do?
          </h3>


          <p
            style={{
              marginTop: '-4px',
              fontSize: '12px',
              opacity: 0.65,
            }}
          >
            Select an intervention, then simulate
            the next 30 minutes.
          </p>


          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                '1fr 1fr',
              gap: '8px',
              marginTop: '12px',
            }}
          >

            {[
              'SLOW',
              'REROUTE',
              'INSPECT',
              'RELEASE',
            ].map((action) => (

              <ActionButton
                key={action}

                action={action}

                selected={
                  selectedAction === action
                }

                recommended={
                  assessment
                    ?.recommendedAction ===
                  action
                }

                disabled={running}

                onClick={(action) => {

                  setSelectedAction(action)

                  setSimulationResult(null)

                  setProgress(0)

                  setVisibleEvents([])
                }}
              />

            ))}

          </div>


          {/* SIMULATE */}

          <button
            disabled={
              !selectedAction ||
              running
            }

            onClick={runSimulation}

            style={{
              width: '100%',
              marginTop: '12px',
              padding: '14px',

              border: 0,

              borderRadius: '8px',

              background:
                !selectedAction || running
                  ? '#555'
                  : '#f0a646',

              color: '#111',

              fontWeight: 800,

              cursor:
                !selectedAction || running
                  ? 'not-allowed'
                  : 'pointer',

              opacity:
                !selectedAction
                  ? 0.5
                  : 1,
            }}
          >
            {running
              ? 'SIMULATING...'
              : selectedAction
              ? `▶ SIMULATE ${selectedAction} · +30 MIN`
              : 'SELECT AN ACTION'}
          </button>


          {/* PLAYBACK */}

          <Playback
            result={simulationResult}
            running={running}
            progress={progress}
            visibleEvents={visibleEvents}
          />

        </>
      )}


      {/* ======================================================
          NORMAL CONTAINER
          ====================================================== */}

      {!needsInvestigation && (
        <p className="explanation">
          No intervention required. This container
          currently has no detected operational data
          discrepancy requiring investigation.
        </p>
      )}

    </div>
  )
}


// ============================================================
// APP
// ============================================================

export default function App() {

  const [
    selectedContainer,
    setSelectedContainer,
  ] = useState(null)


  return (
    <div className="app">

      <div className="top-bar">

        <div>

          <h1>
            AT THE GATE
          </h1>

          <p>
            Port Operations Simulator
          </p>

        </div>


        <div className="live-badge">
          <span />
          REAL DATA
        </div>

      </div>


      <div className="simulator">

        <div className="canvas-wrapper">

          <Canvas
            camera={{
              position: [10, 8, 12],
              fov: 45,
            }}
          >

            <Scene
              selectedContainer={
                selectedContainer
              }

              setSelectedContainer={
                setSelectedContainer
              }
            />

          </Canvas>


          <div className="ship-label">

            <strong>
              EVER LAUREL
            </strong>

            <span>
              COSCO · Voyage 1241E
            </span>

            <span>
              Tianjinxingang → Los Angeles
            </span>

          </div>

        </div>


        <InfoPanel
          selectedContainer={
            selectedContainer
          }
        />

      </div>

    </div>
  )
}