import { boothSeals, CARNIVAL_PROPS, floatAt } from './game/carnival';
import type { Rect } from './game/level';
import type { GameState } from './game/simulation';
import type { CarnivalGraphics } from './graphics';

type Paint = CanvasRenderingContext2D;
type Visible = (x: number) => boolean;
const { drum, ribbons, lanterns, gate } = CARNIVAL_PROPS;
const ink = '#49344b';
const gold = '#f4c565';
const flags = ['#e97460', '#f0cd78', '#5cb7b0', '#a593c5'];
const kiteColors = ['#48b8c0', gold, '#f28077'];
const TAU = Math.PI * 2;
const GARLAND_SAG = 18;

function picture(ctx: Paint, art: HTMLImageElement, x: number, bottom: number, height: number) {
  const width = height * art.width / art.height;
  ctx.drawImage(art, x - width / 2, bottom - height, width, height);
}

function star(ctx: Paint, x: number, y: number, radius: number, fill: string) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Suspended between poles behind the course; booth progress colours the lamps.
function garland(ctx: Paint, x: number, ground: number, width: number, lit: boolean, time: number, height = 100) {
  const top = ground - height;
  ctx.fillStyle = '#776068';
  for (const pole of [x, x + width]) {
    ctx.fillRect(pole - 1, top, 2, ground - top);
    ctx.beginPath();
    ctx.arc(pole, top - 2, 3, 0, TAU);
    ctx.fillStyle = gold;
    ctx.fill();
    ctx.fillStyle = '#776068';
  }
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.quadraticCurveTo(x + width / 2, top + GARLAND_SAG * 2, x + width, top);
  ctx.strokeStyle = '#72515d';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  for (let i = 1; i <= 13; i++) {
    const part = i / 14, px = x + part * width, py = top + 4 * GARLAND_SAG * part * (1 - part);
    if (i % 2 === 1) {
      ctx.beginPath();
      ctx.moveTo(px - 4, py);
      ctx.lineTo(px + 4, py);
      ctx.lineTo(px + 1.5 * Math.sin(time * 2 + i), py + 8);
      ctx.closePath();
      ctx.fillStyle = flags[i % flags.length];
      ctx.fill();
    } else {
      ctx.fillStyle = lit ? '#ffedaa' : '#ae8c89';
      ctx.beginPath();
      ctx.ellipse(px, py + 3, 2, lit ? 3.3 : 2.5, 0, 0, TAU);
      ctx.fill();
    }
  }
}

function lanternRow(ctx: Paint, pad: Rect, lit: boolean, time: number) {
  const x = pad.x - 95, width = pad.w + 115, ground = pad.y + pad.h, height = 132;
  garland(ctx, x, ground, width, lit, time, height);
  for (let i = 1; i < 5; i++) {
    const part = i / 5, px = x + part * width, py = ground - height + 4 * GARLAND_SAG * part * (1 - part);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(0.07 * Math.sin(time * 2 + i));
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 16);
    ctx.stroke();
    ctx.fillStyle = lit ? '#ffce6f' : '#7d6981';
    if (lit) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ffd47c';
    }
    ctx.beginPath();
    ctx.ellipse(0, 8, 5.5, 6.5, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = lit ? '#fff1b6' : '#ab9a9a';
    ctx.fillRect(-1, 3, 2, 10);
    ctx.restore();
  }
}

function ribbonLine(ctx: Paint, state: GameState, visible: Visible, time: number) {
  const start = ribbons[0].x - 68, end = ribbons[ribbons.length - 1].x + 70;
  if (!visible(start) && !visible(end) && !visible((start + end) / 2)) return;
  const ground = state.level.checkpoint.y, height = 182;
  garland(ctx, start, ground, end - start, state.booths.ribbons.size === ribbons.length, time, height);
  ribbons.forEach(({ id, x }, i) => {
    if (!state.booths.ribbons.has(id)) return;
    const part = (x - start) / (end - start);
    const y = ground - height + 4 * GARLAND_SAG * part * (1 - part);
    const wave = Math.sin(time * 2.3 + i) * 3;
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x + 6, y);
    ctx.quadraticCurveTo(x + 11, y + 10, x + wave + 9, y + 27);
    ctx.lineTo(x + wave + 2, y + 22);
    ctx.lineTo(x + wave - 5, y + 28);
    ctx.quadraticCurveTo(x, y + 14, x - 6, y);
    ctx.fillStyle = kiteColors[i];
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

function musicNotes(ctx: Paint, center: number, time: number) {
  ctx.fillStyle = '#ffe298';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const direction = i % 2 ? -1 : 1;
    const x = center + direction * (49 + i * 6);
    const y = drum.y - 68 - i * 8 + 3 * Math.sin(time * 3 + i);
    ctx.beginPath();
    ctx.ellipse(x, y, 3, 2, -0.4, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 3, y);
    ctx.lineTo(x + 3, y - 8);
    ctx.lineTo(x + 7, y - 5);
    ctx.stroke();
  }
}

function checkpoint(ctx: Paint, state: GameState) {
  const { x, y } = state.level.checkpoint;
  ctx.fillStyle = '#704548';
  ctx.fillRect(x - 2, y - 72, 4, 72);
  ctx.fillStyle = state.checkpoint ? '#257b76' : '#a94051';
  ctx.fillRect(x + 1, y - 70, 32, 22);
  ctx.fillStyle = '#fff0c7';
  ctx.fillRect(x + 8, y - 65, 18, 11);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 8, y - 65);
  ctx.lineTo(x + 17, y - 58);
  ctx.lineTo(x + 26, y - 65);
  ctx.stroke();
}

export function drawCarnivalScenery(ctx: Paint, art: CarnivalGraphics, state: GameState, visible: Visible, time: number) {
  const { booths, level } = state;
  const bandX = drum.x - 76, marketX = ribbons[0].x - 246, standX = lanterns[0].x + 139;
  if (visible(bandX)) {
    picture(ctx, art.bandstand, bandX, drum.y + drum.h, 166);
    if (booths.drum) musicNotes(ctx, bandX, time);
  }
  if (visible(marketX)) picture(ctx, art['kite-booth'], marketX, 259, 148);
  if (visible(standX)) picture(ctx, art.grandstand, standX, lanterns[0].y + lanterns[0].h, 173);
  for (const [x, y, width, lit] of [
    [54, level.spawn.y, 140, booths.drum], [drum.x + 155, drum.y + drum.h, 188, booths.drum],
    [gate.x + 85, level.bell.y, 205, boothSeals(booths) === 3],
  ] as const) {
    if (visible(x + width / 2)) garland(ctx, x, y, width, lit, time);
  }
  const bob = booths.drum ? Math.abs(Math.sin(time * 4)) * 3 : 0;
  for (const [x, y, height] of [
    [drum.x + 143, drum.y + drum.h, 55], [ribbons[2].x + 104, level.checkpoint.y, 43],
    [lanterns[1].x + 133, lanterns[1].y + lanterns[1].h, 54], [gate.x + 119, level.bell.y, 49],
  ]) {
    if (visible(x)) picture(ctx, art.crowd, x, y - bob, height);
  }
  ribbonLine(ctx, state, visible, time);
  for (const pad of lanterns) {
    if (visible(pad.x)) lanternRow(ctx, pad, booths.lanterns.has(pad.id), time);
  }
  if (visible(level.checkpoint.x)) checkpoint(ctx, state);
  if (visible(gate.x)) picture(ctx, art.arch, gate.x + gate.w / 2, gate.y + gate.h, 200);
}

function stripedDrum(ctx: Paint, active: boolean) {
  const { x, y, w, h } = drum;
  ctx.fillStyle = '#ba4957';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = gold;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const px = x + (i + 0.5) * w / 8;
    ctx.moveTo(px - w / 16, y + 2);
    ctx.lineTo(px, y + h - 2);
    ctx.lineTo(px + w / 16, y + 2);
  }
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.fillRect(x, y + h - 3, w, 3);
  ctx.fillStyle = active ? '#fff0a6' : '#ffe3bd';
  ctx.fillRect(x - 1, y, w + 2, 4);
  star(ctx, x + w / 2, y + h / 2 + 1, 6.5, gold);
}

function kite(ctx: Paint, x: number, y: number, color: string, time: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.08 * Math.sin(time * 2.2 + x));
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(9, -2);
  ctx.lineTo(0, 12);
  ctx.lineTo(-9, -2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff0be';
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(0, 10);
  ctx.lineTo(-7, -2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 11);
  ctx.quadraticCurveTo(5, 16, 0, 20);
  ctx.stroke();
  ctx.restore();
}

function lanternPad(ctx: Paint, pad: Rect, lit: boolean) {
  const { x, y, w, h } = pad;
  ctx.fillStyle = ink;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = lit ? '#cb7950' : '#48777f';
  ctx.fillRect(x + 2, y + 2, w - 4, h - 5);
  ctx.fillStyle = lit ? '#fff1ae' : '#c0cebc';
  ctx.fillRect(x, y, w, 3);
  for (let i = 1; i <= 3; i++) star(ctx, x + w * i / 4, y + 10, i === 2 ? 9 : 5, lit ? '#ffe683' : '#adc6bf');
}

function gateBanner(ctx: Paint, count: number) {
  const { x, y, w, h } = gate;
  // A visible curtain covers the solid gate until every seal is in place.
  if (count === 3) return;
  ctx.fillStyle = '#8d394f';
  ctx.fillRect(x, y + 37, w, h - 37);
  ctx.fillStyle = '#edb97b';
  ctx.fillRect(x + 1, y + 37, 2, h - 37);
  ctx.fillRect(x + w - 3, y + 37, 2, h - 37);
  for (let i = 0; i < 3; i++) star(ctx, x + w / 2, y + 78 + i * 24, 7, i < count ? gold : '#956077');
}

export function drawCarnivalDevices(ctx: Paint, art: CarnivalGraphics, state: GameState, visible: Visible, time: number) {
  if (visible(drum.x)) stripedDrum(ctx, state.booths.drum);
  // The wood walking surface is just beneath the carved tips of the sky boat.
  const deck = floatAt(state.ticks);
  if (visible(deck.x + deck.w / 2)) {
    const h = deck.w * art.float.height / art.float.width;
    ctx.drawImage(art.float, deck.x, deck.y - h * 0.16, deck.w, h);
    ctx.fillStyle = '#ffddb1';
    ctx.fillRect(deck.x, deck.y, deck.w, 2);
  }
  ribbons.forEach((ribbon, index) => {
    if (visible(ribbon.x) && !state.booths.ribbons.has(ribbon.id)) {
      kite(ctx, ribbon.x, ribbon.y, kiteColors[index], time);
    }
  });
  for (const pad of lanterns) {
    if (visible(pad.x)) lanternPad(ctx, pad, state.booths.lanterns.has(pad.id));
  }
  if (visible(gate.x)) gateBanner(ctx, boothSeals(state.booths));
}

export function drawFinale(ctx: Paint, bell: { x: number; y: number }, seconds: number) {
  const t = Math.min(seconds, 1.8);
  for (let i = 0; i < 72; i++) {
    const fromLeft = i % 2 === 0;
    const speed = 18 + (i * 37) % 104;
    const rise = 120 + (i * 43) % 115;
    const x = bell.x + (fromLeft ? -104 + speed * t : 45 - speed * t);
    const y = bell.y - 45 - rise * t + 62 * t * t;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(i + t * 4);
    ctx.fillStyle = flags[i % flags.length];
    ctx.fillRect(-1.4, -3, 2.8, 6);
    ctx.restore();
  }
}
