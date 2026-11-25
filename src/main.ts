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
import { ROUTES, type RouteId } from "./game/level";
import { boothSeals, CARNIVAL_PROPS } from "./game/carnival";
import { createRouteProgress } from "./route-progress";

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
const nextRoute = element<HTMLButtonElement>("next-route");
const loadError = element("load-error");
const pause = element<HTMLButtonElement>("pause");
const soundButton = element<HTMLButtonElement>("sound");
const deskTools = element("desk-tools");
const guide = element<HTMLDialogElement>("guide");
const notice = element("notice");
const input = new Controls();
const sound = new PostalAudio();
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const cards = document.querySelectorAll<HTMLButtonElement>("[data-hero]");
const routeTickets = document.querySelectorAll<HTMLButtonElement>(".route-ticket");
const progress = createRouteProgress();
const scenes = new Map<RouteId, Awaited<ReturnType<typeof createScene>>>();
let selectedRoute: RouteId = "morning";
let launchSequence = 0;
let celebrationSeconds = 0;
let hero: Hero = "nia";
let state = createGame(hero);
let scene: Awaited<ReturnType<typeof createScene>> | undefined;
let mode: "desk" | "running" | "paused" | "result" = "desk";
let previousTime = 0;
let accumulated = 0;
let raf = 0;
let noticeUntil = 0;

function cancelLaunch() {
  launchSequence++;
  start.disabled = nextRoute.disabled = false;
  loadError.hidden = true;
}

function refreshRouteTickets() {
  for (const ticket of routeTickets) {
    ticket.disabled = ticket.dataset.route === "carnival" && !progress.carnivalUnlocked;
    if (!ticket.disabled) ticket.removeAttribute("aria-describedby");
    ticket.setAttribute("aria-pressed", String(ticket.dataset.route === selectedRoute));
  }
  element("route-lock").hidden = progress.carnivalUnlocked;
  element("carnival-choice").hidden = !progress.carnivalUnlocked;
  element("route-access").hidden = progress.carnivalUnlocked;
}

function selectRoute(id: RouteId) {
  if (id === "carnival" && !progress.carnivalUnlocked) return;
  selectedRoute = id;
  desk.dataset.route = id;
  refreshRouteTickets();
  const carnival = id === "carnival";
  element("desk-route-number").textContent = carnival ? "Route 02" : "Route 01";
  element("desk-route-place").textContent = carnival ? "Cloud Carnival" : "Sky Islands";
  element("desk-route-copy").textContent = carnival
    ? "The parade is waiting for its mail. Wake the brass band, catch the kites and light the rooftop grandstand."
    : "The morning mail is in your hands. Leap between sky islands and ring the delivery bell.";
  element("guide-intro").textContent = carnival
    ? "Earn three booth seals at Cloud Carnival to open the rooftop arch and deliver the parade mail."
    : "Reach the brass bell at the far end of the sky islands. Either courier can make every jump.";
  element("guide-checkpoint-name").textContent = carnival ? "The midway checkpoint" : "The windmill";
  element("guide-checkpoint-copy").textContent = carnival
    ? "Pass the midway post to set your checkpoint. Keep earned seals, ribbons, lit lanterns and stamps after a fall. Three lost lives end the delivery."
    : "Pass the windmill to set your checkpoint. Collected stamps stay in your bag after a fall. Three lost lives end the delivery.";
  element("guide-stamp-total").textContent = String(ROUTES[id].stamps.length);
  element("carnival-guide").hidden = !carnival;
}

for (const ticket of routeTickets)
  ticket.addEventListener("click", () => {
    cancelLaunch();
    selectRoute(ticket.dataset.route === "carnival" ? "carnival" : "morning");
  });
refreshRouteTickets();

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

function currentObjective() {
  const { drum, ribbons, lanterns } = state.booths;
  if (!drum) return "Bounce on the bandstand drum";
  if (ribbons.size < CARNIVAL_PROPS.ribbons.length) return `Gather kite ribbons · ${ribbons.size}/${CARNIVAL_PROPS.ribbons.length}`;
  if (lanterns.size < CARNIVAL_PROPS.lanterns.length) return `Light the star pads · ${lanterns.size}/${CARNIVAL_PROPS.lanterns.length}`;
  return "Ring the rooftop bell";
}

function syncHud() {
  element("lives").textContent = String(state.lives);
  element("stamps").textContent = String(state.collected.size);
  if (state.level.id !== "carnival") return;
  element("seals").textContent = String(boothSeals(state.booths));
  const objective = currentObjective();
  const label = element("objective");
  if (label.textContent !== objective) label.textContent = objective;
}

function showOverlay(kind: "paused" | "won" | "lost") {
  mode = kind === "paused" ? "paused" : "result";
  clearControls();
  cancelAnimationFrame(raf);
  pause.disabled = true;
  overlay.hidden = false;
  resume.hidden = kind !== "paused";
  element("pause-guide").hidden = kind !== "paused";
  const won = kind === "won";
  const carnival = state.level.id === "carnival";
  const morningDelivered = won && !carnival;
  if (morningDelivered) {
    progress.unlockCarnival();
    refreshRouteTickets();
  }
  nextRoute.hidden = !morningDelivered;
  overlay.classList.toggle("finale", won && carnival);
  const result = {
    paused: { title: "Delivery paused", icon: "ph-pause-circle", text: "Your courier is ready when you are.", retry: "Restart delivery", action: resume },
    lost: { title: "Out of lives", icon: "ph-envelope-simple", text: "Your mailbag is ready for another run.", retry: "Try again", action: retry },
    won: {
      title: carnival ? "Parade mail delivered!" : "Delivery complete!",
      icon: "ph-bell-ringing",
      text: carnival ? "All three booths are ready for the parade." : "Cloud Carnival is now open.",
      retry: "Play again",
      action: carnival ? retry : nextRoute,
    },
  }[kind];
  element("overlay-title").textContent = result.title;
  element("overlay-icon").className = "ph " + result.icon;
  element("overlay-description").textContent = kind === "paused"
    ? result.text : `${result.text} Stamps collected: ${state.collected.size} / ${state.level.stamps.length}.`;
  retry.textContent = result.retry;
  result.action.focus({ preventScroll: true });
  if (won && carnival && !reducedMotion.matches) {
    const started = performance.now();
    const celebrate = (now: number) => {
      celebrationSeconds = Math.min((now - started) / 1000, 1.8);
      draw();
      if (celebrationSeconds < 1.8 && !reducedMotion.matches) raf = requestAnimationFrame(celebrate);
    };
    raf = requestAnimationFrame(celebrate);
  }
}

function eventNotice(event: GameEvent) {
  switch (event) {
    case "checkpoint": return state.level.id === "carnival" ? "Midway checkpoint reached" : "Windmill checkpoint reached";
    case "hurt": return "A life lost";
    case "drum": return "The brass band is playing!";
    case "ribbon": return state.booths.ribbons.size === CARNIVAL_PROPS.ribbons.length
      ? "Kite Midway seal earned" : `Kite ribbons · ${state.booths.ribbons.size}/${CARNIVAL_PROPS.ribbons.length}`;
    case "lantern": return state.booths.lanterns.size === CARNIVAL_PROPS.lanterns.length
      ? "Lantern Grandstand seal earned" : `Star lanterns · ${state.booths.lanterns.size}/${CARNIVAL_PROPS.lanterns.length}`;
  }
}

function handleEvents(events: GameEvent[]) {
  for (const event of events) {
    sound.play(event);
    const message = eventNotice(event);
    if (message) {
      notice.textContent = message;
      noticeUntil = state.ticks + 100;
    }
  }
  if (events.length) syncHud();
}

function draw() {
  if (!game.hidden) scene?.draw(state, reducedMotion.matches, celebrationSeconds);
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
  cancelAnimationFrame(raf);
  celebrationSeconds = 0;
  state = createGame(hero, selectedRoute);
  const carnival = selectedRoute === "carnival";
  game.dataset.route = selectedRoute;
  game.setAttribute("aria-label", state.level.name);
  element("route-name").textContent = state.level.name;
  element("game-route-number").textContent = carnival ? "Route 02" : "Route 01";
  element("game-route-place").textContent = carnival ? "Parade Grounds" : "Sky Islands";
  element("stamp-total").textContent = `/ ${state.level.stamps.length}`;
  element("booth-progress").hidden = !carnival;
  stage.setAttribute("aria-label", state.level.name + " platform game");
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
    if (guide.open) updateGuideProgress();
  } else {
    play();
  }
}

async function launchRoute(id: RouteId) {
  if (id === "carnival" && !progress.carnivalUnlocked) return;
  const sequence = ++launchSequence;
  sound.unlock();
  start.disabled = nextRoute.disabled = true;
  loadError.hidden = true;
  try {
    const loaded = scenes.get(id) ?? await createScene(stage, id);
    if (sequence !== launchSequence) return;
    scenes.set(id, loaded);
    scene = loaded;
  } catch {
    if (sequence !== launchSequence) return;
    const trigger = mode === "desk" ? start : nextRoute;
    trigger.parentElement!.insertAdjacentElement("afterend", loadError);
    loadError.textContent = `The artwork for ${ROUTES[id].name} could not load. Check the connection and try again.`;
    loadError.hidden = false;
    start.disabled = nextRoute.disabled = false;
    trigger.focus({ preventScroll: true });
    return;
  } finally {
    if (sequence === launchSequence) start.disabled = nextRoute.disabled = false;
  }
  selectRoute(id);
  newRun();
}
start.addEventListener("click", () => void launchRoute(selectedRoute));
nextRoute.addEventListener("click", () => void launchRoute("carnival"));
resume.addEventListener("click", play);
retry.addEventListener("click", () => {
  cancelLaunch();
  selectRoute(state.level.id);
  newRun();
});
pause.addEventListener("click", () => {
  if (mode === "running") showOverlay("paused");
});
element("choose").addEventListener("click", () => {
  cancelLaunch();
  cancelAnimationFrame(raf);
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

function updateGuideProgress() {
  const readout = element("guide-progress");
  readout.hidden = mode === "desk";
  if (!readout.hidden) {
    const boothHint = state.level.id === "carnival"
      ? ` · ${boothSeals(state.booths)}/3 seals · ${currentObjective()}` : "";
    readout.textContent = `${state.level.name} · ${state.collected.size}/${state.level.stamps.length} stamps${boothHint}`;
  }
}
function openGuide() {
  if (mode === "running") showOverlay("paused");
  updateGuideProgress();
  guide.showModal();
}
element("guide-open").addEventListener("click", openGuide);
element("pause-guide").addEventListener("click", openGuide);
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
