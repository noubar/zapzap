export interface Point {
  x: number;
  y: number;
}

export interface RadialSectorGeometry {
  index: number;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  path: string;
  labelPoint: Point;
  labelRotation: number;
}

export interface RadialArenaGeometry {
  width: number;
  height: number;
  center: Point;
  outerRadius: number;
  innerRadius: number;
  rotation: number;
  sectorAngle: number;
  sectors: RadialSectorGeometry[];
}

export interface CreateRadialGeometryOptions {
  playerCount: number;
  width: number;
  height: number;
  padding?: number;
  centerRatio?: number;
  rotation?: number;
}

export function normalizeAngle(angle: number) {
  return ((angle % 360) + 360) % 360;
}

export function polarPoint(center: Point, radius: number, angle: number): Point {
  const radians = angle * Math.PI / 180;
  return {
    x: center.x + radius * Math.cos(radians),
    y: center.y + radius * Math.sin(radians),
  };
}

function number(value: number) {
  return Number(value.toFixed(4));
}

export function createAnnularSectorPath(
  center: Point,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
) {
  const outerStart = polarPoint(center, outerRadius, startAngle);
  const outerEnd = polarPoint(center, outerRadius, endAngle);
  const innerEnd = polarPoint(center, innerRadius, endAngle);
  const innerStart = polarPoint(center, innerRadius, startAngle);
  const sweep = endAngle - startAngle;
  const largeArc = sweep > 180 ? 1 : 0;
  return [
    `M ${number(outerStart.x)} ${number(outerStart.y)}`,
    `A ${number(outerRadius)} ${number(outerRadius)} 0 ${largeArc} 1 ${number(outerEnd.x)} ${number(outerEnd.y)}`,
    `L ${number(innerEnd.x)} ${number(innerEnd.y)}`,
    `A ${number(innerRadius)} ${number(innerRadius)} 0 ${largeArc} 0 ${number(innerStart.x)} ${number(innerStart.y)}`,
    'Z',
  ].join(' ');
}

export function createRadialArenaGeometry({
  playerCount,
  width,
  height,
  padding = 8,
  centerRatio = 0.2,
  rotation = -90,
}: CreateRadialGeometryOptions): RadialArenaGeometry {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 8) {
    throw new RangeError('Radial player count must be an integer from 2 to 8.');
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError('Radial arena dimensions must be positive finite numbers.');
  }
  const center = { x: width / 2, y: height / 2 };
  const outerRadius = Math.max(1, Math.min(width, height) / 2 - Math.max(0, padding));
  const innerRadius = outerRadius * Math.max(0.1, Math.min(0.32, centerRatio));
  const sectorAngle = 360 / playerCount;
  const labelRadius = innerRadius + (outerRadius - innerRadius) * 0.58;
  const sectors = Array.from({ length: playerCount }, (_, index) => {
    const startAngle = rotation + index * sectorAngle;
    const endAngle = startAngle + sectorAngle;
    const midAngle = startAngle + sectorAngle / 2;
    return {
      index,
      startAngle,
      endAngle,
      midAngle,
      path: createAnnularSectorPath(center, innerRadius, outerRadius, startAngle, endAngle),
      labelPoint: polarPoint(center, labelRadius, midAngle),
      labelRotation: normalizeAngle(midAngle + 90),
    };
  });
  return { width, height, center, outerRadius, innerRadius, rotation, sectorAngle, sectors };
}

export function hitTestRadialSector(
  geometry: RadialArenaGeometry,
  x: number,
  y: number
) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const dx = x - geometry.center.x;
  const dy = y - geometry.center.y;
  const distance = Math.hypot(dx, dy);
  if (distance < geometry.innerRadius || distance > geometry.outerRadius) return null;
  const angle = normalizeAngle(Math.atan2(dy, dx) * 180 / Math.PI);
  const relative = normalizeAngle(angle - geometry.rotation);
  return Math.min(
    geometry.sectors.length - 1,
    Math.floor(relative / geometry.sectorAngle)
  );
}
