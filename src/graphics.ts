const ART_NAMES = ['sky', 'island', 'windmill', 'nia', 'finn', 'beetle', 'stamp', 'bell'] as const;

type ArtName = typeof ART_NAMES[number];
export type Graphics = Record<ArtName, HTMLImageElement>;

export async function loadGraphics(): Promise<Graphics> {
  const images = await Promise.all(ART_NAMES.map(async name => {
    const image = new Image();
    image.src = `${import.meta.env.BASE_URL}art/${name}.webp`;
    try {
      await image.decode();
    } catch (cause) {
      throw new Error(`Unable to load artwork: ${name}.webp`, { cause });
    }
    return [name, image] as const;
  }));
  return Object.fromEntries(images) as Graphics;
}
