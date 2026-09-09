export type TimeRange = { start: number; end: number };
export type Photo = { id: string; data: string; date: string; note: string };
export type Painting = {
  id: string;
  title: string;
  dimensions: string;
  technique: string;
  priceEstimateEnabled?: boolean;
  status: 'working' | 'finished';
  createdAt: number;
  photos: Photo[];
  coverId?: string;
};

export type PriceEstimate = {
  total: number;
  labor: number;
  formatAndTechnique: number;
  areaSquareMeters: number | null;
  techniqueFactor: number;
};

export const PRICE_ESTIMATE_HOURLY_RATE = 30;
const PRICE_ESTIMATE_AREA_RATE = 100;

export function paintingArea(dimensions: string): number | null {
  const match =
    /(\d+(?:[.,]\d+)?)\s*(?:x|×)\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i.exec(
      dimensions,
    );
  if (!match) return null;
  const width = Number(match[1].replace(',', '.'));
  const height = Number(match[2].replace(',', '.'));
  if (!(width > 0) || !(height > 0)) return null;
  const unit = match[3]?.toLowerCase() ?? 'cm';
  const metersPerUnit = unit === 'm' ? 1 : unit === 'mm' ? 0.001 : 0.01;
  const area =
    Math.round(width * height * metersPerUnit * metersPerUnit * 1000000) /
    1000000;
  return area <= 100 ? area : null;
}

export function techniquePriceFactor(technique: string): number {
  const value = technique.toLocaleLowerCase('de-DE');
  if (['öl', 'oel', 'encaustic', 'wachs'].some((word) => value.includes(word)))
    return 1.35;
  if (
    ['mischtechnik', 'mixed media', 'collage', 'pastell'].some((word) =>
      value.includes(word),
    )
  )
    return 1.2;
  if (
    ['aquarell', 'zeichnung', 'bleistift', 'kohle', 'tusche'].some((word) =>
      value.includes(word),
    )
  )
    return 0.75;
  if (['digital', 'procreate'].some((word) => value.includes(word)))
    return 0.35;
  return 1;
}

export function estimatePaintingPrice(
  painting: Pick<Painting, 'dimensions' | 'technique'>,
  durationMs: number,
): PriceEstimate {
  const areaSquareMeters = paintingArea(painting.dimensions);
  const techniqueFactor = techniquePriceFactor(painting.technique);
  const labor =
    (Math.max(0, durationMs) / 3600000) * PRICE_ESTIMATE_HOURLY_RATE;
  const formatAndTechnique =
    (areaSquareMeters ?? 0) * PRICE_ESTIMATE_AREA_RATE * techniqueFactor;
  const rawTotal = labor + formatAndTechnique;
  return {
    total: rawTotal > 0 ? Math.max(5, Math.round(rawTotal / 5) * 5) : 0,
    labor,
    formatAndTechnique,
    areaSquareMeters,
    techniqueFactor,
  };
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}
export type Session = {
  id: string;
  paintingId: string;
  mode: 'range' | 'duration';
  date: string;
  start?: number;
  end?: number;
  durationMs?: number;
  breaks: TimeRange[];
  note: string;
};
export type ActiveTimer = {
  paintingId: string;
  start: number;
  pausedAt: number | null;
  breaks: TimeRange[];
};
export type Atelier = {
  version: 1;
  paintings: Painting[];
  sessions: Session[];
  active: ActiveTimer | null;
  lastBackup: number | null;
};
export const freshAtelier = (): Atelier => ({
  version: 1,
  paintings: [],
  sessions: [],
  active: null,
  lastBackup: null,
});
export function localDate(time = Date.now()): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function localDateTime(time = Date.now()): string {
  const d = new Date(time);
  return `${localDate(time)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
export function rangeDuration(
  start: number,
  end: number,
  breaks: TimeRange[] = [],
): number {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  const sorted = breaks
    .map((b) => ({
      start: Math.max(start, b.start),
      end: Math.min(end, b.end),
    }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);
  let paused = 0,
    previousEnd = start;
  for (const b of sorted) {
    paused += Math.max(0, b.end - Math.max(previousEnd, b.start));
    previousEnd = Math.max(previousEnd, b.end);
  }
  return Math.max(0, end - start - paused);
}
export function duration(session: Session): number {
  return session.mode === 'duration'
    ? (session.durationMs ?? 0)
    : rangeDuration(session.start!, session.end!, session.breaks);
}
export function activeDuration(active: ActiveTimer, now = Date.now()): number {
  return rangeDuration(active.start, active.pausedAt ?? now, active.breaks);
}
export function formatDuration(ms: number, seconds = false): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  return seconds
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
    : h
      ? `${h} Std. ${String(m).padStart(2, '0')} Min.`
      : `${m} Min.`;
}
export function parseDuration(value: string): number {
  const m = /^(\d{1,5}):([0-5]\d)$/.exec(value.trim());
  if (!m)
    throw new Error(
      'Bitte die Dauer als Stunden:Minuten eingeben, zum Beispiel 1:30.',
    );
  const ms = (Number(m[1]) * 60 + Number(m[2])) * 60000;
  if (ms <= 0) throw new Error('Die Dauer muss größer als null sein.');
  return ms;
}
export function durationInPeriod(
  s: Session,
  start: number,
  end: number,
): number {
  if (s.mode === 'duration') {
    const t = new Date(`${s.date}T12:00:00`).getTime();
    return t >= start && t < end ? duration(s) : 0;
  }
  return rangeDuration(
    Math.max(start, s.start!),
    Math.min(end, s.end!),
    s.breaks,
  );
}
export function totalInPeriod(
  sessions: Session[],
  start: number,
  end: number,
): number {
  return sessions.reduce((sum, s) => sum + durationInPeriod(s, start, end), 0);
}
export function beginTimer(
  state: Atelier,
  paintingId: string,
  now = Date.now(),
): Atelier {
  if (state.active)
    throw new Error('Es ist bereits ein Timer aktiv. Beende ihn zuerst.');
  if (!state.paintings.some((p) => p.id === paintingId))
    throw new Error('Das Bild wurde nicht gefunden.');
  return {
    ...state,
    active: { paintingId, start: now, pausedAt: null, breaks: [] },
  };
}
export function pauseTimer(state: Atelier, now = Date.now()): Atelier {
  if (!state.active || state.active.pausedAt !== null)
    throw new Error('Kein laufender Timer vorhanden.');
  if (now < state.active.start)
    throw new Error(
      'Bitte den Startzeitpunkt prüfen: Die Gerätezeit hat sich geändert.',
    );
  return { ...state, active: { ...state.active, pausedAt: now } };
}
export function resumeTimer(state: Atelier, now = Date.now()): Atelier {
  if (!state.active || state.active.pausedAt === null)
    throw new Error('Kein pausierter Timer vorhanden.');
  if (now < state.active.pausedAt)
    throw new Error('Bitte die Gerätezeit prüfen.');
  return {
    ...state,
    active: {
      ...state.active,
      pausedAt: null,
      breaks: [
        ...state.active.breaks,
        { start: state.active.pausedAt, end: now },
      ],
    },
  };
}
export function stopTimer(
  state: Atelier,
  id: string,
  now = Date.now(),
): Atelier {
  const a = state.active;
  if (!a) throw new Error('Kein Timer vorhanden.');
  const end = a.pausedAt ?? now;
  if (end <= a.start || activeDuration(a, now) <= 0)
    throw new Error('Der Timer muss mindestens einen Moment laufen.');
  const s: Session = {
    id,
    paintingId: a.paintingId,
    mode: 'range',
    date: localDate(a.start),
    start: a.start,
    end,
    breaks: a.breaks,
    note: '',
  };
  return { ...state, active: null, sessions: [...state.sessions, s] };
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number =>
  typeof v === 'number' &&
  Number.isFinite(v) &&
  v >= 0 &&
  v <= 8640000000000000;
const str = (v: unknown, max = 10000): v is string =>
  typeof v === 'string' && v.length <= max;
const date = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(new Date(v + 'T12:00:00').getTime()) &&
  localDate(new Date(v + 'T12:00:00').getTime()) === v;
function validBreaks(v: unknown): v is TimeRange[] {
  return (
    Array.isArray(v) &&
    v.every(
      (b) => record(b) && finite(b.start) && finite(b.end) && b.end >= b.start,
    )
  );
}
export function validateBackup(value: unknown): Atelier {
  const fail = () => {
    throw new Error(
      'Diese Datei ist keine gültige Malzeit-Sicherung. Deine vorhandenen Daten bleiben erhalten.',
    );
  };
  if (
    !record(value) ||
    value.version !== 1 ||
    !Array.isArray(value.paintings) ||
    !Array.isArray(value.sessions) ||
    value.paintings.length > 10000 ||
    value.sessions.length > 200000
  )
    return fail();
  const ids = new Set<string>();
  const photoIds = new Set<string>();
  for (const p of value.paintings) {
    if (
      !record(p) ||
      !str(p.id, 100) ||
      !p.id ||
      ids.has(p.id) ||
      !str(p.title, 200) ||
      !p.title.trim() ||
      !str(p.dimensions, 200) ||
      !str(p.technique, 200) ||
      !(
        p.priceEstimateEnabled === undefined ||
        typeof p.priceEstimateEnabled === 'boolean'
      ) ||
      !['working', 'finished'].includes(String(p.status)) ||
      !finite(p.createdAt) ||
      !Array.isArray(p.photos)
    )
      return fail();
    ids.add(p.id);
    for (const ph of p.photos) {
      if (
        !record(ph) ||
        !str(ph.id, 100) ||
        photoIds.has(ph.id) ||
        !str(ph.data, 15000000) ||
        !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
          ph.data,
        ) ||
        !date(ph.date) ||
        !str(ph.note)
      )
        return fail();
      photoIds.add(ph.id);
    }
    if (
      p.coverId !== undefined &&
      (!str(p.coverId, 100) || !p.photos.some((ph) => ph.id === p.coverId))
    )
      return fail();
  }
  const sessionIds = new Set<string>();
  for (const s of value.sessions) {
    if (
      !record(s) ||
      !str(s.id, 100) ||
      !s.id ||
      sessionIds.has(s.id) ||
      !str(s.paintingId, 100) ||
      !ids.has(s.paintingId) ||
      !date(s.date) ||
      !str(s.note) ||
      !validBreaks(s.breaks)
    )
      return fail();
    sessionIds.add(s.id);
    if (s.mode === 'range') {
      if (
        !finite(s.start) ||
        !finite(s.end) ||
        s.end <= s.start ||
        rangeDuration(s.start, s.end, s.breaks) <= 0
      )
        return fail();
    } else if (s.mode === 'duration') {
      if (!finite(s.durationMs) || s.durationMs <= 0) return fail();
    } else return fail();
  }
  if (value.active !== null) {
    const a = value.active;
    if (
      !record(a) ||
      !str(a.paintingId, 100) ||
      !ids.has(a.paintingId) ||
      !finite(a.start) ||
      !(a.pausedAt === null || (finite(a.pausedAt) && a.pausedAt >= a.start)) ||
      !validBreaks(a.breaks)
    )
      return fail();
  }
  if (value.lastBackup !== null && !finite(value.lastBackup)) return fail();
  return structuredClone(value) as Atelier;
}
