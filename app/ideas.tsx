'use client';
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type SubmitEvent,
} from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ImagePlus,
  Lightbulb,
  Paintbrush,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import {
  localDate,
  paintingFromIdea,
  safeSourceUrl,
  type Atelier,
  type IdeaImage,
  type PaintingIdea,
} from '@/lib/atelier';
import {
  Choice,
  dateLabel,
  Empty,
  Feedback,
  Field,
  ModalFrame,
  PhotoPicker,
  uid,
  type Ask,
  type Mutate,
} from './ui';

export function Ideas({
  state,
  open,
  add,
  mutate,
}: {
  state: Atelier;
  open: (id: string) => void;
  add: () => void;
  mutate: Mutate;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const search = query.trim().toLocaleLowerCase('de-DE');
  const ideas = state.ideas
    .filter(
      (idea) =>
        (filter !== 'favorites' || idea.favorite) &&
        (filter !== 'open' || !idea.paintingId) &&
        (filter !== 'started' || !!idea.paintingId) &&
        [
          idea.title,
          idea.notes,
          idea.nextStep,
          idea.technique,
          ...idea.tags,
          ...idea.images.map((img) => img.note),
        ]
          .join(' ')
          .toLocaleLowerCase('de-DE')
          .includes(search),
    )
    .sort(
      (a, b) =>
        Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt,
    );
  return (
    <>
      <div className="idea-toolbar">
        <label className="idea-search">
          <Search size={18} />
          <input
            type="search"
            aria-label="Ideen durchsuchen"
            placeholder="Ideen, Notizen oder Tags suchen …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <Choice
          label="Ideen filtern"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Alle Ideen' },
            { value: 'favorites', label: 'Favoriten' },
            { value: 'open', label: 'Noch offen' },
            { value: 'started', label: 'Als Bild angelegt' },
          ]}
        />
      </div>
      <Feedback error={error} />
      {ideas.length ? (
        <div className="gallery idea-gallery">
          {ideas.map((idea) => (
            <article className="painting-card" key={idea.id}>
              <div className="idea-card-art">
                <button
                  className="card-image"
                  onClick={() => open(idea.id)}
                  aria-label={`${idea.title} öffnen`}
                >
                  {idea.images[0] ? (
                    <img
                      src={idea.images[0].data}
                      alt={idea.images[0].note || idea.title}
                      loading="lazy"
                    />
                  ) : (
                    <span className="no-photo">
                      <Lightbulb size={40} strokeWidth={1} />
                      <span>Eine Idee nimmt Form an</span>
                    </span>
                  )}
                  <span className="badge">
                    {idea.paintingId ? 'Als Bild angelegt' : 'Idee'}
                  </span>
                  <span className="open-art">
                    <ArrowUpRight size={18} />
                  </span>
                </button>
                <button
                  className={
                    'icon-button idea-favorite ' +
                    (idea.favorite ? 'is-favorite' : '')
                  }
                  aria-label={`${idea.title}: ${idea.favorite ? 'Favorit entfernen' : 'Als Favorit merken'}`}
                  aria-pressed={idea.favorite}
                  onClick={() =>
                    void mutate((s) => ({
                      ...s,
                      ideas: s.ideas.map((item) =>
                        item.id === idea.id
                          ? { ...item, favorite: !item.favorite }
                          : item,
                      ),
                    })).catch((e) => setError((e as Error).message))
                  }
                >
                  <Star
                    size={18}
                    fill={idea.favorite ? 'currentColor' : 'none'}
                  />
                </button>
              </div>
              <div className="card-copy">
                <button className="card-title" onClick={() => open(idea.id)}>
                  {idea.title}
                </button>
                <p className="muted idea-excerpt">
                  {idea.notes ||
                    idea.nextStep ||
                    'Platz für deine Gedanken, Referenzen und Skizzen.'}
                </p>
                {!!idea.tags.length && (
                  <div className="idea-tags">
                    {idea.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                )}
                <div className="card-bottom">
                  <span>{idea.images.length} Bilder & Skizzen</span>
                  <time>{dateLabel(idea.updatedAt)}</time>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={<Lightbulb size={30} />}
          title={
            state.ideas.length
              ? 'Keine passende Idee.'
              : 'Heute eine Idee. Morgen ein Bild.'
          }
          description={
            state.ideas.length
              ? 'Versuche einen anderen Suchbegriff oder Filter.'
              : 'Sammle Motive, Gedanken und Skizzen, bis du bereit für den ersten Pinselstrich bist.'
          }
          action={
            <button className="primary" onClick={add}>
              <Plus size={17} />
              Idee anlegen
            </button>
          }
        />
      )}
    </>
  );
}

export function IdeaDetail({
  idea,
  state,
  back,
  edit,
  addImage,
  editImage,
  openPainting,
  mutate,
  ask,
  busy,
}: {
  idea: PaintingIdea;
  state: Atelier;
  back: () => void;
  edit: () => void;
  addImage: () => void;
  editImage: (id: string) => void;
  openPainting: (id: string) => void;
  mutate: Mutate;
  ask: Ask;
  busy: boolean;
}) {
  const [error, setError] = useState('');
  const linked = state.paintings.find((p) => p.id === idea.paintingId);
  return (
    <>
      <button className="text-button back" onClick={back}>
        <ArrowLeft size={17} />
        Alle Ideen
      </button>
      <div className="detail-heading">
        <div>
          <p className="eyebrow">RAUM FÜR DEINE NÄCHSTE IDEE</p>
          <h1>
            {idea.title}
            <span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            {[idea.technique, idea.dimensions].filter(Boolean).join(' · ') ||
              'Vom ersten Gedanken zum nächsten Werk.'}
          </p>
        </div>
        <button className="secondary" onClick={edit}>
          <Pencil size={16} />
          Bearbeiten
        </button>
      </div>
      <div className="idea-detail-grid">
        <section className="idea-notes">
          <h2>Gedanken & Inspiration</h2>
          <p className="idea-text">
            {idea.notes ||
              'Was möchtest du mit diesem Bild erzählen? Halte deine Gedanken unter „Bearbeiten“ fest.'}
          </p>
          {!!idea.tags.length && (
            <div className="idea-tags">
              {idea.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          )}
          {idea.sourceUrl && safeSourceUrl(idea.sourceUrl) && (
            <a
              className="text-button idea-source"
              href={idea.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ArrowUpRight size={16} />
              Quelle / Inspiration öffnen
            </a>
          )}
        </section>
        <section className="idea-next">
          <h2>Der nächste Schritt</h2>
          <p className="idea-text">
            {idea.nextStep ||
              'z. B. eine Komposition skizzieren oder Farben ausprobieren.'}
          </p>
          {linked ? (
            <button className="primary" onClick={() => openPainting(linked.id)}>
              <Paintbrush size={17} />
              Zum Bild
            </button>
          ) : (
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                ask(
                  'Aus dieser Idee ein Bild anlegen?',
                  'Titel, Maße und Technik werden übernommen. Deine Notizen, Referenzen und Skizzen bleiben hier gesammelt und mit dem Bild verbunden.',
                  async () => {
                    const id = uid();
                    await mutate(
                      (s) => paintingFromIdea(s, idea.id, id),
                      'Deine Idee ist jetzt ein Bild.',
                    );
                    openPainting(id);
                  },
                )
              }
            >
              <Paintbrush size={17} />
              Als Bild anlegen
            </button>
          )}
          <small className="muted">
            Gesammelt am {dateLabel(idea.createdAt)}
          </small>
        </section>
      </div>
      <div className="section-heading">
        <div>
          <h2>Deine Inspiration, Bild für Bild</h2>
          <p className="muted">
            Referenzen und Skizzen mit eigenen Notizen. Tippe auf ein Bild, um
            es groß anzusehen.
          </p>
        </div>
        <button className="secondary" onClick={addImage}>
          <Plus size={17} />
          Bild / Skizze hinzufügen
        </button>
      </div>
      {idea.images.length ? (
        <div className="progress-grid">
          {idea.images.map((img) => (
            <article className="progress-card" key={img.id}>
              <button
                className="photo-button"
                onClick={() => editImage(img.id)}
                aria-label={`${img.kind === 'sketch' ? 'Skizze' : 'Referenz'} ansehen und bearbeiten`}
              >
                <img
                  src={img.data}
                  alt={
                    img.note ||
                    (img.kind === 'sketch' ? 'Skizze' : 'Referenzbild')
                  }
                  loading="lazy"
                />
                <span className="idea-image-kind">
                  {img.kind === 'sketch' ? 'Skizze' : 'Referenz'}
                </span>
              </button>
              <div className="progress-copy">
                <div className="row-between">
                  <time>{dateLabel(img.date)}</time>
                  <button
                    className="icon-button"
                    aria-label="Bildnotiz bearbeiten"
                    onClick={() => editImage(img.id)}
                  >
                    <Pencil size={15} />
                  </button>
                </div>
                <p>{img.note || 'Noch keine Notiz.'}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={<ImagePlus size={30} />}
          title="Ein Motiv, eine Stimmung, eine Skizze."
          description="Lade Bilder hoch, fotografiere eine Zeichnung oder skizziere direkt hier."
          action={
            <button className="primary" onClick={addImage}>
              <Plus size={17} />
              Erste Inspiration hinzufügen
            </button>
          }
        />
      )}
      <Feedback error={error} />
      <div className="delete-painting">
        <button
          className="text-button"
          disabled={busy}
          onClick={() =>
            ask(
              'Idee löschen?',
              `„${idea.title}“ mit allen Referenzen, Skizzen und Notizen löschen? Ein daraus angelegtes Bild bleibt erhalten.`,
              async () => {
                try {
                  await mutate(
                    (s) => ({
                      ...s,
                      ideas: s.ideas.filter((item) => item.id !== idea.id),
                    }),
                    'Idee gelöscht.',
                  );
                  back();
                } catch (e) {
                  setError((e as Error).message);
                  throw e;
                }
              },
            )
          }
        >
          <Trash2 size={15} />
          Idee löschen
        </button>
      </div>
    </>
  );
}

export function IdeaEditor({
  existing,
  mutate,
  close,
  done,
}: {
  existing?: PaintingIdea;
  mutate: Mutate;
  close: () => void;
  done: (id: string) => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [nextStep, setNextStep] = useState(existing?.nextStep ?? '');
  const [dimensions, setDimensions] = useState(existing?.dimensions ?? '');
  const [technique, setTechnique] = useState(existing?.technique ?? '');
  const [sourceUrl, setSourceUrl] = useState(existing?.sourceUrl ?? '');
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? '');
  const [favorite, setFavorite] = useState(existing?.favorite ?? false);
  const [image, setImage] = useState('');
  const [loadingImage, setLoadingImage] = useState(false);
  const [kind, setKind] = useState<IdeaImage['kind']>('reference');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (!title.trim()) throw new Error('Bitte gib deiner Idee einen Titel.');
      if (!safeSourceUrl(sourceUrl.trim()))
        throw new Error(
          'Bitte einen vollständigen Link mit https:// oder http:// eingeben.',
        );
      const parsedTags = [
        ...new Set(
          tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ];
      if (parsedTags.length > 20 || parsedTags.some((tag) => tag.length > 50))
        throw new Error('Bitte höchstens 20 Tags mit je 50 Zeichen verwenden.');
      const id = existing?.id ?? uid();
      const now = Date.now();
      const fields = {
        title: title.trim(),
        notes: notes.trim(),
        nextStep: nextStep.trim(),
        dimensions: dimensions.trim(),
        technique: technique.trim(),
        sourceUrl: sourceUrl.trim(),
        tags: parsedTags,
        favorite,
        updatedAt: Math.max(now, existing?.createdAt ?? now),
      };
      const firstImage: IdeaImage | undefined = image
        ? { id: uid(), data: image, date: localDate(), note: '', kind }
        : undefined;
      await mutate(
        (s) => {
          if (existing && !s.ideas.some((item) => item.id === id))
            throw new Error('Die Idee wurde inzwischen gelöscht.');
          return {
            ...s,
            ideas: existing
              ? s.ideas.map((item) =>
                  item.id === id ? { ...item, ...fields } : item,
                )
              : [
                  ...s.ideas,
                  {
                    ...fields,
                    id,
                    createdAt: now,
                    images: firstImage ? [firstImage] : [],
                  },
                ],
          };
        },
        existing ? 'Idee aktualisiert.' : 'Deine Idee wurde gespeichert.',
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
      title={existing ? 'Idee bearbeiten' : 'Eine neue Idee'}
      description="Ein Ort für alles, was dein nächstes Bild werden könnte."
      close={close}
    >
      <form className="editor-form" onSubmit={(e) => void submit(e)}>
        <Field label="Titel">
          <input
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. Abendlicht am See"
          />
        </Field>
        <Field label="Gedanken & Notizen">
          <textarea
            rows={4}
            maxLength={10000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Motiv, Stimmung, Farben, Komposition …"
          />
        </Field>
        <Field label="Nächster Schritt">
          <textarea
            rows={2}
            maxLength={2000}
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
            placeholder="z. B. drei kleine Farbproben anlegen"
          />
        </Field>
        <div className="form-grid">
          <Field label="Geplante Maße">
            <input
              maxLength={200}
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              placeholder="50 × 70 cm"
            />
          </Field>
          <Field label="Geplante Technik">
            <input
              maxLength={200}
              value={technique}
              onChange={(e) => setTechnique(e.target.value)}
              placeholder="z. B. Öl auf Leinwand"
            />
          </Field>
        </div>
        <Field
          label="Tags"
          hint="Mit Kommas trennen, z. B. Landschaft, Licht, Sommer"
        >
          <input
            maxLength={1040}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Landschaft, Licht, Sommer"
          />
        </Field>
        <Field label="Quelle / Inspirationslink">
          <input
            type="url"
            maxLength={2000}
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <label className="idea-favorite-field">
          <input
            type="checkbox"
            checked={favorite}
            onChange={(e) => setFavorite(e.target.checked)}
          />
          <Star size={17} />
          Als Favorit merken
        </label>
        {!existing && (
          <>
            <Field label="Erstes Bild (optional)">
              <Choice
                value={kind}
                onChange={(v) => setKind(v as IdeaImage['kind'])}
                label="Art des ersten Bildes"
                options={[
                  { value: 'reference', label: 'Referenzbild' },
                  { value: 'sketch', label: 'Skizze' },
                ]}
              />
            </Field>
            <PhotoPicker
              value={image}
              onChange={setImage}
              onLoadingChange={setLoadingImage}
            />
            <p className="hint">
              Nach dem Speichern kannst du weitere Bilder ergänzen und direkt
              skizzieren.
            </p>
          </>
        )}
        <Feedback error={error} />
        <div className="form-actions">
          <button type="button" className="secondary" onClick={close}>
            Abbrechen
          </button>
          <button className="primary" disabled={saving || loadingImage}>
            <Check size={17} />
            {saving ? 'Wird gespeichert …' : 'Idee speichern'}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

function SketchPad({ onChange }: { onChange: (data: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const previous = useRef<{ x: number; y: number; pointer: number } | null>(
    null,
  );
  const [color, setColor] = useState('#292524');
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#faf7ef';
      ctx.fillRect(0, 0, 900, 600);
    }
  }, []);
  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * 900) / rect.width,
      y: ((e.clientY - rect.top) * 600) / rect.height,
    };
  };
  const end = (e: PointerEvent<HTMLCanvasElement>) => {
    if (previous.current?.pointer !== e.pointerId) return;
    previous.current = null;
    onChange(e.currentTarget.toDataURL('image/png'));
  };
  return (
    <div className="sketch-pad">
      <p className="hint">
        Zeichne mit Finger, Stift oder Maus. Oder lade eine Skizze über „Foto /
        Datei“ hoch.
      </p>
      <canvas
        ref={canvas}
        width={900}
        height={600}
        aria-label="Zeichenfläche für eine neue Skizze"
        onPointerDown={(e) => {
          if (previous.current || e.button !== 0) return;
          const p = point(e);
          previous.current = { ...p, pointer: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = e.currentTarget.getContext('2d');
          if (!ctx) return;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }}
        onPointerMove={(e) => {
          const prev = previous.current;
          if (!prev || prev.pointer !== e.pointerId) return;
          const ctx = e.currentTarget.getContext('2d');
          if (!ctx) return;
          const p = point(e);
          ctx.strokeStyle = color;
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          previous.current = { ...p, pointer: e.pointerId };
        }}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <div className="sketch-tools">
        <label>
          Stiftfarbe{' '}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            const ctx = canvas.current?.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#faf7ef';
              ctx.fillRect(0, 0, 900, 600);
            }
            onChange('');
          }}
        >
          Neu zeichnen
        </button>
      </div>
    </div>
  );
}

export function IdeaImageEditor({
  idea,
  imageId,
  mutate,
  close,
  ask,
}: {
  idea: PaintingIdea;
  imageId?: string;
  mutate: Mutate;
  close: () => void;
  ask: Ask;
}) {
  const existing = idea.images.find((img) => img.id === imageId);
  const [data, setData] = useState(existing?.data ?? '');
  const [sketch, setSketch] = useState('');
  const [mode, setMode] = useState('upload');
  const [expanded, setExpanded] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [kind, setKind] = useState<IdeaImage['kind']>(
    existing?.kind ?? 'reference',
  );
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const image = mode === 'draw' ? sketch : data;
      if (!image)
        throw new Error(
          mode === 'draw'
            ? 'Zeichne zuerst eine Skizze.'
            : 'Bitte wähle ein Bild aus.',
        );
      const img: IdeaImage = {
        id: existing?.id ?? uid(),
        data: image,
        date: existing?.date ?? localDate(),
        note: note.trim(),
        kind: mode === 'draw' ? 'sketch' : kind,
      };
      await mutate((s) => {
        if (!s.ideas.some((item) => item.id === idea.id))
          throw new Error('Die Idee wurde inzwischen gelöscht.');
        return {
          ...s,
          ideas: s.ideas.map((item) => {
            if (item.id !== idea.id) return item;
            if (
              existing &&
              !item.images.some((image) => image.id === existing.id)
            )
              throw new Error('Das Bild wurde inzwischen gelöscht.');
            return {
              ...item,
              updatedAt: Math.max(Date.now(), item.createdAt),
              images: existing
                ? item.images.map((image) =>
                    image.id === existing.id ? img : image,
                  )
                : [...item.images, img],
            };
          }),
        };
      }, 'Inspiration gespeichert.');
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
        existing
          ? 'Inspiration ansehen & bearbeiten'
          : 'Bild oder Skizze hinzufügen'
      }
      description={`Für „${idea.title}“.`}
      close={close}
    >
      <form className="editor-form" onSubmit={(e) => void submit(e)}>
        {!existing && (
          <div className="photo-options">
            <button
              type="button"
              className={mode === 'upload' ? 'primary' : 'secondary'}
              aria-pressed={mode === 'upload'}
              onClick={() => setMode('upload')}
            >
              <ImagePlus size={17} />
              Foto / Datei
            </button>
            <button
              type="button"
              className={mode === 'draw' ? 'primary' : 'secondary'}
              aria-pressed={mode === 'draw'}
              onClick={() => setMode('draw')}
            >
              <Pencil size={17} />
              Direkt skizzieren
            </button>
          </div>
        )}
        {!existing && (
          <div hidden={mode !== 'draw'}>
            <SketchPad onChange={setSketch} />
          </div>
        )}
        {mode === 'upload' && (
          <>
            <PhotoPicker
              value={data}
              onChange={setData}
              onLoadingChange={setLoadingImage}
            />
            {existing && (
              <>
                <button
                  type="button"
                  className="text-button"
                  aria-expanded={expanded}
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? 'Große Ansicht schließen' : 'Bild groß ansehen'}
                  <ArrowUpRight size={16} />
                </button>
                {expanded && (
                  <img
                    className="viewer-image"
                    src={data}
                    alt={note || idea.title}
                  />
                )}
              </>
            )}
            <Field label="Art des Bildes">
              <Choice
                label="Art des Bildes"
                value={kind}
                onChange={(v) => setKind(v as IdeaImage['kind'])}
                options={[
                  { value: 'reference', label: 'Referenzbild' },
                  { value: 'sketch', label: 'Skizze' },
                ]}
              />
            </Field>
          </>
        )}
        <Field label="Notiz zum Bild">
          <textarea
            rows={3}
            maxLength={10000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Was inspiriert dich? Licht, Farbpalette, Formen …"
          />
        </Field>
        <Feedback error={error} />
        <div className="form-actions">
          {existing && (
            <button
              type="button"
              className="icon-button delete-action"
              aria-label="Inspiration löschen"
              onClick={() =>
                ask(
                  'Inspiration löschen?',
                  'Dieses Bild und seine Notiz werden aus der Idee entfernt.',
                  async () => {
                    await mutate(
                      (s) => ({
                        ...s,
                        ideas: s.ideas.map((item) =>
                          item.id === idea.id
                            ? {
                                ...item,
                                images: item.images.filter(
                                  (img) => img.id !== existing.id,
                                ),
                                updatedAt: Math.max(Date.now(), item.createdAt),
                              }
                            : item,
                        ),
                      }),
                      'Inspiration gelöscht.',
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
          <button className="primary" disabled={saving || loadingImage}>
            <Check size={17} />
            {saving ? 'Wird gespeichert …' : 'Inspiration speichern'}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
