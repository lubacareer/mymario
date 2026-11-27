import type { RouteId } from './game/level';

const SHARED = ['island', 'nia', 'finn', 'beetle', 'stamp', 'bell'] as const;
const MORNING = ['sky', 'post-office', 'windmill'] as const;
const CARNIVAL = ['sky', 'bandstand', 'kite-booth', 'grandstand', 'float', 'crowd', 'arch'] as const;
const ARTWORK_TIMEOUT_MS = 15_000;
type Images<K extends string> = Record<K, HTMLImageElement>;
type Shared = Images<typeof SHARED[number]>;
export type Graphics = Shared & Images<typeof MORNING[number]>;
export type CarnivalGraphics = Shared & Images<typeof CARNIVAL[number]>;

async function loadImages<K extends string>(
  names: readonly K[], directory: string, pending: Set<HTMLImageElement>,
): Promise<Images<K>> {
  const images = await Promise.all(names.map(async name => {
    const image = new Image();
    pending.add(image);
    image.src = `${import.meta.env.BASE_URL}art/${directory}${name}.webp`;
    try {
      await image.decode();
    } catch (cause) {
      throw new Error(`Unable to load artwork: ${directory}${name}.webp`, { cause });
    } finally {
      pending.delete(image);
    }
    return [name, image] as const;
  }));
  return Object.fromEntries(images) as Images<K>;
}

export function loadGraphics(routeId?: 'morning'): Promise<Graphics>;
export function loadGraphics(routeId: 'carnival'): Promise<CarnivalGraphics>;
export function loadGraphics(routeId: RouteId): Promise<Graphics | CarnivalGraphics>;
export async function loadGraphics(routeId: RouteId = 'morning') {
  const pending = new Set<HTMLImageElement>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Route artwork timed out.')), ARTWORK_TIMEOUT_MS);
  });
  try {
    const images = Promise.all([
      loadImages(SHARED, '', pending),
      routeId === 'carnival' ? loadImages(CARNIVAL, 'carnival/', pending) : loadImages(MORNING, '', pending),
    ]);
    const [shared, scenery] = await Promise.race([images, deadline]);
    return { ...shared, ...scenery };
  } finally {
    clearTimeout(timer);
    for (const image of pending) image.removeAttribute('src');
  }
}
