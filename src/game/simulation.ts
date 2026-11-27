import { LEVEL, ROUTES, type Level, type Rect, type RouteId } from './level'
import { boothSeals, CARNIVAL_PROPS, floatAt, type Booths } from './carnival'

export { LEVEL }
export const STEP_SECONDS = 1 / 60
export type Hero = 'nia' | 'finn'
export type GameEvent = 'jump' | 'stamp' | 'stomp' | 'hurt' | 'checkpoint' | 'victory' | 'gameover'
  | 'drum' | 'ribbon' | 'lantern'
type Direction = -1 | 0 | 1

export interface InputFrame {
  direction: Direction
  jumpPressed: boolean
  jumpHeld: boolean
}

interface Player extends Rect {
  vx: number
  vy: number
  grounded: boolean
  facing: -1 | 1
  coyoteTicks: number
  bufferTicks: number
  cutJump: boolean
}

interface Enemy extends Rect {
  id: string
  alive: boolean
  vx: number
  left: number
  right: number
}

export interface GameState {
  level: Level
  booths: Booths
  hero: Hero
  status: 'playing' | 'won' | 'lost'
  lives: number
  checkpoint: boolean
  collected: Set<string>
  player: Player
  enemies: Enemy[]
  ticks: number
}

const RUN_SPEED = 240
const ACCELERATION = 1600
const BRAKING = 2000
const GRAVITY = 980
const FULL_JUMP = Math.sqrt(2 * GRAVITY * 80)
const CUT_JUMP = 205
const STOMP_BOUNCE = 250
const GRACE_TICKS = Math.round(0.1 / STEP_SECONDS)
const PLAYER_WIDTH = 22
const PLAYER_HEIGHT = 32
const BEETLE_WIDTH = 26
const BEETLE_HEIGHT = 19
const STAMP_RADIUS = 8
const DRUM_BOUNCE = 520
const carnivalGround = [...ROUTES.carnival.platforms, CARNIVAL_PROPS.drum, ...CARNIVAL_PROPS.lanterns]
const carnivalClosed = [...carnivalGround, CARNIVAL_PROPS.gate]

function spawnPlayer(point: { x: number; y: number }): Player {
  return {
    x: point.x - PLAYER_WIDTH / 2, y: point.y - PLAYER_HEIGHT,
    w: PLAYER_WIDTH, h: PLAYER_HEIGHT, vx: 0, vy: 0, facing: 1,
    grounded: true, coyoteTicks: GRACE_TICKS, bufferTicks: 0, cutJump: false,
  }
}

function spawnEnemies(level: Level): Enemy[] {
  return level.patrols.map(({ id, left, right, floorY, speed }) => ({
    id, left, right, x: left, y: floorY - BEETLE_HEIGHT,
    vx: speed, w: BEETLE_WIDTH, h: BEETLE_HEIGHT, alive: true,
  }))
}

export function createGame(hero: Hero, routeId: RouteId = 'morning'): GameState {
  const level = ROUTES[routeId]
  return {
    level, booths: { drum: false, ribbons: new Set(), lanterns: new Set() },
    hero, status: 'playing', lives: 3, checkpoint: false, collected: new Set(),
    player: spawnPlayer(level.spawn), enemies: spawnEnemies(level), ticks: 0,
  }
}

function overlapsX(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x
}

function overlapsY(a: Rect, b: Rect) {
  return a.y < b.y + b.h && a.y + a.h > b.y
}

function moveHorizontal(p: Player, direction: Direction, width: number, solids: readonly Rect[]) {
  const target = direction * RUN_SPEED
  const change = (direction === 0 ? BRAKING : ACCELERATION) * STEP_SECONDS
  p.vx += Math.max(-change, Math.min(change, target - p.vx))
  if (direction !== 0) p.facing = direction
  p.x = Math.max(0, Math.min(width - p.w, p.x + p.vx * STEP_SECONDS))
  for (const block of solids) {
    if (!overlapsX(p, block) || !overlapsY(p, block)) continue
    if (p.vx > 0) p.x = block.x - p.w
    if (p.vx < 0) p.x = block.x + block.w
    p.vx = 0
  }
}

function beginJump(p: Player, input: InputFrame, events: GameEvent[]) {
  if (input.jumpPressed) p.bufferTicks = GRACE_TICKS + 1
  if (p.grounded) p.coyoteTicks = GRACE_TICKS
  if (p.bufferTicks > 0 && (p.grounded || p.coyoteTicks > 0)) {
    p.vy = -FULL_JUMP
    p.grounded = false
    p.cutJump = true
    p.coyoteTicks = 0
    p.bufferTicks = 0
    events.push('jump')
  }
  if (p.cutJump && !input.jumpHeld) {
    p.vy = Math.max(p.vy, -CUT_JUMP)
    p.cutJump = false
  }
  if (p.bufferTicks > 0) p.bufferTicks--
  if (!p.grounded && p.coyoteTicks > 0) p.coyoteTicks--
}

function moveVertical(p: Player, solids: readonly Rect[], float?: Rect) {
  const previousTop = p.y
  const previousSpeed = p.vy
  p.vy += GRAVITY * STEP_SECONDS
  p.y += (previousSpeed + p.vy) * 0.5 * STEP_SECONDS
  p.grounded = false

  let landed: Rect | undefined
  for (const block of solids) {
    if (!overlapsX(p, block)) continue
    if (p.vy > 0 && previousTop + p.h <= block.y && p.y + p.h >= block.y) {
      p.y = block.y - p.h
      p.vy = 0
      p.grounded = true
      p.cutJump = false
      landed = block
    } else if (p.vy < 0 && previousTop >= block.y + block.h && p.y <= block.y + block.h) {
      p.y = block.y + block.h
      p.vy = 0
    }
  }
  // The parade deck is one-way so players can board it from the return walkway below.
  if (float && overlapsX(p, float) && p.vy > 0 && previousTop + p.h <= float.y && p.y + p.h >= float.y) {
    p.y = float.y - p.h
    p.vy = 0
    p.grounded = true
    p.cutJump = false
    landed = float
  }
  return landed
}

function patrol(enemy: Enemy) {
  enemy.x += enemy.vx * STEP_SECONDS
  if (enemy.x >= enemy.right || enemy.x <= enemy.left) {
    enemy.x = Math.max(enemy.left, Math.min(enemy.right, enemy.x))
    enemy.vx *= -1
  }
}

function loseLife(state: GameState, events: GameEvent[]) {
  state.lives--
  events.push('hurt')
  if (state.lives === 0) {
    state.status = 'lost'
    events.push('gameover')
  } else {
    state.player = spawnPlayer(state.checkpoint ? state.level.checkpoint : state.level.spawn)
    state.enemies = spawnEnemies(state.level)
  }
}

function contactEnemies(state: GameState, previousBottom: number, events: GameEvent[]) {
  const p = state.player
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue
    patrol(enemy)
    if (!overlapsX(p, enemy) || !overlapsY(p, enemy)) continue
    if (previousBottom <= enemy.y && p.vy > 0) {
      enemy.alive = false
      p.y = enemy.y - p.h
      p.vy = -STOMP_BOUNCE
      p.cutJump = false
      p.coyoteTicks = 0
      events.push('stomp')
    } else {
      loseLife(state, events)
      return true
    }
  }
  return false
}

function touchesPickup(p: Player, item: { x: number; y: number }) {
  const dx = Math.max(p.x - item.x, item.x - p.x - p.w, 0)
  const dy = Math.max(p.y - item.y, item.y - p.y - p.h, 0)
  return dx * dx + dy * dy <= STAMP_RADIUS * STAMP_RADIUS
}

function visitBooths(state: GameState, landed: Rect | undefined, events: GameEvent[]) {
  if (landed === CARNIVAL_PROPS.drum) {
    state.booths.drum = true
    state.player.vy = -DRUM_BOUNCE
    state.player.grounded = false
    state.player.cutJump = false
    state.player.coyoteTicks = 0
    events.push('drum')
  }
  for (const lantern of CARNIVAL_PROPS.lanterns) {
    if (landed === lantern && !state.booths.lanterns.has(lantern.id)) {
      state.booths.lanterns.add(lantern.id)
      events.push('lantern')
    }
  }
  for (const ribbon of CARNIVAL_PROPS.ribbons) {
    if (!state.booths.ribbons.has(ribbon.id) && touchesPickup(state.player, ribbon)) {
      state.booths.ribbons.add(ribbon.id)
      events.push('ribbon')
    }
  }
}

function collectAndDeliver(state: GameState, events: GameEvent[]) {
  const p = state.player
  const level = state.level
  for (const stamp of level.stamps) {
    if (!state.collected.has(stamp.id) && touchesPickup(p, stamp)) {
      state.collected.add(stamp.id)
      events.push('stamp')
    }
  }
  const centreX = p.x + p.w / 2
  if (!state.checkpoint && centreX >= level.checkpoint.x && p.y + p.h <= level.checkpoint.y) {
    state.checkpoint = true
    events.push('checkpoint')
  }
  if (centreX >= level.bell.x && p.y + p.h <= level.bell.y
    && (level.id === 'morning' || boothSeals(state.booths) === 3)) {
    state.status = 'won'
    events.push('victory')
  }
}

/** Advances exactly one fixed tick; jumpPressed is an edge, jumpHeld a level. */
export function stepGame(state: GameState, input: InputFrame): GameEvent[] {
  const events: GameEvent[] = []
  if (state.status !== 'playing') return events
  state.ticks++
  const player = state.player
  let solids: readonly Rect[] = state.level.platforms
  let float: Rect | undefined
  if (state.level.id === 'carnival') {
    solids = boothSeals(state.booths) === 3 ? carnivalGround : carnivalClosed
    float = floatAt(state.ticks)
    const prior = floatAt(state.ticks - 1)
    if (player.grounded && player.y + player.h === prior.y && overlapsX(player, prior)) {
      player.x += float.x - prior.x
    }
  }
  const previousBottom = player.y + player.h
  beginJump(player, input, events)
  moveHorizontal(player, input.direction, state.level.width, solids)
  const landed = moveVertical(player, solids, float)
  if (state.level.id === 'carnival') visitBooths(state, landed, events)
  if (player.y > state.level.height + player.h) {
    loseLife(state, events)
    return events
  }
  if (!contactEnemies(state, previousBottom, events)) collectAndDeliver(state, events)
  return events
}
