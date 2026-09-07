'use client';
import {
  ArrowLeft,
  ArrowUpRight,
  Pencil,
  ImagePlus,
  Clock3,
  Images,
  CalendarDays,
  Play,
  Plus,
  Camera,
  Trash2,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatDuration, type Atelier, type Painting } from '@/lib/atelier';
import {
  cover,
  paintingTime,
  dateLabel,
  Empty,
  type Mutate,
  type Ask,
} from './ui';
import { SessionList } from './statistics';
export type Modal =
  | { kind: 'painting'; id?: string }
  | { kind: 'session'; paintingId?: string; id?: string }
  | { kind: 'photo'; paintingId: string; id?: string }
  | { kind: 'timer' }
  | { kind: 'settings' }
  | { kind: 'viewer'; paintingId: string; id: string }
  | null;
export function PaintingDetail({
  painting,
  state,
  busy,
  start,
  back,
  open,
  ask,
  mutate,
}: {
  painting: Painting;
  state: Atelier;
  busy: boolean;
  start: (id: string) => void;
  back: () => void;
  open: (m: Modal) => void;
  ask: Ask;
  mutate: Mutate;
}) {
  return (
    <>
      <button className="text-button back" onClick={back}>
        <ArrowLeft size={17} />
        Alle Bilder
      </button>
      <div className="detail-heading">
        <div>
          <p className="eyebrow">DEIN WERK</p>
          <h1>
            {painting.title}
            <span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            {[painting.technique, painting.dimensions]
              .filter(Boolean)
              .join(' · ') || 'Dein Bild, vom ersten Pinselstrich an.'}
          </p>
        </div>
        <button
          className="secondary"
          onClick={() => open({ kind: 'painting', id: painting.id })}
        >
          <Pencil size={16} />
          Bearbeiten
        </button>
      </div>
      <div className="detail-grid">
        <div className="detail-art">
          {cover(painting) ? (
            <button
              onClick={() =>
                open({
                  kind: 'viewer',
                  paintingId: painting.id,
                  id: cover(painting)!.id,
                })
              }
            >
              <img src={cover(painting)!.data} alt={painting.title} />
              <span>
                Foto ansehen
                <ArrowUpRight size={16} />
              </span>
            </button>
          ) : (
            <div className="art-placeholder">
              <ImagePlus size={44} strokeWidth={1} />
              <button
                className="secondary"
                onClick={() => open({ kind: 'photo', paintingId: painting.id })}
              >
                Erstes Foto hinzufügen
              </button>
            </div>
          )}
        </div>
        <section className="painting-summary">
          <span className={'badge ' + painting.status}>
            {painting.status === 'working' ? 'In Arbeit' : 'Fertiggestellt'}
          </span>
          <p className="muted">Gesamte Malzeit</p>
          <div className="total-display">
            {formatDuration(paintingTime(state, painting.id))}
          </div>
          <div className="painting-meta">
            <span>
              <Clock3 size={16} />
              {
                state.sessions.filter((s) => s.paintingId === painting.id)
                  .length
              }{' '}
              Malsitzungen
            </span>
            <span>
              <Images size={16} />
              {painting.photos.length} Fortschrittsfotos
            </span>
            <span>
              <CalendarDays size={16} />
              Angelegt am {dateLabel(painting.createdAt)}
            </span>
          </div>
          <button
            className="primary"
            disabled={!!state.active || busy}
            onClick={() => start(painting.id)}
          >
            <Play size={16} fill="currentColor" />
            {state.active?.paintingId === painting.id
              ? 'Timer ist aktiv'
              : 'Malen beginnen'}
          </button>
          {state.active && state.active.paintingId !== painting.id && (
            <p className="hint">
              Beende zuerst den Timer für „
              {
                state.paintings.find((p) => p.id === state.active?.paintingId)
                  ?.title
              }
              “.
            </p>
          )}
          <button
            className="secondary"
            onClick={() => open({ kind: 'session', paintingId: painting.id })}
          >
            <Plus size={16} />
            Zeit nachtragen
          </button>
        </section>
      </div>
      <Tabs defaultValue="progress" className="detail-tabs">
        <TabsList className="main-tabs" variant="line">
          <TabsTrigger value="progress">
            <Images />
            Fortschritt
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Clock3 />
            Malsitzungen
          </TabsTrigger>
        </TabsList>
        <TabsContent value="progress">
          <div className="section-heading">
            <div>
              <h2>Vom Anfang bis zum letzten Detail</h2>
              <p className="muted">Deine Arbeitsschritte in Bildern.</p>
            </div>
            <button
              className="secondary"
              onClick={() => open({ kind: 'photo', paintingId: painting.id })}
            >
              <Plus size={17} />
              Schritt hinzufügen
            </button>
          </div>
          {painting.photos.length ? (
            <div className="progress-grid">
              {[...painting.photos]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((ph, i) => (
                  <article className="progress-card" key={ph.id}>
                    <button
                      className="photo-button"
                      onClick={() =>
                        open({
                          kind: 'viewer',
                          paintingId: painting.id,
                          id: ph.id,
                        })
                      }
                    >
                      <img
                        src={ph.data}
                        alt={ph.note || `Arbeitsschritt ${i + 1}`}
                        loading="lazy"
                      />
                      <span className="step-number">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </button>
                    <div className="progress-copy">
                      <div className="row-between">
                        <time>{dateLabel(ph.date)}</time>
                        <button
                          className="icon-button"
                          aria-label={`Arbeitsschritt ${i + 1} bearbeiten`}
                          onClick={() =>
                            open({
                              kind: 'photo',
                              paintingId: painting.id,
                              id: ph.id,
                            })
                          }
                        >
                          <Pencil size={15} />
                        </button>
                      </div>
                      <p>{ph.note || 'Noch keine Beschreibung.'}</p>
                      {cover(painting)?.id === ph.id && (
                        <small className="cover-label">Titelbild</small>
                      )}
                    </div>
                  </article>
                ))}
            </div>
          ) : (
            <Empty
              icon={<Camera size={28} />}
              title="Jeder Schritt zählt."
              description="Halte deinen ersten Arbeitsschritt mit einem Foto und einer Notiz fest."
              action={
                <button
                  className="primary"
                  onClick={() =>
                    open({ kind: 'photo', paintingId: painting.id })
                  }
                >
                  <Camera size={17} />
                  Foto hinzufügen
                </button>
              }
            />
          )}
        </TabsContent>
        <TabsContent value="sessions">
          <SessionList
            state={state}
            paintingId={painting.id}
            edit={(s) =>
              open({ kind: 'session', id: s.id, paintingId: s.paintingId })
            }
            add={() => open({ kind: 'session', paintingId: painting.id })}
          />
        </TabsContent>
      </Tabs>
      <div className="delete-painting">
        <button
          className="text-button"
          disabled={state.active?.paintingId === painting.id}
          onClick={() =>
            ask(
              'Bild löschen?',
              `„${painting.title}“ mit allen Malsitzungen und Fotos löschen? Das lässt sich nur mit einer Sicherung rückgängig machen.`,
              async () => {
                await mutate((s) => {
                  if (s.active?.paintingId === painting.id)
                    throw new Error('Bitte zuerst den Timer beenden.');
                  return {
                    ...s,
                    paintings: s.paintings.filter((p) => p.id !== painting.id),
                    sessions: s.sessions.filter(
                      (item) => item.paintingId !== painting.id,
                    ),
                  };
                }, 'Bild gelöscht.');
                back();
              },
            )
          }
        >
          <Trash2 size={15} />
          Bild löschen
        </button>
      </div>
    </>
  );
}
