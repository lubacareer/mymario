import { LEVEL, type Rect } from './level'

export { LEVEL }
export const STEP_SECONDS = 1 / 60
export type Hero = 'nia' | 'finn'
export type GameEvent = 'jump' | 'stamp' | 'stomp' | 'hurt' | 'checkpoint' | 'victory' | 'gameover'
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

function spawnPlayer(point: { x: number; y: number }): Player {
  return {
    x: point.x - PLAYER_WIDTH / 2, y: point.y - PLAYER_HEIGHT,
    w: PLAYER_WIDTH, h: PLAYER_HEIGHT, vx: 0, vy: 0, facing: 1,
    grounded: true, coyoteTicks: GRACE_TICKS, bufferTicks: 0, cutJump: false,
  }
}

function spawnEnemies(): Enemy[] {
  return LEVEL.patrols.map(({ id, left, right, floorY, speed }) => ({
    id, left, right, x: left, y: floorY - BEETLE_HEIGHT,
    vx: speed, w: BEETLE_WIDTH, h: BEETLE_HEIGHT, alive: true,
  }))
}

export function createGame(hero: Hero): GameState {
  return {
    hero, status: 'playing', lives: 3, checkpoint: false, collected: new Set(),
    player: spawnPlayer(LEVEL.spawn), enemies: spawnEnemies(), ticks: 0,
  }
}

function overlapsX(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x
}

function overlapsY(a: Rect, b: Rect) {
  return a.y < b.y + b.h && a.y + a.h > b.y
}

function moveHorizontal(p: Player, direction: Direction) {
  const target = direction * RUN_SPEED
  const change = (direction === 0 ? BRAKING : ACCELERATION) * STEP_SECONDS
  p.vx += Math.max(-change, Math.min(change, target - p.vx))
  if (direction !== 0) p.facing = direction
  p.x = Math.max(0, Math.min(LEVEL.width - p.w, p.x + p.vx * STEP_SECONDS))
  for (const block of LEVEL.platforms) {
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

function moveVertical(p: Player) {
  const previousTop = p.y
  const previousSpeed = p.vy
  p.vy += GRAVITY * STEP_SECONDS
  p.y += (previousSpeed + p.vy) * 0.5 * STEP_SECONDS
  p.grounded = false

  for (const block of LEVEL.platforms) {
    if (!overlapsX(p, block)) continue
    if (p.vy > 0 && previousTop + p.h <= block.y && p.y + p.h >= block.y) {
      p.y = block.y - p.h
      p.vy = 0
      p.grounded = true
      p.cutJump = false
    } else if (p.vy < 0 && previousTop >= block.y + block.h && p.y <= block.y + block.h) {
      p.y = block.y + block.h
      p.vy = 0
    }
  }
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
    state.player = spawnPlayer(state.checkpoint ? LEVEL.checkpoint : LEVEL.spawn)
    state.enemies = spawnEnemies()
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

function collectAndDeliver(state: GameState, events: GameEvent[]) {
  const p = state.player
  for (const stamp of LEVEL.stamps) {
    if (state.collected.has(stamp.id)) continue
    const dx = Math.max(p.x - stamp.x, stamp.x - p.x - p.w, 0)
    const dy = Math.max(p.y - stamp.y, stamp.y - p.y - p.h, 0)
    if (dx * dx + dy * dy <= STAMP_RADIUS * STAMP_RADIUS) {
      state.collected.add(stamp.id)
      events.push('stamp')
    }
  }
  const centreX = p.x + p.w / 2
  if (!state.checkpoint && centreX >= LEVEL.checkpoint.x && p.y + p.h <= LEVEL.checkpoint.y) {
    state.checkpoint = true
    events.push('checkpoint')
  }
  if (centreX >= LEVEL.bell.x && p.y + p.h <= LEVEL.bell.y) {
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
  const previousBottom = player.y + player.h
  beginJump(player, input, events)
  moveHorizontal(player, input.direction)
  moveVertical(player)
  if (player.y > LEVEL.height + player.h) {
    loseLife(state, events)
    return events
  }
  if (!contactEnemies(state, previousBottom, events)) collectAndDeliver(state, events)
  return events
}
