'use client';
import { useState } from 'react';
import { Clock3, Plus, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  duration,
  formatDuration,
  localDate,
  totalInPeriod,
  type Atelier,
  type Session,
} from '@/lib/atelier';
import { Empty, Choice, dateLabel, clockLabel } from './ui';
export function SessionList({
  state,
  paintingId,
  edit,
  add,
}: {
  state: Atelier;
  paintingId?: string;
  edit: (s: Session) => void;
  add: () => void;
}) {
  const sessions = state.sessions
    .filter((s) => !paintingId || s.paintingId === paintingId)
    .sort(
      (a, b) => b.date.localeCompare(a.date) || (b.start ?? 0) - (a.start ?? 0),
    );
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>
            {sessions.length}{' '}
            {sessions.length === 1 ? 'Malsitzung' : 'Malsitzungen'}
          </h2>
          <p className="muted">
            Tippe auf eine Sitzung, um ihre Zeit zu korrigieren.
          </p>
        </div>
        <button
          className="secondary"
          disabled={!state.paintings.length}
          onClick={add}
        >
          <Plus size={17} />
          Zeit nachtragen
        </button>
      </div>
      {sessions.length ? (
        <div className="session-list">
          {sessions.map((s) => (
            <button className="session-row" key={s.id} onClick={() => edit(s)}>
              <span className="session-icon">
                <Clock3 size={20} />
              </span>
              <span className="session-main">
                <strong>
                  {paintingId
                    ? dateLabel(s.date)
                    : state.paintings.find((p) => p.id === s.paintingId)?.title}
                </strong>
                <span>
                  {!paintingId && `${dateLabel(s.date)} · `}
                  {s.mode === 'range'
                    ? `${clockLabel(s.start!)} – ${localDate(s.start!) !== localDate(s.end!) ? dateLabel(s.end!) + ' · ' : ''}${clockLabel(s.end!)}`
                    : 'Nachgetragene Dauer'}
                  {s.breaks.length ? ' · mit Pause' : ''}
                </span>
                {s.note && <span className="session-note">{s.note}</span>}
              </span>
              <strong className="session-duration">
                {formatDuration(duration(s))}
              </strong>
              <Pencil size={15} />
            </button>
          ))}
        </div>
      ) : (
        <Empty
          icon={<Clock3 size={28} />}
          title="Zeit für den ersten Pinselstrich."
          description={
            state.paintings.length
              ? 'Starte einen Timer bei deinem Bild oder trage eine Malsitzung nach.'
              : 'Lege zuerst ein Bild an, um deine Malzeit zu erfassen.'
          }
        />
      )}
    </>
  );
}
export function Statistics({ state }: { state: Atelier }) {
  const [period, setPeriod] = useState('week');
  const [offset, setOffset] = useState(0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  let end: Date;
  let title: string;
  const buckets: { start: number; end: number; label: string; full: string }[] =
    [];
  if (period === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + offset * 7);
    end = new Date(start);
    end.setDate(end.getDate() + 7);
    title = `${dateLabel(start.getTime())} – ${dateLabel(end.getTime() - 1)}`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const n = new Date(d);
      n.setDate(n.getDate() + 1);
      buckets.push({
        start: d.getTime(),
        end: n.getTime(),
        label: d.toLocaleDateString('de-DE', { weekday: 'short' }),
        full: dateLabel(d.getTime()),
      });
    }
  } else if (period === 'month') {
    start.setDate(1);
    start.setMonth(start.getMonth() + offset);
    end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    title = start.toLocaleDateString('de-DE', {
      month: 'long',
      year: 'numeric',
    });
    for (
      let i = 0;
      i < new Date(end.getFullYear(), end.getMonth(), 0).getDate();
      i++
    ) {
      const d = new Date(start);
      d.setDate(i + 1);
      const n = new Date(d);
      n.setDate(n.getDate() + 1);
      buckets.push({
        start: d.getTime(),
        end: n.getTime(),
        label: String(i + 1),
        full: dateLabel(d.getTime()),
      });
    }
  } else {
    start.setMonth(0, 1);
    start.setFullYear(start.getFullYear() + offset);
    end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    title = String(start.getFullYear());
    for (let i = 0; i < 12; i++) {
      const d = new Date(start);
      d.setMonth(i);
      const n = new Date(d);
      n.setMonth(n.getMonth() + 1);
      buckets.push({
        start: d.getTime(),
        end: n.getTime(),
        label: d.toLocaleDateString('de-DE', { month: 'short' }),
        full: d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
      });
    }
  }
  const values = buckets.map((b) =>
    totalInPeriod(state.sessions, b.start, b.end),
  );
  const max = Math.max(...values, 3600000);
  const total = totalInPeriod(state.sessions, start.getTime(), end.getTime());
  const sessions = state.sessions.filter(
    (s) => totalInPeriod([s], start.getTime(), end.getTime()) > 0,
  );
  const ranked = state.paintings
    .map((p) => ({
      painting: p,
      time: totalInPeriod(
        state.sessions.filter((s) => s.paintingId === p.id),
        start.getTime(),
        end.getTime(),
      ),
    }))
    .filter((p) => p.time > 0)
    .sort((a, b) => b.time - a.time);
  return (
    <div className="statistics">
      <div className="section-heading">
        <h2>Deine Malzeit im Blick</h2>
        <Choice
          label="Statistikzeitraum"
          value={period}
          onChange={(v) => {
            setPeriod(v);
            setOffset(0);
          }}
          options={[
            { value: 'week', label: 'Woche' },
            { value: 'month', label: 'Monat' },
            { value: 'year', label: 'Jahr' },
          ]}
        />
      </div>
      <section className="chart-card">
        <div className="chart-heading">
          <button
            className="icon-button"
            aria-label="Vorheriger Zeitraum"
            onClick={() => setOffset(offset - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <h3>{title}</h3>
          <button
            className="icon-button"
            aria-label="Nächster Zeitraum"
            disabled={offset >= 0}
            onClick={() => setOffset(offset + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="chart-total">
          {formatDuration(total)}
          <small>{sessions.length} Malsitzungen in diesem Zeitraum</small>
        </div>
        <div
          className="chart"
          role="img"
          aria-label={`Malzeit pro ${period === 'year' ? 'Monat' : 'Tag'}: ${buckets.map((b, i) => `${b.full}: ${formatDuration(values[i])}`).join(', ')}`}
        >
          <div className="chart-scale">{formatDuration(max)}</div>
          <div className={'bars ' + (period === 'month' ? 'dense' : '')}>
            {buckets.map((b, i) => (
              <div
                className="bar-column"
                key={b.start}
                title={`${b.full}: ${formatDuration(values[i])}`}
              >
                <div className="bar-track">
                  <div
                    className={'bar ' + (values[i] ? 'has-time' : '')}
                    style={{
                      height: `${Math.max(values[i] ? 2 : 0, (values[i] / max) * 100)}%`,
                    }}
                  />
                </div>
                <span>
                  {period === 'month' && i % 5 !== 0 && i !== buckets.length - 1
                    ? ''
                    : b.label}
                </span>
              </div>
            ))}
          </div>
        </div>
        {!total && (
          <p className="hint chart-empty">
            In diesem Zeitraum wurde noch keine Malzeit erfasst.
          </p>
        )}
      </section>
      <div className="stats-details">
        <section>
          <h3>Zeit pro Bild</h3>
          {ranked.length ? (
            ranked.map(({ painting: p, time }) => (
              <div className="ranking" key={p.id}>
                <div className="row-between">
                  <span>{p.title}</span>
                  <strong>{formatDuration(time)}</strong>
                </div>
                <div className="ranking-track">
                  <span style={{ width: `${(time / total) * 100}%` }} />
                </div>
              </div>
            ))
          ) : (
            <p className="muted">
              Deine Bilder erscheinen hier, sobald du Zeit erfasst hast.
            </p>
          )}
        </section>
        <section className="stat-note">
          <Clock3 size={23} />
          <p>Durchschnittliche Malsitzung</p>
          <strong>
            {sessions.length ? formatDuration(total / sessions.length) : '–'}
          </strong>
          <span>im gewählten Zeitraum</span>
        </section>
      </div>
    </div>
  );
}
