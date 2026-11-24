import "@phosphor-icons/web/regular";
import "./style.css";
import { Controls, type Action } from "./controls";
import {
  createGame,
  stepGame,
  STEP_SECONDS,
  type Hero,
  type GameEvent,
} from "./game/simulation";
import { createScene } from "./scene";
import { PostalAudio } from "./sound";

function element<T extends HTMLElement = HTMLElement>(id: string) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing interface element: ${id}`);
  return node as T;
}

const stage = element<HTMLCanvasElement>("stage");
const desk = element("desk");
const game = element("game");
const overlay = element("overlay");
const resume = element<HTMLButtonElement>("continue");
const retry = element<HTMLButtonElement>("retry");
const start = element<HTMLButtonElement>("start");
const pause = element<HTMLButtonElement>("pause");
const soundButton = element<HTMLButtonElement>("sound");
const deskTools = element("desk-tools");
const guide = element<HTMLDialogElement>("guide");
const notice = element("notice");
const input = new Controls();
const sound = new PostalAudio();
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const cards = document.querySelectorAll<HTMLButtonElement>("[data-hero]");
let hero: Hero = "nia";
let state = createGame(hero);
let scene: Awaited<ReturnType<typeof createScene>> | undefined;
let mode: "desk" | "running" | "paused" | "result" = "desk";
let previousTime = 0;
let accumulated = 0;
let raf = 0;
let noticeUntil = 0;

function selectHero(selected: Hero) {
  hero = selected;
  for (const card of cards)
    card.setAttribute("aria-pressed", String(card.dataset.hero === hero));
}
for (const card of cards) {
  card.addEventListener("click", () =>
    selectHero(card.dataset.hero === "finn" ? "finn" : "nia"),
  );
}

function clearControls() {
  input.clear();
  for (const pad of document.querySelectorAll<HTMLElement>(".pad"))
    delete pad.dataset.held;
}

function syncHud() {
  element("lives").textContent = String(state.lives);
  element("stamps").textContent = String(state.collected.size);
}

function showOverlay(kind: "paused" | "won" | "lost") {
  mode = kind === "paused" ? "paused" : "result";
  clearControls();
  cancelAnimationFrame(raf);
  pause.disabled = true;
  overlay.hidden = false;
  resume.hidden = kind !== "paused";
  const won = kind === "won";
  const title =
    kind === "paused"
      ? "Delivery paused"
      : won
        ? "Delivery complete!"
        : "Out of lives";
  element("overlay-title").textContent = title;
  element("overlay-icon").className =
    "ph " +
    (kind === "paused"
      ? "ph-pause-circle"
      : won
        ? "ph-bell-ringing"
        : "ph-envelope-simple");
  element("overlay-description").textContent =
    kind === "paused"
      ? "Your courier is ready when you are."
      : `${won ? "The morning mail has arrived." : "Your mailbag is ready for another run."} Stamps collected: ${state.collected.size} / 12.`;
  retry.textContent =
    kind === "paused" ? "Restart delivery" : won ? "Play again" : "Try again";
  (kind === "paused" ? resume : retry).focus({ preventScroll: true });
}

function handleEvents(events: GameEvent[]) {
  for (const event of events) {
    sound.play(event);
    if (event === "checkpoint" || event === "hurt") {
      notice.textContent =
        event === "checkpoint" ? "Windmill checkpoint reached" : "A life lost";
      noticeUntil = state.ticks + 100;
    }
  }
  if (events.length) syncHud();
}

function draw() {
  if (!game.hidden) scene?.draw(state, reducedMotion.matches);
}

function frame(time: number) {
  if (mode !== "running") return;
  accumulated += Math.min((time - previousTime) / 1000, 0.1);
  previousTime = time;
  while (
    accumulated + Number.EPSILON >= STEP_SECONDS &&
    state.status === "playing"
  ) {
    handleEvents(stepGame(state, input.frame()));
    accumulated -= STEP_SECONDS;
  }
  if (notice.textContent && state.ticks >= noticeUntil) notice.textContent = "";
  draw();
  if (state.status !== "playing") {
    notice.textContent = "";
    showOverlay(state.status);
  } else {
    raf = requestAnimationFrame(frame);
  }
}

function play() {
  clearControls();
  overlay.hidden = true;
  pause.disabled = false;
  mode = "running";
  previousTime = performance.now();
  accumulated = 0;
  stage.focus({ preventScroll: true });
  draw();
  raf = requestAnimationFrame(frame);
}

function newRun() {
  state = createGame(hero);
  notice.textContent = "";
  syncHud();
  desk.hidden = true;
  game.hidden = false;
  pause.before(soundButton);
  soundButton.classList.replace("tool", "square");
  document.body.classList.add("in-game");
  window.scrollTo(0, 0);
  if (guide.open || document.hidden) {
    draw();
    showOverlay("paused");
  } else {
    play();
  }
}

start.addEventListener("click", async () => {
  sound.unlock();
  start.disabled = true;
  const error = element("load-error");
  error.hidden = true;
  try {
    scene ??= await createScene(stage);
    newRun();
  } catch {
    error.textContent =
      "The game art could not load. Check the connection and select Start delivery to retry.";
    error.hidden = false;
  } finally {
    start.disabled = false;
  }
});
resume.addEventListener("click", play);
retry.addEventListener("click", newRun);
pause.addEventListener("click", () => {
  if (mode === "running") showOverlay("paused");
});
element("choose").addEventListener("click", () => {
  mode = "desk";
  game.hidden = true;
  desk.hidden = false;
  overlay.hidden = true;
  deskTools.append(soundButton);
  soundButton.classList.replace("square", "tool");
  document.body.classList.remove("in-game");
  document
    .querySelector<HTMLButtonElement>("[data-hero][aria-pressed=true]")
    ?.focus({ preventScroll: true });
});

element("guide-open").addEventListener("click", () => {
  if (mode === "running") showOverlay("paused");
  guide.showModal();
});
element("guide-close").addEventListener("click", () => guide.close());
guide.addEventListener("click", (e) => {
  if (e.target === guide && !inside(guide, e.clientX, e.clientY)) guide.close();
});

function inside(node: Element, x: number, y: number) {
  const r = node.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

soundButton.addEventListener("click", () => {
  sound.unlock();
  sound.toggle();
  const label = sound.muted ? "Enable sound" : "Mute sound";
  soundButton.setAttribute("aria-label", label);
  soundButton.title = label;
  soundButton.querySelector("i")!.className =
    "ph " + (sound.muted ? "ph-speaker-slash" : "ph-speaker-high");
  soundButton.querySelector("span")!.textContent = sound.muted
    ? "Sound off"
    : "Sound on";
  if (mode === "running") stage.focus({ preventScroll: true });
});

const keys: Record<string, Action | undefined> = {
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "jump",
  KeyW: "jump",
  ArrowUp: "jump",
};
window.addEventListener("keydown", (e) => {
  if (guide.open || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === "Escape" && (mode === "running" || mode === "paused")) {
    e.preventDefault();
    if (!e.repeat) {
      if (mode === "running") showOverlay("paused");
      else play();
    }
    return;
  }
  const action = keys[e.code];
  if (!action || mode !== "running") return;
  if (e.code === "Space" && e.target instanceof HTMLButtonElement) return;
  e.preventDefault();
  if (!e.repeat) input.press(e.code, action);
});
window.addEventListener("keyup", (e) => input.release(e.code));

for (const action of ["left", "right", "jump"] as const) {
  const pad = element<HTMLButtonElement>(action);
  const pointers = new Set<number>();
  pad.addEventListener("pointerdown", (e) => {
    if (mode !== "running" || e.button !== 0) return;
    e.preventDefault();
    pad.setPointerCapture(e.pointerId);
    pointers.add(e.pointerId);
    input.press("pointer-" + e.pointerId, action);
    pad.dataset.held = "true";
  });
  const release = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    input.release("pointer-" + e.pointerId);
    if (!pointers.size) delete pad.dataset.held;
  };
  pad.addEventListener("pointerup", release);
  pad.addEventListener("pointercancel", release);
  pad.addEventListener("lostpointercapture", release);
  pad.addEventListener("contextmenu", (e) => e.preventDefault());
}
function pauseWhenAway() {
  if (mode === "running") showOverlay("paused");
}
window.addEventListener("blur", pauseWhenAway);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseWhenAway();
});
new ResizeObserver(draw).observe(stage);
