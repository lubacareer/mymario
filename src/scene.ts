import type { GameState } from './game/simulation';
import { ROUTES, type Platform, type RouteId } from './game/level';
import { loadGraphics } from './graphics';
import { drawCarnivalScenery, drawCarnivalDevices, drawFinale } from './carnival-scene';
import { cameraLayout, courierFrame, islandSlices } from './scene-layout';

type Paint = CanvasRenderingContext2D;
type View = ReturnType<typeof cameraLayout>;

const ATLAS_SCALE = 2;
const POST_OFFICE_HEIGHT = 84;
// Ground contact sits midway down the grass strip (around row 108 of the 320px source).
const SURFACE_IN_IMAGE = 108 / 320;
const TAU = Math.PI * 2;

function drawSky(ctx: Paint, sky: HTMLImageElement, view: View, stageWidth: number, carnival: boolean) {
  const scale = Math.max(view.width / sky.width, view.height / sky.height) * 1.07;
  const width = sky.width * scale;
  const height = sky.height * scale;
  const progress = view.cameraX / Math.max(1, stageWidth - view.width);
  ctx.drawImage(sky, -(width - view.width) * (0.25 + 0.5 * progress), (view.height - height) / 2, width, height);
  if (carnival) return;
  const haze = ctx.createLinearGradient(0, 0, 0, view.height);
  haze.addColorStop(0, 'rgba(239, 249, 231, 0.07)');
  haze.addColorStop(0.72, 'rgba(230, 246, 238, 0.37)');
  haze.addColorStop(1, 'rgba(228, 248, 243, 0.21)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, view.width, view.height);
}

function makeIslandTexture(art: HTMLImageElement, platform: Platform) {
  const width = platform.w;
  const height = Math.round(platform.kind === 'ledge' ? 30 : platform.h * 1.65);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * ATLAS_SCALE);
  canvas.height = height * ATLAS_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('A 2D canvas is required to draw terrain.');
  const parts = islandSlices(width, art.width, height);
  for (const [index, part] of parts.entries()) {
    // Rasterize each join to the same whole pixel on both sides before camera scaling.
    const left = Math.round(part.x * ATLAS_SCALE);
    const right = Math.round((part.x + part.width) * ATLAS_SCALE);
    ctx.save();
    if (index > 0 && index < parts.length - 1 && index % 2 === 0) {
      ctx.translate(right, 0);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(left, 0);
    }
    ctx.drawImage(art, part.sourceX, 0, part.sourceWidth, art.height, 0, 0, right - left, canvas.height);
    ctx.restore();
  }
  return { canvas, height, width };
}

function drawAtFeet(ctx: Paint, image: HTMLImageElement, centerX: number, feetY: number, height: number) {
  const width = image.width / image.height * height;
  ctx.drawImage(image, centerX - width / 2, feetY - height, width, height);
}

function drawShadow(ctx: Paint, x: number, y: number, radius: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, radius, Math.max(1.4, radius * 0.18), 0, 0, TAU);
  ctx.fillStyle = 'rgba(33, 52, 58, 0.20)';
  ctx.fill();
}

function drawCourier(ctx: Paint, image: HTMLImageElement, state: GameState, reducedMotion: boolean) {
  const { player, ticks } = state;
  const x = player.x + player.w / 2;
  const feet = player.y + player.h;
  if (player.grounded) drawShadow(ctx, x, feet + 0.7, player.w * 0.64);
  const frame = courierFrame(player, ticks, reducedMotion);
  // Each pose occupies a square cell in a single horizontal strip.
  const cellSize = image.height;
  const drawSize = player.h * 1.40;
  ctx.save();
  ctx.translate(x, feet);
  ctx.scale(player.facing, 1);
  ctx.drawImage(image, frame * cellSize, 0, cellSize, cellSize, -drawSize / 2, -drawSize, drawSize, drawSize);
  ctx.restore();
}

function drawBeetles(ctx: Paint, image: HTMLImageElement, state: GameState, visible: (x: number) => boolean, time: number) {
  for (const enemy of state.enemies) {
    const x = enemy.x + enemy.w / 2;
    if (!enemy.alive || !visible(x)) continue;
    const feet = enemy.y + enemy.h;
    drawShadow(ctx, x, feet + 0.5, enemy.w * 0.55);
    const phase = Math.sin(time * 10 + x * 0.05);
    ctx.save();
    ctx.translate(x, feet);
    ctx.scale(enemy.vx < 0 ? -1 : 1, 1);
    ctx.rotate(phase * 0.035);
    drawAtFeet(ctx, image, 0, 0, enemy.h * 1.08 + Math.abs(phase) * 0.9);
    ctx.restore();
  }
}

function drawStamps(ctx: Paint, image: HTMLImageElement, state: GameState, visible: (x: number) => boolean, time: number) {
  for (const stamp of state.level.stamps) {
    if (state.collected.has(stamp.id) || !visible(stamp.x)) continue;
    const phase = Math.sin(time * 2.5 + stamp.x * 0.025);
    const y = stamp.y + phase * 1.5;
    ctx.save();
    ctx.translate(stamp.x, y);
    ctx.rotate(phase * 0.08);
    ctx.shadowColor = 'rgba(255, 248, 187, 0.95)';
    ctx.shadowBlur = 4;
    drawAtFeet(ctx, image, 0, 10, 20);
    ctx.restore();
  }
}

function drawCheckpoint(ctx: Paint, image: HTMLImageElement, state: GameState) {
  const { x, y } = state.level.checkpoint;
  drawAtFeet(ctx, image, x, y + 1, 102);
  // The postal pennant changes colour when the courier has checked in.
  ctx.fillStyle = '#665640';
  ctx.fillRect(x + 24, y - 28, 1.8, 28);
  ctx.fillStyle = state.checkpoint ? '#1d8469' : '#ef7756';
  ctx.beginPath();
  ctx.moveTo(x + 25, y - 28);
  ctx.lineTo(x + 39, y - 25);
  ctx.lineTo(x + 25, y - 20);
  ctx.fill();
}

export async function createScene(canvas: HTMLCanvasElement, routeId: RouteId = 'morning') {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('This browser needs Canvas 2D to play Bellwind Post.');
  const art = await loadGraphics(routeId);
  const level = ROUTES[routeId];
  const islands = level.platforms.map(platform => makeIslandTexture(art.island, platform));

  function draw(state: GameState, reducedMotion = false, celebrationSeconds = 0) {
    if (!ctx) return;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (!cssWidth || !cssHeight) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(cssWidth * dpr);
    const height = Math.round(cssHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const view = cameraLayout(cssWidth, cssHeight, state.player.x + state.player.w / 2, level.width);
    ctx.setTransform(width / view.width, 0, 0, height / view.height, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    drawSky(ctx, art.sky, view, level.width, routeId === 'carnival');
    const visible = (x: number) => x >= view.cameraX - 180 && x <= view.cameraX + view.width + 180;
    const time = reducedMotion ? 0 : state.ticks / 60;
    ctx.translate(-view.cameraX, view.offsetY);
    if ('bandstand' in art) {
      drawCarnivalScenery(ctx, art, state, visible, time);
    } else {
      const officeX = level.spawn.x + 60;
      if (visible(officeX)) drawAtFeet(ctx, art['post-office'], officeX, level.spawn.y + 1, POST_OFFICE_HEIGHT);
      if (visible(level.checkpoint.x)) drawCheckpoint(ctx, art.windmill, state);
    }
    if (visible(level.bell.x)) drawAtFeet(ctx, art.bell, level.bell.x, level.bell.y + 1, 67);
    level.platforms.forEach((platform, index) => {
      if (platform.x + platform.w < view.cameraX || platform.x > view.cameraX + view.width) return;
      const texture = islands[index];
      ctx.drawImage(texture.canvas, platform.x, platform.y - texture.height * SURFACE_IN_IMAGE, texture.width, texture.height);
    });
    if ('bandstand' in art) drawCarnivalDevices(ctx, art, state, visible, time);
    drawStamps(ctx, art.stamp, state, visible, time);
    drawBeetles(ctx, art.beetle, state, visible, time);
    drawCourier(ctx, art[state.hero], state, reducedMotion);
    if (routeId === 'carnival' && state.status === 'won') {
      drawFinale(ctx, level.bell, reducedMotion ? 1 : celebrationSeconds);
    }
  }
  return { draw };
}
