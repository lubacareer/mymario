import "@phosphor-icons/web/regular";
import "./style.css";
import { COURSES, type Course } from "./courses";
import { FlightControls, FixedClock, actionForKey, type Action } from "./controls";
import { createProgressStore } from "./progress";
import { createScene } from "./scene";
import { createRun, stepRun, STEP, MIN_SPEED, MAX_SPEED, type Failure } from "./simulation";
import { FlightAudio } from "./sound";

function el<T extends HTMLElement = HTMLElement>(id: string) {
  const node = document.getElementById(id);
  if (!node) throw new Error("Missing flight instrument: " + id);
  return node as T;
}

const cockpit = el("cockpit");
const selection = el("selection");
const canvas = el<HTMLCanvasElement>("flight-scene");
const result = el("result");
const touchDeck = el("touch-deck");
const flightData = el("flight-data");
const pauseButton = el<HTMLButtonElement>("pause");
const muteButton = el<HTMLButtonElement>("mute");
const primary = el<HTMLButtonElement>("continue");
const replay = el<HTMLButtonElement>("replay");
const announcement = el("announcement");
const hud = {
  speed: el("speed"), fuel: el("fuel"), oxygen: el("oxygen"), progress: el("progress"), clock: el("clock"),
  fuelMeter: el<HTMLMeterElement>("fuel-meter"), oxygenMeter: el<HTMLMeterElement>("oxygen-meter"),
  progressMeter: el<HTMLMeterElement>("progress-meter"),
};
const draw = createScene(canvas);
const controls = new FlightControls();
const clock = new FixedClock(STEP);
const audio = new FlightAudio();
const progress = createProgressStore();
type Mode = "menu" | "running" | "paused" | "crashed" | "finished";
let mode: Mode = "menu";
let course = COURSES[0];
let run = createRun(course);
let noticeUntil = 0;

function timeText(seconds: number) {
  const hundredths = Math.round(seconds * 100);
  const minutes = Math.floor(hundredths / 6000);
  const remainder = Math.floor(hundredths / 100) % 60;
  return minutes + ":" + String(remainder).padStart(2, "0") + "." + String(hundredths % 100).padStart(2, "0");
}

function setMode(next: Mode) {
  mode = next;
  cockpit.dataset.state = mode;
  selection.hidden = mode !== "menu";
  result.hidden = mode === "menu" || mode === "running";
  flightData.hidden = mode === "menu";
  touchDeck.hidden = mode !== "running";
  pauseButton.hidden = mode !== "running";
  controls.clear();
  clock.reset();
  noticeUntil = 0;
  announcement.textContent = "";
  audio.engine(mode === "running" ? run.speed : null);
}

function selectCourse(next: Course) {
  if (!progress.isUnlocked(next.id)) return;
  course = next;
  run = createRun(course);
  for (const { id } of COURSES) {
    const btn = el<HTMLButtonElement>("course-" + id);
    btn.disabled = !progress.isUnlocked(id);
    btn.setAttribute("aria-pressed", String(id === course.id));
    const icon = btn.querySelector("i")!;
    icon.className = "ph " + (btn.disabled ? "ph-lock-simple" : id === course.id ? "ph-radio-button" : "ph-circle");
  }
  el("course-count").textContent = COURSES.filter(c => progress.isUnlocked(c.id)).length + " / " + COURSES.length + " open";
  el("course-description").textContent = course.description;
  const best = progress.bestTimes[course.id];
  el("course-best").textContent = best === undefined ? "—" : timeText(best);
  draw(course, run);
}

for (const [i, item] of COURSES.entries()) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "course";
  btn.id = "course-" + item.id;
  btn.setAttribute("aria-label", item.name);
  const number = document.createElement("b");
  number.textContent = String(i + 1).padStart(2, "0");
  const icon = document.createElement("i");
  icon.setAttribute("aria-hidden", "true");
  btn.append(number, item.name, icon);
  btn.addEventListener("click", () => selectCourse(item));
  el("courses").append(btn);
}

function updateHud() {
  const percent = Math.min(100, Math.floor(run.z / course.length * 100));
  hud.speed.textContent = String(Math.round(run.speed));
  hud.fuel.textContent = Math.ceil(run.fuel) + "%";
  hud.oxygen.textContent = Math.ceil(run.oxygen) + "%";
  hud.progress.textContent = percent + "%";
  hud.clock.textContent = timeText(run.elapsed);
  hud.fuelMeter.value = run.fuel;
  hud.oxygenMeter.value = run.oxygen;
  hud.progressMeter.value = percent;
}

function launch(next: Course = course) {
  if (!progress.isUnlocked(next.id)) return;
  audio.unlock();
  course = next;
  run = createRun(course);
  el("current-course").textContent = course.name;
  el("sector").textContent = "Course " + String(COURSES.indexOf(course) + 1).padStart(2, "0");
  setMode("running");
  updateHud();
  canvas.focus({ preventScroll: true });
}

const failureDescriptions: Record<Failure, string> = {
  fall: "You fell into the void. Jump before the edge and aim for the next deck.",
  impact: "Hull impact. Steer around the barrier or land on top of the next deck.",
  fuel: "Fuel depleted. Cross a striped supply pad to refuel.",
  oxygen: "Oxygen depleted. Cross a supply pad or increase your speed.",
};

function showResult(next: "paused" | "crashed" | "finished") {
  setMode(next);
  const final = course === COURSES.at(-1);
  el("result-course").textContent = course.name;
  let title: string, description: string;
  replay.hidden = next === "crashed" || (next === "finished" && final);
  if (next === "paused") {
    title = "Flight paused";
    description = "Resume from your current position or restart this course.";
    primary.textContent = "Resume";
    replay.textContent = "Restart course";
  } else if (next === "crashed") {
    title = "Flight ended";
    description = failureDescriptions[run.failure!];
    primary.textContent = "Retry";
  } else {
    progress.recordClear(course.id, run.elapsed);
    title = final ? "Cup complete" : "Course clear";
    const best = progress.bestTimes[course.id] ?? run.elapsed;
    description = "Clear time " + timeText(run.elapsed) + " · Best " + timeText(best) + ".";
    if (!final) description += " " + COURSES[COURSES.indexOf(course) + 1].name + " unlocked.";
    primary.textContent = final ? "Replay" : "Next course";
    replay.textContent = "Replay";
  }
  el("result-title").textContent = title;
  el("result-description").textContent = description;
  primary.focus({ preventScroll: true });
}

function pauseFlight() {
  if (mode === "running") showResult("paused");
}

function resumeFlight() {
  audio.unlock();
  setMode("running");
  canvas.focus({ preventScroll: true });
}

el("launch").addEventListener("click", () => launch());
pauseButton.addEventListener("click", pauseFlight);
primary.addEventListener("click", () => {
  if (mode === "paused") resumeFlight();
  else if (mode === "finished") launch(COURSES[COURSES.indexOf(course) + 1] ?? course);
  else if (mode === "crashed") launch();
});
replay.addEventListener("click", () => launch());
el("select").addEventListener("click", () => {
  setMode("menu");
  selectCourse(course);
  el("course-" + course.id).focus({ preventScroll: true });
});
muteButton.addEventListener("click", e => {
  audio.unlock();
  audio.toggle();
  const label = audio.muted ? "Unmute sound" : "Mute sound";
  muteButton.setAttribute("aria-label", label);
  muteButton.title = label;
  muteButton.firstElementChild!.className = "ph " + (audio.muted ? "ph-speaker-slash" : "ph-speaker-high");
  if (mode === "running" && e.detail > 0) canvas.focus({ preventScroll: true });
});
window.addEventListener("blur", pauseFlight);
window.addEventListener("pagehide", pauseFlight);
document.addEventListener("visibilitychange", () => { if (document.hidden) pauseFlight(); });

window.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === "Escape" && (mode === "running" || mode === "paused")) {
    e.preventDefault();
    if (!e.repeat) {
      if (mode === "running") pauseFlight();
      else resumeFlight();
    }
    return;
  }
  if (e.code === "KeyR" && mode !== "menu") {
    e.preventDefault();
    if (!e.repeat) launch();
    return;
  }
  const action = actionForKey(e.code);
  if (mode !== "running" || !action) return;
  if (e.target instanceof HTMLElement &&
      (e.target.isContentEditable || e.target.closest("button, a[href], input, select, textarea"))) return;
  e.preventDefault();
  if (!e.repeat) controls.press(e.code, action);
});
window.addEventListener("keyup", e => controls.release(e.code));

function pressPad(action: Action, source?: string) {
  if (mode !== "running") return;
  if (action === "faster" || action === "slower") {
    const step = action === "faster" ? 2 : -2;
    run.speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, run.speed + step));
  } else if (source === undefined) controls.activate(action);
  else controls.press(source, action);
}

for (const pad of touchDeck.querySelectorAll<HTMLButtonElement>("[data-pad]")) {
  const action = pad.dataset.pad as Action;
  pad.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    e.preventDefault();
    pad.setPointerCapture(e.pointerId);
    pressPad(action, "pad:" + e.pointerId);
  });
  const release = (e: PointerEvent) => controls.release("pad:" + e.pointerId);
  pad.addEventListener("pointerup", release);
  pad.addEventListener("pointercancel", release);
  pad.addEventListener("lostpointercapture", release);
  // Keyboard and assistive technology can activate a button without a pointer.
  pad.addEventListener("click", e => {
    if (e.detail === 0) pressPad(action);
  });
}

let lastDraw = -Infinity;
function animate(now: number) {
  const racing = mode === "running";
  if (racing) {
    const count = clock.ticks(now);
    for (let i = 0; i < count && mode === "running"; i++) {
      const events = stepRun(run, controls.frame());
      for (const event of events) {
        audio.play(event);
        if (event === "refill") {
          announcement.textContent = "Fuel and oxygen restored";
          noticeUntil = run.elapsed + 1.1;
        }
      }
      if (run.status !== "racing") showResult(run.status);
    }
    if (noticeUntil && run.elapsed >= noticeUntil) {
      announcement.textContent = "";
      noticeUntil = 0;
    }
    if (mode === "running") audio.engine(run.speed);
    if (count) updateHud();
  }
  // Static screens still redraw on resize and when an illustration finishes decoding.
  if (racing || now - lastDraw >= 180) {
    draw(course, run);
    lastDraw = now;
  }
  requestAnimationFrame(animate);
}

selectCourse(course);
requestAnimationFrame(animate);
