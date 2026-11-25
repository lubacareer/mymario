# Orbit Arcade

Orbit Arcade is a two-game browser arcade for keyboard and touch. Open the library to choose a game, or bookmark either game directly.

| Page | Production path |
| --- | --- |
| Game library | `/mymario/` |
| Bellwind Post | `/mymario/games/bellwind-post/` |
| Aphelion Run | `/mymario/games/aphelion-run/` |

## Play locally

Use Node.js 22.12 or later and npm. From the repository root run:

```sh
npm ci
npm run dev
```

Open the local address printed by Vite for the library. The dev server serves the site at `/`. To try the production build, run `npm run build` followed by `npm run preview` and open the printed `/mymario/` address. The artwork and fonts ship with the games. Both games synthesize sound on the device.

## Bellwind Post

A hand-painted browser platformer about two postal couriers and a mail route across the sky islands. Choose Nia or Finn, collect up to 12 winged stamps, and ring the brass bell. Both couriers have identical movement and collision rules.

![Bellwind Post courier selection](docs/screenshots/desktop.png)

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Left / Right or A / D | Hold a direction |
| Jump | Space, Up, or W | Press Jump with a second finger |
| Pause | Escape | Pause button |

Tap jump for a low hop or hold it for height. Stomp puffbeetles from above. Crossing the windmill activates a checkpoint. A fall or side hit costs one of three lives. Collected stamps stay in the bag when you respawn.

## Aphelion Run

Fly three original space roads from a rear chase view. Speed changes your jump distance. Land on marked supply strips to replenish fuel and oxygen, and line up the ship’s shadow with the next platform. Finishing a course unlocks the next and records your best clear time in this browser.

![Flight over the first gap in Dawn Array](public/art/aphelion-run.webp)

| Action | Keyboard | Touch |
| --- | --- | --- |
| Steer | Left / Right or A / D | Hold a direction |
| Change speed | Up / Down or W / S | Use + or −, then release to hold speed |
| Jump | Space | Tap Jump while steering |
| Pause / resume | Escape | Pause / Resume |
| Retry after a crash | R | Retry |

Dawn Array starts with wide roads and a full-width supply strip. Iceglass Relay offers narrow raised shortcuts in low gravity. Ember Foundry has heavier gravity and a fork between a refueling lane and a faster jump. Losing focus pauses the flight. If browser storage is unavailable, the cup stays playable and keeps times until you leave the page.

## Verify

```sh
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
```

Simulation tests run at a fixed 60 Hz. Playwright builds the production site and visits the three pages under `/mymario/`. Keyboard and touch journeys reach the delivery bell and finish all three space roads.

The Game checks workflow tests pushes and pull requests. Before publishing the tested `dist/` artifact to [GitHub Pages](https://lubacareer.github.io/mymario/), the deploy job verifies that the commit is still the head of `main`.

## Artwork

Built-in ImageGen generated the illustrated sprites, portraits, title artwork, scenery, and planet panoramas. The racer’s ship, track and shadows are projected from game geometry. Its library cover is a gameplay capture. Final assets are in [public/art](public/art). The model ID is unavailable from the built-in tool. See the [character and prop prompts](docs/character-art.md), [Bellwind environment prompts](docs/environment-art.md), and [Aphelion panorama prompts](docs/aphelion-art.md).
