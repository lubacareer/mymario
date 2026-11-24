import { topSurfaceAt, type Course, type Surface } from './courses'
import type { RunState } from './simulation'

type Point = { x: number; y: number }
type Project = (x: number, y: number, z: number) => Point
type Vertex = [x: number, y: number, z: number]
type Context = CanvasRenderingContext2D

const PANEL_LENGTH = 6
const VIEW_DISTANCE = 240
const DECK_BOTTOM = -1.25
const HORIZON = 0.415
const WORLDS = {
  dawn: { file: 'dawn-array', focus: 0.27, panels: ['#32405a', '#39475d'], edge: '#ffbc67' },
  iceglass: { file: 'iceglass-relay', focus: 0.68, panels: ['#254659', '#2d5064'], edge: '#b3fbff' },
  ember: { file: 'ember-foundry', focus: 0.3, panels: ['#4d3c53', '#57455b'], edge: '#ffb280' },
}

/** A fixed chase camera keeps the ship's altitude legible against the landing surface. */
export function createProjector(width: number, height: number, shipX: number, shipZ: number): Project {
  const focal = Math.min(height * 1.08, width * 1.05)
  const shipScale = Math.min(height * 0.089, width * 0.105)
  const chaseDistance = focal / shipScale
  const cameraHeight = height * (0.78 - HORIZON) / shipScale
  const cameraX = shipX * 0.79
  return (x, y, z) => {
    const scale = focal / Math.max(0.5, z - shipZ + chaseDistance)
    return { x: width / 2 + (x - cameraX) * scale, y: height * HORIZON + (cameraHeight - y) * scale }
  }
}

function polygon(ctx: Context, color: string, points: Point[]) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.closePath()
  ctx.fill()
}

type Face = (color: string, ...vertices: Vertex[]) => void
function makeFace(ctx: Context, project: Project): Face {
  return (color, ...vertices) => polygon(ctx, color, vertices.map(p => project(...p)))
}

function rect(face: Face, color: string, left: number, right: number, near: number, far: number, y: number) {
  face(color, [left, y, far], [right, y, far], [right, y, near], [left, y, near])
}

interface Panel {
  surface: Surface
  near: number
  far: number
  jumpMark: boolean
}

/** Split at every physical edge before depth sorting so barriers and forks occlude correctly. */
function buildPanels(course: Course): Panel[] {
  const limits = new Set(course.surfaces.flatMap(s => [s.zMin, s.zMax]))
  for (let z = 0; z < course.length + PANEL_LENGTH; z += PANEL_LENGTH) limits.add(z)
  const depths = [...limits].sort((a, b) => b - a)
  const panels: Panel[] = []
  const surfaces = [...course.surfaces].sort((a, b) => a.height - b.height)
  for (let i = 1; i < depths.length; i++) {
    const [near, far] = [depths[i], depths[i - 1]]
    for (const surface of surfaces) {
      if (near < surface.zMin || far > surface.zMax) continue
      const x = (surface.xMin + surface.xMax) / 2
      const jumpMark = surface.kind === 'road' && far === surface.zMax && near < course.length &&
        !topSurfaceAt(course, x, surface.zMax + 0.01)
      panels.push({ surface, near, far, jumpMark })
    }
  }
  return panels
}

function drawBarrier(face: Face, s: Surface, near: number, far: number) {
  const { xMin: l, xMax: r, height: h } = s
  face('#682c30', [l, 0, near], [l, 0, far], [l, h, far], [l, h, near])
  face('#482837', [r, 0, near], [r, 0, far], [r, h, far], [r, h, near])
  rect(face, '#ff9775', l, r, near, far, h)
  if (near !== s.zMin) return
  face('#903e42', [l, 0, near], [r, 0, near], [r, h, near], [l, h, near])
  face('#ffc195', [l, h - 0.14, near], [r, h - 0.14, near], [r, h, near], [l, h, near])
  // High-contrast warning slashes stay recognizable on both sunset and blue ice.
  for (let x = l + 0.18; x + 0.8 < r; x += 1) {
    face('#ffce8a', [x, 0.72, near], [x + 0.36, 0.72, near],
      [x + 0.84, 1.55, near], [x + 0.48, 1.55, near])
  }
}

function drawPanel(face: Face, panel: Panel, near: number, course: Course) {
  const { surface: s, far } = panel
  if (s.kind === 'barrier') return drawBarrier(face, s, near, far)
  const { xMin: l, xMax: r, height: h } = s
  const world = WORLDS[course.id]
  const supply = s.kind === 'supply'
  const center = (l + r) / 2
  face('#172538', [l, DECK_BOTTOM, near], [l, DECK_BOTTOM, far], [l, h, far], [l, h, near])
  face('#122134', [r, DECK_BOTTOM, near], [r, DECK_BOTTOM, far], [r, h, far], [r, h, near])
  if (near === s.zMin) {
    face('#182132', [l, DECK_BOTTOM, near], [r, DECK_BOTTOM, near], [r, h, near], [l, h, near])
    face(world.edge, [l, h - 0.1, near], [r, h - 0.1, near], [r, h, near], [l, h, near])
    for (let x = l + 0.4; x + 0.8 < r; x += 1.25) {
      face('#3a4758', [x, h - 0.7, near], [x + 0.65, h - 0.7, near],
        [x + 0.84, h - 0.42, near], [x + 0.19, h - 0.42, near])
    }
  }
  const n = Math.floor(near / PANEL_LENGTH)
  rect(face, supply ? '#187f7b' : world.panels[n % 2], l, r, near, far, h)
  rect(face, '#a2b4b5', l, l + 0.11, near, far, h)
  rect(face, '#a2b4b5', r - 0.11, r, near, far, h)
  // Recessed strips just inside the edge lights give passing panels a visible cadence.
  rect(face, '#243448', l + 0.13, l + 0.56, near, far, h)
  rect(face, '#243448', r - 0.56, r - 0.13, near, far, h)
  if (near % PANEL_LENGTH === 0) {
    rect(face, '#162c3d', l + 0.11, r - 0.11, near, Math.min(far, near + 0.065), h)
    for (const x of [l + 0.28, r - 0.47]) {
      rect(face, world.edge, x, x + 0.19, near + 0.1, Math.min(far, near + 2.1), h)
    }
  }
  for (let x = Math.ceil((l + 0.3) / 3) * 3; x < r - 0.3; x += 3) {
    rect(face, '#233346', x - 0.016, x + 0.016, near, far, h)
  }
  if (supply && near % PANEL_LENGTH === 0 && far - near >= 2) {
    rect(face, '#b5ffdb', center - 0.18, center + 0.18, near + 0.35, near + 1.95, h)
    rect(face, '#b5ffdb', center - 0.68, center + 0.68, near + 0.92, near + 1.38, h)
  }
  if (panel.jumpMark) {
    const z = far - 0.45
    const span = Math.min(1.1, (r - l) * 0.2)
    for (const x of [center - span, center + span]) {
      face(world.edge, [x - span * 0.65, h, z - 1.75], [x, h, z - 1.1], [x + span * 0.65, h, z - 1.75],
        [x + span * 0.65, h, z - 1.19], [x, h, z - 0.54], [x - span * 0.65, h, z - 1.19])
    }
  }
  // A checkered stripe spans the actual finish deck, including the off-centre Ember landing.
  if (near < course.length && far > course.length - 2) {
    for (let x = l, i = 0; x < r; x++, i++) {
      for (let row = 0; row < 2; row++) {
        const z = course.length - 2 + row
        const start = Math.max(near, z), end = Math.min(far, z + 1)
        if (start < end) rect(face, (i + row) % 2 ? '#243447' : '#fbecd5', x, Math.min(x + 1, r), start, end, h)
      }
    }
  }
}

function drawShadow(face: Face, run: RunState) {
  const deck = topSurfaceAt(run.course, run.x, run.z)
  if (!deck || deck.height > run.y + 0.01) return
  const radius = Math.max(0.58, 1 - (run.y - deck.height) * 0.09)
  const outline: Vertex[] = []
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8
    const x = run.x + Math.cos(angle) * radius * 1.35
    const z = run.z + Math.sin(angle) * radius * 1.63
    outline.push([Math.max(deck.xMin, Math.min(deck.xMax, x)), deck.height, Math.max(deck.zMin, Math.min(deck.zMax, z))])
  }
  face('rgba(4,10,31,.45)', ...outline)
}

/** Original delta-wing courier. All vertices are in metres relative to the landing skid. */
function drawShip(ctx: Context, project: Project, run: RunState) {
  const shipFace = makeFace(ctx, (x, y, z) => project(run.x + x, run.y + y + 0.13, run.z + z))
  const plume = 0.75 + run.speed * 0.025 + Math.sin(run.elapsed * 59) * 0.09
  for (const side of [-1, 1]) {
    const face: Face = (color, ...points) => shipFace(color, ...points.map(([x, y, z]): Vertex => [side * x, y, z]))
    face('rgba(76,211,255,.33)', [0.52, 0.28, -1.13], [1.02, 0.28, -1.13], [0.77, 0.13, -1.5 - plume])
    face('#5ce1ff', [0.59, 0.28, -1.13], [0.95, 0.28, -1.13], [0.77, 0.18, -1.31 - plume * 0.73])
    face('#e4fbff', [0.66, 0.28, -1.12], [0.88, 0.28, -1.12], [0.77, 0.2, -1.27 - plume * 0.42])
    // Swept foil and its dark trailing face.
    face('#15263d', [0.15, 0.3, 1.64], [1.55, 0.03, -1.4], [0.67, 0.03, -1.28], [0.18, 0.24, -0.57])
    face('#9cafba', [0.16, 0.34, 1.64], [1.55, 0.14, -1.24], [1.55, 0.03, -1.4])
    face(side > 0 ? '#dad9c8' : '#f6e8c9',
      [0.16, 0.34, 1.64], [1.55, 0.14, -1.24], [0.69, 0.18, -1.08], [0.28, 0.43, -0.48])
    face('#df633d', [0.57, 0.31, 0.73], [0.68, 0.28, 0.52], [1.28, 0.17, -1.18], [1.05, 0.2, -1.13])
    // Twin nacelles and split engine bells.
    face('#526b7d', [0.5, 0.25, 0.42], [0.98, 0.18, -0.91], [0.96, 0.15, -1.26], [0.5, 0.15, -1.21])
    face('#d8d7c9', [0.5, 0.25, 0.42], [0.68, 0.56, -0.63], [0.92, 0.44, -1.14], [0.54, 0.43, -1.12])
    face('#30465e', [0.53, 0.39, -1.16], [0.60, 0.47, -1.16], [0.86, 0.47, -1.16],
      [0.94, 0.38, -1.16], [0.94, 0.21, -1.23], [0.85, 0.15, -1.25], [0.59, 0.15, -1.25], [0.51, 0.22, -1.22])
    face('#70d4e9', [0.59, 0.33, -1.18], [0.64, 0.39, -1.18], [0.83, 0.39, -1.18],
      [0.89, 0.32, -1.19], [0.87, 0.25, -1.23], [0.60, 0.25, -1.22])
    face('#ddfcfa', [0.64, 0.31, -1.21], [0.83, 0.31, -1.21], [0.81, 0.26, -1.23], [0.64, 0.26, -1.23])
    // Canted stabilizers extend from each nacelle, exposing their different lit faces.
    face(side > 0 ? '#9eacb5' : '#dedcca',
      [0.68, 0.48, -0.62], [0.84, 0.93, -0.88], [0.91, 0.97, -1.13], [0.8, 0.46, -1.06])
    face('#e06b47', [0.81, 0.84, -0.84], [0.84, 0.93, -0.88], [0.91, 0.97, -1.13], [0.88, 0.88, -1.12])
    // Long faceted body and canopy spine.
    face(side > 0 ? '#c3c9c5' : '#fff1d7',
      [0, 0.47, 2.02], [0.32, 0.38, 0.37], [0.35, 0.31, -0.96], [0, 0.64, -0.72])
    face(side > 0 ? '#244c62' : '#438ba3',
      [0, 0.56, 1.05], [0.23, 0.52, 0.13], [0.24, 0.53, -0.44], [0, 0.86, -0.24])
    face(side > 0 ? '#527485' : '#97c6cd', [0.24, 0.53, -0.44], [0, 0.72, -0.52], [0, 0.86, -0.24])
    face('#cf5439', [0, 0.63, -0.72], [0.35, 0.31, -0.96], [0.32, 0.16, -1.02], [0, 0.31, -1.1])
  }
}

function backdrop(ctx: Context, image: HTMLImageElement, width: number, height: number, course: Course, run: RunState) {
  ctx.fillStyle = '#20324c'
  ctx.fillRect(0, 0, width, height)
  if (!image.complete || !image.naturalWidth) return
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * 1.035
  const w = image.naturalWidth * scale, h = image.naturalHeight * scale
  const parallax = Math.max(-1, Math.min(1, run.x / 10)) * width * 0.012
  const left = Math.min(0, Math.max(width - w, (width - w) * WORLDS[course.id].focus - parallax))
  ctx.drawImage(image, left, (height - h) / 2, w, h)
}

export function createScene(canvas: HTMLCanvasElement): (course: Course, run: RunState) => void {
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Canvas 2D is required for Aphelion Run.')
  const images = new Map<string, HTMLImageElement>()
  const panels = new WeakMap<Course, Panel[]>()
  return (course, run) => {
    let image = images.get(course.id)
    if (!image) {
      image = new Image()
      image.src = `${import.meta.env.BASE_URL}art/aphelion/${WORLDS[course.id].file}.webp`
      images.set(course.id, image)
    }
    let deck = panels.get(course)
    if (!deck) {
      deck = buildPanels(course)
      panels.set(course, deck)
    }
    const width = canvas.clientWidth, height = canvas.clientHeight
    if (!width || !height) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pixelsWide = Math.round(width * dpr), pixelsHigh = Math.round(height * dpr)
    if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
      canvas.width = pixelsWide
      canvas.height = pixelsHigh
    }
    ctx.setTransform(pixelsWide / width, 0, 0, pixelsHigh / height, 0, 0)
    backdrop(ctx, image, width, height, course, run)
    const project = createProjector(width, height, run.x, run.z)
    const face = makeFace(ctx, project)
    const nearLimit = run.z - 6
    for (const panel of deck) {
      if (panel.far <= nearLimit || panel.near > run.z + VIEW_DISTANCE) continue
      drawPanel(face, panel, Math.max(panel.near, nearLimit), course)
    }
    drawShadow(face, run)
    drawShip(ctx, project, run)
  }
}
