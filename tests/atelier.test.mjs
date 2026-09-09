import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshAtelier,
  rangeDuration,
  parseDuration,
  beginTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  activeDuration,
  duration,
  durationInPeriod,
  totalInPeriod,
  localDate,
  validateBackup,
  paintingArea,
  techniquePriceFactor,
  estimatePaintingPrice,
} from '../lib/atelier.ts';
const hour = 3600000;
const base = () => ({
  ...freshAtelier(),
  paintings: [
    {
      id: 'p1',
      title: 'Abendlicht',
      dimensions: '50 × 70 cm',
      technique: 'Acryl',
      status: 'working',
      createdAt: 1000,
      photos: [],
    },
  ],
});
void test('A timer survives JSON restoration and a closed app for days', () => {
  const state = beginTimer(base(), 'p1', 1000);
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(activeDuration(restored.active, 1000 + 72 * hour), 72 * hour);
});
void test('Only one active timer, including when paused', () => {
  const running = beginTimer(base(), 'p1', 1000);
  assert.throws(() => beginTimer(running, 'p1', 2000));
  assert.throws(() => beginTimer(pauseTimer(running, 3000), 'p1', 4000));
  assert.throws(() => beginTimer(base(), 'missing', 1000));
});
void test('Pauses are excluded, including stopping while paused', () => {
  let s = beginTimer(base(), 'p1', 1000);
  s = pauseTimer(s, 1000 + hour);
  assert.equal(activeDuration(s.active, 1000 + 9 * hour), hour);
  s = resumeTimer(s, 1000 + 3 * hour);
  s = pauseTimer(s, 1000 + 4 * hour);
  s = stopTimer(s, 'session', 1000 + 9 * hour);
  assert.equal(duration(s.sessions[0]), 2 * hour);
  assert.equal(s.sessions[0].end, 1000 + 4 * hour);
  assert.equal(s.active, null);
});
void test('Late stop corrected by two hours updates duration', () => {
  const s = stopTimer(
    beginTimer(base(), 'p1', 1000),
    'session',
    1000 + 5 * hour,
  ).sessions[0];
  assert.equal(duration({ ...s, end: s.end - 2 * hour }), 3 * hour);
});
void test('Moving start and end clips pauses and merges overlapping breaks', () => {
  assert.equal(
    rangeDuration(0, 10 * hour, [
      { start: hour, end: 4 * hour },
      { start: 3 * hour, end: 5 * hour },
    ]),
    6 * hour,
  );
  assert.equal(
    rangeDuration(2 * hour, 4 * hour, [{ start: hour, end: 3 * hour }]),
    hour,
  );
  assert.equal(
    rangeDuration(0, hour, [{ start: 2 * hour, end: 3 * hour }]),
    hour,
  );
});
void test('Explicit H:MM parses 1:30 and rejects ambiguous or empty durations', () => {
  assert.equal(parseDuration('1:30'), 90 * 60000);
  assert.equal(parseDuration('125:05'), 7505 * 60000);
  for (const value of ['0:00', '1:99', '-1:30', '1.5', '30', '', '1:2'])
    assert.throws(() => parseDuration(value));
});
void test('Sessions spanning midnight are allocated to the correct days', () => {
  const start = new Date('2026-09-07T23:00:00').getTime();
  const midnight = new Date('2026-09-08T00:00:00').getTime();
  const s = {
    id: 's',
    paintingId: 'p1',
    mode: 'range',
    date: localDate(start),
    start,
    end: midnight + hour,
    breaks: [{ start: midnight - 15 * 60000, end: midnight + 15 * 60000 }],
    note: '',
  };
  assert.equal(durationInPeriod(s, start, midnight), 45 * 60000);
  assert.equal(durationInPeriod(s, midnight, midnight + hour), 45 * 60000);
  assert.equal(totalInPeriod([s], start, midnight + hour), 90 * 60000);
});
void test('Fixed durations are assigned to their chosen local date', () => {
  const s = {
    id: 's',
    paintingId: 'p1',
    mode: 'duration',
    date: '2026-09-07',
    durationMs: 90 * 60000,
    breaks: [],
    note: '',
  };
  assert.equal(
    durationInPeriod(
      s,
      new Date('2026-09-07T00:00:00').getTime(),
      new Date('2026-09-08T00:00:00').getTime(),
    ),
    90 * 60000,
  );
  assert.equal(
    durationInPeriod(
      s,
      new Date('2026-09-08T00:00:00').getTime(),
      new Date('2026-09-09T00:00:00').getTime(),
    ),
    0,
  );
});
void test('Backup round trip retains photos, descriptions, sessions and active timer', () => {
  let s = base();
  s.paintings[0].photos = [
    {
      id: 'photo1',
      data: 'data:image/jpeg;base64,YQ==',
      date: '2026-09-07',
      note: 'Erste Farbschichten',
    },
  ];
  s.paintings[0].coverId = 'photo1';
  s = stopTimer(beginTimer(s, 'p1', 1000), 'session', 1000 + hour);
  s = beginTimer(s, 'p1', 1000 + 2 * hour);
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s))), s);
});
void test('Corrupt, future-version, orphan, duplicate and unsafe image backups rejected', () => {
  for (const alter of [
    (s) => {
      s.version = 2;
    },
    (s) => {
      s.paintings.push(s.paintings[0]);
    },
    (s) => {
      s.active = {
        paintingId: 'missing',
        start: 1,
        pausedAt: null,
        breaks: [],
      };
    },
    (s) => {
      s.sessions = [
        {
          id: 's',
          paintingId: 'p1',
          mode: 'duration',
          date: '2026-02-30',
          durationMs: 5,
          breaks: [],
          note: '',
        },
      ];
    },
    (s) => {
      s.paintings[0].photos = [
        {
          id: 'x',
          data: 'data:image/svg+xml;base64,YQ==',
          date: '2026-09-07',
          note: '',
        },
      ];
    },
    (s) => {
      delete s.sessions;
    },
  ]) {
    const s = base();
    alter(s);
    assert.throws(() => validateBackup(s));
  }
  assert.throws(() => validateBackup(null));
  assert.throws(() => validateBackup({}));
});
void test('Clock changes cannot cause invalid pause/stop records', () => {
  const s = beginTimer(base(), 'p1', 5000);
  assert.throws(() => pauseTimer(s, 4000));
  assert.throws(() => stopTimer(s, 'x', 4000));
  assert.throws(() => resumeTimer(pauseTimer(s, 6000), 5000));
});

void test('Price estimate is driven mainly by time, with format and technique', () => {
  assert.equal(paintingArea('50 × 70 cm'), 0.35);
  assert.equal(paintingArea('500 x 700 mm'), 0.35);
  assert.equal(paintingArea('0,5 × 0,7 m'), 0.35);
  assert.equal(paintingArea('DIN A3'), null);
  assert.equal(techniquePriceFactor('Öl auf Leinwand'), 1.35);
  assert.equal(techniquePriceFactor('Aquarell auf Papier'), 0.75);
  assert.deepEqual(
    estimatePaintingPrice(
      { dimensions: '50 × 70 cm', technique: 'Acryl auf Leinwand' },
      10 * hour,
    ),
    {
      total: 335,
      labor: 300,
      formatAndTechnique: 35,
      areaSquareMeters: 0.35,
      techniqueFactor: 1,
    },
  );
});

void test('Backups accept an optional price estimate flag and reject wrong types', () => {
  const enabled = base();
  enabled.paintings[0].priceEstimateEnabled = true;
  assert.deepEqual(validateBackup(enabled), enabled);
  const invalid = base();
  invalid.paintings[0].priceEstimateEnabled = 'yes';
  assert.throws(() => validateBackup(invalid));
});
