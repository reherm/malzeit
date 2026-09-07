'use client';
import { useState, type SubmitEvent } from 'react';
import { Check, Images, Trash2, Pencil } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  localDate,
  localDateTime,
  duration,
  parseDuration,
  type Atelier,
  type Painting,
  type Session,
  type Photo,
} from '@/lib/atelier';
import {
  Choice,
  Field,
  Feedback,
  ModalFrame,
  PhotoPicker,
  cover,
  dateLabel,
  uid,
  type Mutate,
  type Ask,
} from './ui';

export function PaintingEditor({
  existing,
  mutate,
  close,
  done,
}: {
  existing?: Painting;
  mutate: Mutate;
  close: () => void;
  done: (id: string) => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [dimensions, setDimensions] = useState(existing?.dimensions ?? '');
  const [technique, setTechnique] = useState(existing?.technique ?? '');
  const [status, setStatus] = useState(existing?.status ?? 'working');
  const [photo, setPhoto] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Bitte gib deinem Bild einen Titel.');
      return;
    }
    setSaving(true);
    try {
      const id = existing?.id ?? uid();
      const firstPhoto: Photo | undefined = photo
        ? { id: uid(), data: photo, date: localDate(), note: 'Der Anfang.' }
        : undefined;
      await mutate(
        (s) => {
          if (existing) {
            if (!s.paintings.some((p) => p.id === id))
              throw new Error('Das Bild wurde inzwischen gelöscht.');
            return {
              ...s,
              paintings: s.paintings.map((p) =>
                p.id === id
                  ? {
                      ...p,
                      title: title.trim(),
                      dimensions: dimensions.trim(),
                      technique: technique.trim(),
                      status,
                    }
                  : p,
              ),
            };
          }
          return {
            ...s,
            paintings: [
              ...s.paintings,
              {
                id,
                title: title.trim(),
                dimensions: dimensions.trim(),
                technique: technique.trim(),
                status,
                createdAt: Date.now(),
                photos: firstPhoto ? [firstPhoto] : [],
              },
            ],
          };
        },
        existing ? 'Bild aktualisiert.' : 'Dein Bild wurde angelegt.',
      );
      done(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <ModalFrame
      title={existing ? 'Bild bearbeiten' : 'Ein neues Bild'}
      description={
        existing
          ? 'Passe die Angaben zu deinem Werk an.'
          : 'Gib deinem nächsten Werk einen Platz in deinem Atelier.'
      }
      close={close}
    >
      <form onSubmit={(e) => void submit(e)} className="editor-form">
        <Field label="Titel">
          <input
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Wie heißt dein Bild?"
          />
        </Field>
        <div className="form-grid">
          <Field label="Maße" hint="Breite × Höhe, z. B. 50 × 70 cm">
            <input
              maxLength={200}
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              placeholder="50 × 70 cm"
            />
          </Field>
          <Field label="Technik">
            <input
              maxLength={200}
              value={technique}
              onChange={(e) => setTechnique(e.target.value)}
              placeholder="z. B. Acryl auf Leinwand"
            />
          </Field>
        </div>
        <Field label="Status">
          <Choice
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as Painting['status'])}
            options={[
              { value: 'working', label: 'In Arbeit' },
              { value: 'finished', label: 'Fertiggestellt' },
            ]}
          />
        </Field>
        {!existing && (
          <div className="field">
            <span>
              Erstes Foto <small>(optional)</small>
            </span>
            <PhotoPicker value={photo} onChange={setPhoto} />
          </div>
        )}
        <Feedback error={error} />
        <div className="form-actions">
          <button type="button" className="secondary" onClick={close}>
            Abbrechen
          </button>
          <button className="primary" disabled={saving}>
            <Check size={17} />
            {saving
              ? 'Wird gespeichert …'
              : existing
                ? 'Änderungen speichern'
                : 'Bild anlegen'}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

export function SessionEditor({
  state,
  existing,
  initialPaintingId,
  mutate,
  close,
  ask,
}: {
  state: Atelier;
  existing?: Session;
  initialPaintingId?: string;
  mutate: Mutate;
  close: () => void;
  ask: Ask;
}) {
  const [paintingId, setPaintingId] = useState(
    existing?.paintingId ?? initialPaintingId ?? state.paintings[0]?.id ?? '',
  );
  const [mode, setMode] = useState<'range' | 'duration'>(
    existing?.mode ?? 'range',
  );
  const [start, setStart] = useState(() =>
    localDateTime(existing?.start ?? Date.now() - 3600000),
  );
  const [end, setEnd] = useState(() =>
    localDateTime(existing?.end ?? Date.now()),
  );
  const [date, setDate] = useState(existing?.date ?? localDate());
  const [fixed, setFixed] = useState(
    existing
      ? `${Math.floor(duration(existing) / 3600000)}:${String(Math.floor(duration(existing) / 60000) % 60).padStart(2, '0')}`
      : '1:30',
  );
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (!paintingId) throw new Error('Lege zuerst ein Bild an.');
      const session: Session = {
        id: existing?.id ?? uid(),
        paintingId,
        mode,
        date,
        note: note.trim(),
        breaks: mode === 'range' ? (existing?.breaks ?? []) : [],
      };
      if (mode === 'range') {
        session.start = new Date(start).getTime();
        session.end = new Date(end).getTime();
        if (
          !Number.isFinite(session.start) ||
          !Number.isFinite(session.end) ||
          session.end <= session.start
        )
          throw new Error('Das Ende muss nach dem Beginn liegen.');
        if (session.end > Date.now() + 1000)
          throw new Error('Die Sitzung darf nicht in der Zukunft enden.');
        session.date = localDate(session.start);
        if (duration(session) <= 0)
          throw new Error(
            'Dieser Zeitraum enthält nur Pausen. Bitte korrigiere Beginn oder Ende.',
          );
      } else {
        if (!date || date > localDate())
          throw new Error('Bitte ein Datum bis einschließlich heute wählen.');
        session.durationMs =
          existing?.mode === 'duration' &&
          fixed ===
            `${Math.floor(duration(existing) / 3600000)}:${String(Math.floor(duration(existing) / 60000) % 60).padStart(2, '0')}`
            ? duration(existing)
            : parseDuration(fixed);
      }
      await mutate(
        (s) => {
          if (!s.paintings.some((p) => p.id === paintingId))
            throw new Error('Das Bild wurde nicht gefunden.');
          if (existing && !s.sessions.some((item) => item.id === existing.id))
            throw new Error('Die Sitzung wurde inzwischen gelöscht.');
          return {
            ...s,
            sessions: existing
              ? s.sessions.map((item) =>
                  item.id === existing.id ? session : item,
                )
              : [...s.sessions, session],
          };
        },
        existing ? 'Malsitzung aktualisiert.' : 'Malzeit nachgetragen.',
      );
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <ModalFrame
      title={existing ? 'Malsitzung bearbeiten' : 'Zeit nachtragen'}
      description="Auch vergessene Starts und späte Stopps lassen sich hier korrigieren."
      close={close}
    >
      <form className="editor-form" onSubmit={(e) => void submit(e)}>
        <Field label="Bild">
          <Choice
            label="Bild auswählen"
            value={paintingId}
            onChange={setPaintingId}
            options={state.paintings.map((p) => ({
              value: p.id,
              label: p.title,
            }))}
          />
        </Field>
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as 'range' | 'duration')}
        >
          <TabsList className="mode-tabs">
            <TabsTrigger value="range">Beginn & Ende</TabsTrigger>
            <TabsTrigger value="duration">Feste Dauer</TabsTrigger>
          </TabsList>
          <TabsContent value="range">
            <div className="form-grid">
              <Field label="Beginn">
                <input
                  type="datetime-local"
                  step="1"
                  required={mode === 'range'}
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    if (e.target.value) setDate(e.target.value.slice(0, 10));
                  }}
                />
              </Field>
              <Field label="Ende">
                <input
                  type="datetime-local"
                  step="1"
                  required={mode === 'range'}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </Field>
            </div>
            {!!existing?.breaks.length && (
              <p className="hint">
                {existing.breaks.length} erfasste{' '}
                {existing.breaks.length === 1 ? 'Pause wird' : 'Pausen werden'}{' '}
                innerhalb des gewählten Zeitraums abgezogen.
              </p>
            )}
          </TabsContent>
          <TabsContent value="duration">
            <div className="form-grid">
              <Field label="Datum">
                <input
                  type="date"
                  required={mode === 'duration'}
                  max={localDate()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="Dauer" hint="Stunden:Minuten, z. B. 1:30">
                <input
                  required={mode === 'duration'}
                  value={fixed}
                  maxLength={8}
                  onChange={(e) => setFixed(e.target.value)}
                  placeholder="1:30"
                />
              </Field>
            </div>
            {!!existing?.breaks.length && (
              <p className="hint">Gib die reine Malzeit ohne Pausen ein.</p>
            )}
          </TabsContent>
        </Tabs>
        <Field label="Notiz (optional)">
          <textarea
            maxLength={10000}
            rows={3}
            placeholder="Woran hast du gearbeitet?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <Feedback error={error} />
        <div className="form-actions">
          {existing && (
            <button
              type="button"
              className="icon-button delete-action"
              aria-label="Malsitzung löschen"
              onClick={() =>
                ask(
                  'Malsitzung löschen?',
                  'Die Zeit dieser Sitzung wird aus der Gesamtzeit und der Statistik entfernt.',
                  async () => {
                    await mutate(
                      (s) => ({
                        ...s,
                        sessions: s.sessions.filter(
                          (item) => item.id !== existing.id,
                        ),
                      }),
                      'Sitzung gelöscht.',
                    );
                    close();
                  },
                )
              }
            >
              <Trash2 size={18} />
            </button>
          )}
          <button type="button" className="secondary" onClick={close}>
            Abbrechen
          </button>
          <button className="primary" disabled={saving || !paintingId}>
            <Check size={17} />
            {saving ? 'Wird gespeichert …' : 'Zeit speichern'}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

export function PhotoEditor({
  painting,
  photoId,
  mutate,
  close,
  ask,
}: {
  painting: Painting;
  photoId?: string;
  mutate: Mutate;
  close: () => void;
  ask: Ask;
}) {
  const existing = painting.photos.find((p) => p.id === photoId);
  const [data, setData] = useState(existing?.data ?? '');
  const [date, setDate] = useState(existing?.date ?? localDate());
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (!data) throw new Error('Bitte wähle zuerst ein Foto aus.');
      if (!date || date > localDate())
        throw new Error('Bitte ein gültiges Datum bis heute wählen.');
      const ph: Photo = {
        id: existing?.id ?? uid(),
        data,
        date,
        note: note.trim(),
      };
      await mutate((s) => {
        if (!s.paintings.some((p) => p.id === painting.id))
          throw new Error('Das Bild wurde gelöscht.');
        return {
          ...s,
          paintings: s.paintings.map((p) => {
            if (p.id !== painting.id) return p;
            if (existing && !p.photos.some((item) => item.id === existing.id))
              throw new Error('Das Foto wurde inzwischen gelöscht.');
            return {
              ...p,
              photos: existing
                ? p.photos.map((item) => (item.id === existing.id ? ph : item))
                : [...p.photos, ph],
            };
          }),
        };
      }, 'Arbeitsschritt gespeichert.');
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <ModalFrame
      title={
        existing ? 'Arbeitsschritt bearbeiten' : 'Ein neuer Arbeitsschritt'
      }
      description={`Dokumentiere den Fortschritt von „${painting.title}“.`}
      close={close}
    >
      <form className="editor-form" onSubmit={(e) => void submit(e)}>
        <PhotoPicker value={data} onChange={setData} />
        <Field label="Datum">
          <input
            type="date"
            required
            max={localDate()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Was hat sich verändert?">
          <textarea
            maxLength={10000}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="z. B. Grundierung, erste Farbschichten, Licht und Schatten …"
          />
        </Field>
        {existing && (
          <button
            type="button"
            className="secondary"
            disabled={cover(painting)?.id === existing.id}
            onClick={() =>
              void (async () => {
                try {
                  await mutate(
                    (s) => ({
                      ...s,
                      paintings: s.paintings.map((p) =>
                        p.id === painting.id
                          ? { ...p, coverId: existing.id }
                          : p,
                      ),
                    }),
                    'Titelbild aktualisiert.',
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              })()
            }
          >
            <Images size={17} />
            {cover(painting)?.id === existing.id
              ? 'Aktuelles Titelbild'
              : 'Als Titelbild verwenden'}
          </button>
        )}
        <Feedback error={error} />
        <div className="form-actions">
          {existing && (
            <button
              type="button"
              className="icon-button delete-action"
              aria-label="Foto löschen"
              onClick={() =>
                ask(
                  'Fortschrittsfoto löschen?',
                  'Das Foto und seine Beschreibung werden entfernt. Die erfasste Malzeit bleibt erhalten.',
                  async () => {
                    await mutate(
                      (s) => ({
                        ...s,
                        paintings: s.paintings.map((p) =>
                          p.id === painting.id
                            ? {
                                ...p,
                                photos: p.photos.filter(
                                  (ph) => ph.id !== existing.id,
                                ),
                                coverId:
                                  p.coverId === existing.id
                                    ? undefined
                                    : p.coverId,
                              }
                            : p,
                        ),
                      }),
                      'Foto gelöscht.',
                    );
                    close();
                  },
                )
              }
            >
              <Trash2 size={18} />
            </button>
          )}
          <button type="button" className="secondary" onClick={close}>
            Abbrechen
          </button>
          <button className="primary" disabled={saving}>
            <Check size={17} />
            {saving ? 'Wird gespeichert …' : 'Schritt speichern'}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

export function TimerEditor({
  state,
  mutate,
  close,
}: {
  state: Atelier;
  mutate: Mutate;
  close: () => void;
}) {
  const [start, setStart] = useState(localDateTime(state.active!.start));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const time = new Date(start).getTime();
      if (!Number.isFinite(time) || time > Date.now())
        throw new Error(
          'Der Beginn muss ein gültiger Zeitpunkt in der Vergangenheit sein.',
        );
      await mutate((s) => {
        if (!s.active) throw new Error('Der Timer wurde bereits beendet.');
        if (s.active.pausedAt !== null && time >= s.active.pausedAt)
          throw new Error('Der Beginn muss vor der Pause liegen.');
        return { ...s, active: { ...s.active, start: time } };
      }, 'Timer-Start korrigiert.');
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <ModalFrame
      title="Timer-Start korrigieren"
      description="Schon früher angefangen? Verschiebe den Beginn, während der Timer aktiv bleibt."
      close={close}
    >
      <form className="editor-form" onSubmit={(e) => void submit(e)}>
        <Field label="Beginn">
          <input
            type="datetime-local"
            step="1"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Feedback error={error} />
        <button className="primary" disabled={saving}>
          Beginn speichern
        </button>
      </form>
    </ModalFrame>
  );
}
export function PhotoViewer({
  painting,
  photoId,
  close,
  edit,
}: {
  painting: Painting;
  photoId: string;
  close: () => void;
  edit: (id: string) => void;
}) {
  const photo = painting?.photos.find((p) => p.id === photoId);
  return (
    <ModalFrame
      title={painting?.title ?? 'Foto'}
      description={
        photo ? dateLabel(photo.date) : 'Das Foto ist nicht mehr vorhanden.'
      }
      close={close}
    >
      {photo && (
        <>
          <img
            className="viewer-image"
            src={photo.data}
            alt={photo.note || painting.title}
          />
          {photo.note && <p className="viewer-note">{photo.note}</p>}
          <button className="secondary" onClick={() => edit(photo.id)}>
            <Pencil size={17} />
            Arbeitsschritt bearbeiten
          </button>
        </>
      )}
    </ModalFrame>
  );
}
