import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRadialArenaGeometry,
  hitTestRadialSector,
  polarPoint,
} from '../gameplay/radialGeometry.ts';
import {
  assignRadialPointer,
  createRadialPointerOwnership,
  invalidateRadialPointers,
  releaseRadialPointer,
} from '../gameplay/radialPointerOwnership.ts';
import type { GeneralPlayerId } from '../gameplay/multiplayerEngine.ts';
import {
  addCalibrationPointers,
  createTouchCalibrationState,
  normalizeObservedTouchCapacity,
  removeCalibrationPointers,
} from '../settings/touchCapacity.ts';

test('radial geometry creates equal 2 through 8 player sectors covering 360 degrees', () => {
  for (let count = 2; count <= 8; count += 1) {
    const geometry = createRadialArenaGeometry({ playerCount: count, width: 800, height: 700 });
    assert.equal(geometry.sectors.length, count);
    assert.equal(geometry.sectorAngle, 360 / count);
    assert.equal(geometry.sectors.at(-1)!.endAngle - geometry.sectors[0]!.startAngle, 360);
    geometry.sectors.forEach((sector, index) => {
      assert.equal(sector.index, index);
      assert.ok(Math.abs((sector.endAngle - sector.startAngle) - 360 / count) < 1e-10);
      assert.ok(sector.path.endsWith('Z'));
    });
  }
});

test('radial geometry stays circular across portrait, landscape, and square viewports', () => {
  for (const [width, height] of [[600, 1_000], [1_000, 600], [800, 800]]) {
    const geometry = createRadialArenaGeometry({ playerCount: 8, width, height, padding: 10 });
    assert.equal(geometry.outerRadius, Math.min(width, height) / 2 - 10);
    assert.deepEqual(geometry.center, { x: width / 2, y: height / 2 });
  }
});

test('sector midpoint hit testing has complete non-overlapping ownership', () => {
  for (let count = 2; count <= 8; count += 1) {
    const geometry = createRadialArenaGeometry({ playerCount: count, width: 800, height: 800 });
    const radius = (geometry.innerRadius + geometry.outerRadius) / 2;
    geometry.sectors.forEach((sector) => {
      const point = polarPoint(geometry.center, radius, sector.midAngle);
      assert.equal(hitTestRadialSector(geometry, point.x, point.y), sector.index);
    });
  }
});

test('exact boundaries deterministically belong to the following clockwise sector', () => {
  const geometry = createRadialArenaGeometry({ playerCount: 8, width: 800, height: 800 });
  const radius = (geometry.innerRadius + geometry.outerRadius) / 2;
  const boundary = polarPoint(geometry.center, radius, geometry.sectors[1]!.startAngle);
  assert.equal(hitTestRadialSector(geometry, boundary.x, boundary.y), 1);
  const wrapped = polarPoint(geometry.center, radius, geometry.rotation + 360);
  assert.equal(hitTestRadialSector(geometry, wrapped.x, wrapped.y), 0);
});

test('center and outside-circle touches are excluded', () => {
  const geometry = createRadialArenaGeometry({ playerCount: 6, width: 700, height: 700 });
  assert.equal(hitTestRadialSector(geometry, geometry.center.x, geometry.center.y), null);
  assert.equal(hitTestRadialSector(geometry, -1, -1), null);
  const inner = polarPoint(geometry.center, geometry.innerRadius - 0.01, 0);
  const outer = polarPoint(geometry.center, geometry.outerRadius + 0.01, 0);
  assert.equal(hitTestRadialSector(geometry, inner.x, inner.y), null);
  assert.equal(hitTestRadialSector(geometry, outer.x, outer.y), null);
});

test('arena rotation changes angular ownership without changing sector sizes', () => {
  const first = createRadialArenaGeometry({ playerCount: 5, width: 700, height: 700, rotation: -90 });
  const rotated = createRadialArenaGeometry({ playerCount: 5, width: 700, height: 700, rotation: 0 });
  assert.equal(first.sectorAngle, rotated.sectorAngle);
  const point = polarPoint(rotated.center, 200, rotated.sectors[0]!.midAngle);
  assert.equal(hitTestRadialSector(rotated, point.x, point.y), 0);
  assert.notEqual(hitTestRadialSector(first, point.x, point.y), 0);
});

function playerIds(count: number) {
  return Array.from({ length: count }, (_, index) => `p${index + 1}` as GeneralPlayerId);
}

test('pointer IDs assign independently to 2, 4, and 8 simultaneous sectors', () => {
  for (const count of [2, 4, 8]) {
    const geometry = createRadialArenaGeometry({ playerCount: count, width: 800, height: 800 });
    const ids = playerIds(count);
    const active = new Set(ids);
    let ownership = createRadialPointerOwnership(3);
    geometry.sectors.forEach((sector, index) => {
      const point = polarPoint(geometry.center, 250, sector.midAngle);
      const assigned = assignRadialPointer(ownership, 3, 100 + index, point.x, point.y, geometry, ids, active);
      ownership = assigned.state;
      assert.equal(assigned.playerId, ids[index]);
    });
    assert.equal(ownership.pointerToPlayer.size, count);
  }
});

test('pointer release uses original ID despite touch-array reordering or release position', () => {
  const geometry = createRadialArenaGeometry({ playerCount: 4, width: 800, height: 800 });
  const ids = playerIds(4);
  const active = new Set(ids);
  let ownership = createRadialPointerOwnership(1);
  for (const [pointerId, sectorIndex] of [[44, 0], [12, 1], [99, 2]] as const) {
    const point = polarPoint(geometry.center, 250, geometry.sectors[sectorIndex]!.midAngle);
    ownership = assignRadialPointer(ownership, 1, pointerId, point.x, point.y, geometry, ids, active).state;
  }
  const secondRelease = releaseRadialPointer(ownership, 1, 12);
  assert.equal(secondRelease.playerId, 'p2');
  const firstRelease = releaseRadialPointer(secondRelease.state, 1, 44);
  assert.equal(firstRelease.playerId, 'p1');
  assert.equal(releaseRadialPointer(firstRelease.state, 1, 12).playerId, null);
});

test('cross-sector movement cannot change established pointer ownership', () => {
  const geometry = createRadialArenaGeometry({ playerCount: 8, width: 800, height: 800 });
  const ids = playerIds(8);
  const point = polarPoint(geometry.center, 250, geometry.sectors[0]!.midAngle);
  const assigned = assignRadialPointer(
    createRadialPointerOwnership(1), 1, 7, point.x, point.y, geometry, ids, new Set(ids)
  );
  assert.equal(assigned.state.pointerToPlayer.get(7), 'p1');
  assert.equal(releaseRadialPointer(assigned.state, 1, 7).playerId, 'p1');
});

test('second contact in one sector cannot replace its controlling pointer', () => {
  const geometry = createRadialArenaGeometry({ playerCount: 5, width: 800, height: 800 });
  const ids = playerIds(5);
  const point = polarPoint(geometry.center, 250, geometry.sectors[2]!.midAngle);
  const first = assignRadialPointer(
    createRadialPointerOwnership(1), 1, 10, point.x, point.y, geometry, ids, new Set(ids)
  );
  const second = assignRadialPointer(first.state, 1, 11, point.x, point.y, geometry, ids, new Set(ids));
  assert.equal(first.playerId, 'p3');
  assert.equal(second.playerId, null);
  assert.equal(second.state.playerToPointer.get('p3'), 10);
  assert.equal(releaseRadialPointer(second.state, 1, 11).playerId, null);
});

test('center, eliminated sectors, cancellation, and stale generations reject ownership', () => {
  const geometry = createRadialArenaGeometry({ playerCount: 5, width: 800, height: 800 });
  const ids = playerIds(5);
  const active = new Set(ids.slice(0, 4));
  let ownership = createRadialPointerOwnership(2);
  const center = assignRadialPointer(ownership, 2, 1, 400, 400, geometry, ids, active);
  assert.equal(center.playerId, null);
  const eliminatedPoint = polarPoint(geometry.center, 250, geometry.sectors[4]!.midAngle);
  assert.equal(assignRadialPointer(ownership, 2, 2, eliminatedPoint.x, eliminatedPoint.y, geometry, ids, active).playerId, null);
  ownership = invalidateRadialPointers(ownership);
  const activePoint = polarPoint(geometry.center, 250, geometry.sectors[0]!.midAngle);
  assert.equal(assignRadialPointer(ownership, 2, 3, activePoint.x, activePoint.y, geometry, ids, active).playerId, null);
  assert.equal(releaseRadialPointer(ownership, 2, 3).playerId, null);
});

test('calibration tracks distinct active IDs and the highest observed count', () => {
  let state = createTouchCalibrationState();
  state = addCalibrationPointers(state, [9, 2, 7, 2]);
  assert.equal(state.activePointerIds.size, 3);
  assert.equal(state.highestObserved, 3);
  state = removeCalibrationPointers(state, [2]);
  state = addCalibrationPointers(state, [11, 12]);
  assert.equal(state.activePointerIds.size, 4);
  assert.equal(state.highestObserved, 4);
  assert.equal(normalizeObservedTouchCapacity('8'), 8);
  assert.equal(normalizeObservedTouchCapacity(12), 8);
  assert.equal(normalizeObservedTouchCapacity('unknown'), null);
});
