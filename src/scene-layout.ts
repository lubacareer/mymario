const WORLD_VIEW_HEIGHT = 360;
const MIN_VIEW_WIDTH = 400;
const CAMERA_LEAD = 0.37;

export function cameraLayout(cssWidth: number, cssHeight: number, playerCenter: number, stageWidth: number) {
  const scale = Math.min(cssHeight / WORLD_VIEW_HEIGHT, cssWidth / MIN_VIEW_WIDTH);
  const width = cssWidth / scale;
  const height = cssHeight / scale;
  return {
    width,
    height,
    scale,
    cameraX: Math.max(0, Math.min(stageWidth - width, playerCenter - width * CAMERA_LEAD)),
    offsetY: Math.max(0, (height - WORLD_VIEW_HEIGHT) * 0.55),
  };
}

interface IslandSlice {
  x: number;
  width: number;
  sourceX: number;
  sourceWidth: number;
}

// Keep rock tips and grassy outer edges intact as the middle grows to fit the collider.
export function islandSlices(width: number, sourceWidth: number, renderHeight: number): IslandSlice[] {
  const sourceCap = Math.floor(sourceWidth * 0.22);
  const cap = Math.min(width * 0.28, renderHeight * 0.68);
  const middle = width - cap * 2;
  const desiredCount = Math.max(1, Math.round(middle / (renderHeight * 2.4)));
  // Mirrored pairs repeat seamlessly. The last original segment must meet the right cap.
  const count = desiredCount % 2 === 0 ? desiredCount + 1 : desiredCount;
  const parts = [{ x: 0, width: cap, sourceX: 0, sourceWidth: sourceCap }];
  for (let i = 0; i < count; i++) {
    parts.push({
      x: cap + middle * i / count,
      width: middle / count,
      sourceX: sourceCap,
      sourceWidth: sourceWidth - 2 * sourceCap,
    });
  }
  parts.push({ x: width - cap, width: cap, sourceX: sourceWidth - sourceCap, sourceWidth: sourceCap });
  return parts;
}
