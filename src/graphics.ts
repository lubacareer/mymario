import type { RouteId } from './game/level';

const SHARED = ['island', 'nia', 'finn', 'beetle', 'stamp', 'bell'] as const;
const MORNING = ['sky', 'post-office', 'windmill'] as const;
const CARNIVAL = ['sky', 'bandstand', 'kite-booth', 'grandstand', 'float', 'crowd', 'arch'] as const;
type Images<K extends string> = Record<K, HTMLImageElement>;
type Shared = Images<typeof SHARED[number]>;
export type Graphics = Shared & Images<typeof MORNING[number]>;
export type CarnivalGraphics = Shared & Images<typeof CARNIVAL[number]>;

async function loadImages<K extends string>(names: readonly K[], directory: string): Promise<Images<K>> {
  const images = await Promise.all(names.map(async name => {
    const image = new Image();
    image.src = `${import.meta.env.BASE_URL}art/${directory}${name}.webp`;
    try {
      await image.decode();
    } catch (cause) {
      throw new Error(`Unable to load artwork: ${directory}${name}.webp`, { cause });
    }
    return [name, image] as const;
  }));
  return Object.fromEntries(images) as Images<K>;
}

export function loadGraphics(routeId?: 'morning'): Promise<Graphics>;
export function loadGraphics(routeId: 'carnival'): Promise<CarnivalGraphics>;
export function loadGraphics(routeId: RouteId): Promise<Graphics | CarnivalGraphics>;
export async function loadGraphics(routeId: RouteId = 'morning') {
  const [shared, scenery] = await Promise.all([
    loadImages(SHARED, ''),
    routeId === 'carnival' ? loadImages(CARNIVAL, 'carnival/') : loadImages(MORNING, ''),
  ]);
  return { ...shared, ...scenery };
}
