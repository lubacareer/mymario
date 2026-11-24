import { COURSES, type CourseId } from './courses'

type Times = Partial<Record<CourseId, number>>
type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>
const SAVE_KEY = 'aphelion-run.best-times.v1'

function availableStorage(): SaveStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readTimes(storage: SaveStorage | null): Times {
  const times: Times = {}
  try {
    const raw = storage?.getItem(SAVE_KEY)
    if (!raw) return times
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return times
    // Only a chain of valid clears can unlock the next road.
    for (const { id } of COURSES) {
      const time: unknown = (parsed as Record<string, unknown>)[id]
      if (typeof time !== 'number' || !Number.isFinite(time) || time <= 0) break
      times[id] = time
    }
  } catch {
    // A denied read or an incomplete save starts an in-memory cup.
  }
  return times
}

export function createProgressStore(storage: SaveStorage | null = availableStorage()) {
  const bestTimes = readTimes(storage)
  function isUnlocked(id: CourseId) {
    const index = COURSES.findIndex(course => course.id === id)
    return index === 0 || (index > 0 && bestTimes[COURSES[index - 1].id] !== undefined)
  }
  function recordClear(id: CourseId, seconds: number) {
    if (!isUnlocked(id) || !Number.isFinite(seconds) || seconds <= 0) return
    const saved = readTimes(storage)
    for (const course of COURSES) {
      const time = saved[course.id]
      if (time !== undefined) bestTimes[course.id] = Math.min(bestTimes[course.id] ?? Infinity, time)
    }
    bestTimes[id] = Math.min(bestTimes[id] ?? Infinity, seconds)
    try {
      storage?.setItem(SAVE_KEY, JSON.stringify(bestTimes))
    } catch {
      // Unlocks and records still work for the duration of this visit.
    }
  }
  return { bestTimes, isUnlocked, recordClear }
}
