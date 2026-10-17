// Sample rates and assumptions. Every number here is labelled "sample" in the UI.

export const RATES = {
  demurrageEarly: 150, // per day, days 1–4 past the deadline
  demurrageLate: 300, // per day, after day 4
  storage: 75, // per day, extended dwell
  truckHour: 90, // per hour a truck waits beyond a normal turn
  normalTurnHours: 1, // a normal gate turn; waiting beyond this is counted
  abandonAfterHours: 4, // drivers leave (hours-of-service, next job)
  wastedTrip: 90, // a truck that came for a box it can't take
  reschedule: 60, // rebooking an appointment to a later slot
  inspectionMove: 185, // yard move to the inspection bay incl. dig moves
  reeferTech: 240,
  heavyEquipment: 120,
  laneThroughput: 15, // truck transactions per lane per hour
  spoilageDevC: 6, // °C above setpoint where cargo counts as at risk
}

/** Exam fees are set by CBP / USDA and billed to the importer in every scenario, so they're
 *  shown for context but left out of the plan comparison. */
export const EXAM_FEES: Record<string, number> = { customs: 1100, VACIS: 350, USDA: 450 }

export const usd = (n: number) =>
  n >= 10_000 ? `$${(n / 1000).toFixed(n >= 100_000 || n % 1000 === 0 ? 0 : 1)}k` : `$${Math.round(n).toLocaleString('en-US')}`
export const usdFull = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
export const kg = (n: number) => `${Math.round(n).toLocaleString('en-US')} kg`
export const lbsToKg = (lbs: number) => lbs * 0.45359237
