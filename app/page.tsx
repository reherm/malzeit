'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Paintbrush,
  Plus,
  Images,
  ChartNoAxesColumn,
  Clock3,
  Settings2,
  ArrowUpRight,
  Play,
  Pause,
  Square,
  Pencil,
  X,
  ShieldCheck,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  activeDuration,
  beginTimer,
  duration,
  formatDuration,
  freshAtelier,
  pauseTimer,
  resumeTimer,
  stopTimer,
  totalInPeriod,
  type Atelier,
} from '@/lib/atelier';
import { readAtelier, updateAtelier } from '@/lib/storage';
import {
  PaintingEditor,
  SessionEditor,
  PhotoEditor,
  TimerEditor,
  PhotoViewer,
} from './editors';
import { PaintingDetail, type Modal } from './painting-detail';
import { SessionList, Statistics } from './statistics';
import { Settings } from './settings';
import { paintingTime, cover, uid, type Mutate } from './ui';

export default function Home() {
  const [state, setState] = useState<Atelier>(freshAtelier);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('paintings');
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now);
  const [offlineReady, setOfflineReady] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const refresh = useCallback(async () => {
    try {
      const value = await readAtelier();
      setState(value);
      setReady(true);
      setLoadError('');
    } catch {
      setLoadError(
        'Der Gerätespeicher ist nicht verfügbar. Bitte Malzeit in Safari oder über den Home-Bildschirm öffnen und erneut laden.',
      );
    }
  }, []);
  useEffect(() => {
    // Initial hydration reads asynchronously from IndexedDB; no derived state loop.
    // oxlint-disable-next-line react/react-compiler
    void refresh();
    const interval = setInterval(() => setNow(Date.now()), 1000);
    const visibility = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now());
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('focus', visibility);
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel('malzeit-changes');
      channel.current.onmessage = () => void refresh();
    }
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', visibility);
      channel.current?.close();
    };
  }, [refresh]);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      !('serviceWorker' in navigator)
    )
      return;
    let alive = true;
    const message = (e: MessageEvent) => {
      if (e.data?.type === 'MALZEIT_OFFLINE_READY' && alive)
        setOfflineReady(true);
    };
    navigator.serviceWorker.addEventListener('message', message);
    void navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        if (alive) {
          setOfflineReady(!!reg.active);
          if (navigator.storage?.persist)
            void navigator.storage.persist().catch(() => false);
        }
      })
      .catch(() => {
        if (alive)
          setNotice(
            'Die Offline-Einrichtung ist noch nicht abgeschlossen. Bitte die App online erneut öffnen.',
          );
      });
    return () => {
      alive = false;
      navigator.serviceWorker.removeEventListener('message', message);
    };
  }, []);
  const mutate: Mutate = useCallback(async (fn, message) => {
    if (mutationLock.current)
      throw new Error(
        'Eine Änderung wird gerade gespeichert. Bitte kurz warten.',
      );
    mutationLock.current = true;
    setBusy(true);
    try {
      const next = await updateAtelier(fn);
      setState(next);
      channel.current?.postMessage('changed');
      if (message) setNotice(message);
      return next;
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === 'QuotaExceededError'
          ? 'Der Gerätespeicher ist voll. Bitte eine Sicherung exportieren und Speicher freigeben.'
          : e instanceof Error
            ? e.message
            : 'Die Änderung konnte nicht gespeichert werden.';
      setNotice(msg);
      throw new Error(msg);
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }, []);
  const attempt = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch {}
  };
  const ask = (
    title: string,
    description: string,
    action: () => Promise<void>,
  ) => setConfirmation({ title, description, action });
  const start = (id: string) =>
    void attempt(() =>
      mutate(
        (s) => beginTimer(s, id),
        'Timer gestartet. Du kannst die App schließen.',
      ),
    );
  const stop = () =>
    void attempt(async () => {
      const id = uid();
      const next = await mutate(
        (s) => stopTimer(s, id),
        'Malsitzung gespeichert. Du kannst die Zeiten jetzt anpassen.',
      );
      const saved = next.sessions.find((s) => s.id === id);
      if (saved)
        setModal({ kind: 'session', id, paintingId: saved.paintingId });
    });
  const activePainting = state.paintings.find(
    (p) => p.id === state.active?.paintingId,
  );
  const painting = state.paintings.find((p) => p.id === selected);
  const total = state.sessions.reduce((sum, s) => sum + duration(s), 0);
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekTime = totalInPeriod(state.sessions, weekStart.getTime(), now);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: unknown) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: 'list_paintings',
      description:
        'List saved paintings and their total recorded painting time on this device.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => ({
        paintings: stateRef.current.paintings.map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
          durationMs: paintingTime(stateRef.current, p.id),
        })),
      }),
    });
    register({
      name: 'start_painting_timer',
      description:
        'Start the single timer for an existing painting. Fails if another timer is active.',
      inputSchema: {
        type: 'object',
        properties: { paintingId: { type: 'string' } },
        required: ['paintingId'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input: unknown) => {
        if (
          !input ||
          typeof input !== 'object' ||
          !('paintingId' in input) ||
          typeof input.paintingId !== 'string'
        )
          throw new Error('paintingId is required');
        const id = input.paintingId;
        await mutate((s) => beginTimer(s, id), 'Timer gestartet.');
        return { paintingId: id, status: 'running' };
      },
    });
    return () => lifecycle.abort();
  }, [mutate]);
  const newPainting = () => setModal({ kind: 'painting' });
  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="brand"
          aria-label="Zur Bilderübersicht"
          onClick={(e) => {
            e.preventDefault();
            setSelected(null);
            setTab('paintings');
          }}
        >
          <span className="brand-icon">
            <Paintbrush size={22} />
          </span>
          malzeit<span className="brand-dot">.</span>
        </button>
        <span className="local-label">
          <span className="status-dot" />
          {offlineReady ? 'Offline bereit' : 'Dein persönliches Atelier'}
        </span>
        <button
          className="icon-button"
          aria-label="Einstellungen und Sicherung"
          onClick={() => setModal({ kind: 'settings' })}
        >
          <Settings2 size={20} />
        </button>
      </header>
      <main className="main">
        {notice && (
          <output className="notice">
            <span>{notice}</span>
            <button
              aria-label="Hinweis schließen"
              onClick={() => setNotice('')}
            >
              <X size={18} />
            </button>
          </output>
        )}
        {loadError ? (
          <div className="form-error" role="alert">
            {loadError}
            <button className="secondary" onClick={() => void refresh()}>
              Erneut versuchen
            </button>
          </div>
        ) : !ready ? (
          <div className="small-empty">
            <Paintbrush />
            <p>Dein Atelier wird geöffnet …</p>
          </div>
        ) : (
          <>
            {state.active && activePainting && (
              <section className="timer-strip" aria-label="Aktiver Timer">
                <button
                  className="timer-painting"
                  aria-label="Bild des aktiven Timers öffnen"
                  onClick={() => setSelected(activePainting.id)}
                >
                  <span
                    className={
                      'status-dot ' +
                      (state.active.pausedAt === null ? 'pulse' : 'paused')
                    }
                  />
                  <span>
                    <small>
                      {state.active.pausedAt === null
                        ? 'DU MALST GERADE'
                        : 'PAUSIERT'}
                    </small>
                    <strong>{activePainting.title}</strong>
                  </span>
                </button>
                <div className="timer-numbers" role="timer">
                  {formatDuration(activeDuration(state.active, now), true)}
                </div>
                <div className="timer-actions">
                  <button
                    className="icon-button"
                    disabled={busy}
                    aria-label={
                      state.active.pausedAt === null
                        ? 'Timer pausieren'
                        : 'Timer fortsetzen'
                    }
                    onClick={() =>
                      void attempt(() =>
                        mutate((s) =>
                          s.active?.pausedAt === null
                            ? pauseTimer(s)
                            : resumeTimer(s),
                        ),
                      )
                    }
                  >
                    {state.active.pausedAt === null ? (
                      <Pause size={18} />
                    ) : (
                      <Play size={18} />
                    )}
                  </button>
                  <button className="primary" disabled={busy} onClick={stop}>
                    <Square size={14} fill="currentColor" />
                    <span>Stoppen</span>
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Timer-Start korrigieren"
                    onClick={() => setModal({ kind: 'timer' })}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              </section>
            )}
            {painting ? (
              <PaintingDetail
                painting={painting}
                state={state}
                busy={busy}
                start={start}
                back={() => setSelected(null)}
                open={setModal}
                ask={ask}
                mutate={mutate}
              />
            ) : (
              <>
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">DEIN ATELIER</p>
                    <h1>
                      {tab === 'paintings'
                        ? 'Meine Bilder'
                        : tab === 'sessions'
                          ? 'Malsitzungen'
                          : 'Meine Statistik'}
                      <span className="heading-dot">.</span>
                    </h1>
                    <p className="muted">
                      {tab === 'paintings'
                        ? 'Jedes Bild hat seine Zeit. Hier hältst du sie fest.'
                        : tab === 'sessions'
                          ? 'Ein Pinselstrich nach dem anderen.'
                          : 'Ein Blick auf die Zeit, die in deiner Kunst steckt.'}
                    </p>
                  </div>
                  <button className="primary" onClick={newPainting}>
                    <Plus size={18} />
                    Bild anlegen
                  </button>
                </div>
                <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
                  <TabsList className="main-tabs" variant="line">
                    <TabsTrigger value="paintings">
                      <Images />
                      Bilder
                    </TabsTrigger>
                    <TabsTrigger value="sessions">
                      <Clock3 />
                      Malsitzungen
                    </TabsTrigger>
                    <TabsTrigger value="stats">
                      <ChartNoAxesColumn />
                      Statistik
                    </TabsTrigger>
                  </TabsList>
                  <div className="summary-grid">
                    <div>
                      <span>Gesamte Malzeit</span>
                      <strong>{formatDuration(total)}</strong>
                    </div>
                    <div>
                      <span>In Arbeit</span>
                      <strong>
                        {
                          state.paintings.filter((p) => p.status === 'working')
                            .length
                        }{' '}
                        <small>Bilder</small>
                      </strong>
                    </div>
                    <div>
                      <span>Diese Woche</span>
                      <strong>{formatDuration(weekTime)}</strong>
                    </div>
                  </div>
                  <TabsContent value="paintings">
                    {state.paintings.length ? (
                      <div className="gallery">
                        {[...state.paintings]
                          .sort((a, b) => b.createdAt - a.createdAt)
                          .map((p) => (
                            <article className="painting-card" key={p.id}>
                              <button
                                className="card-image"
                                onClick={() => setSelected(p.id)}
                                aria-label={`${p.title} öffnen`}
                              >
                                {cover(p) ? (
                                  <img
                                    src={cover(p)!.data}
                                    alt={p.title}
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="no-photo">
                                    <Paintbrush size={40} strokeWidth={1} />
                                    <span>Noch kein Foto</span>
                                  </span>
                                )}
                                <span className={'badge ' + p.status}>
                                  {p.status === 'working'
                                    ? 'In Arbeit'
                                    : 'Fertiggestellt'}
                                </span>
                                <span className="open-art">
                                  <ArrowUpRight size={18} />
                                </span>
                              </button>
                              <div className="card-copy">
                                <button
                                  className="card-title"
                                  onClick={() => setSelected(p.id)}
                                >
                                  {p.title}
                                </button>
                                <p className="muted">
                                  {[p.technique, p.dimensions]
                                    .filter(Boolean)
                                    .join(' · ') || 'Technik und Maße ergänzen'}
                                </p>
                                <div className="card-bottom">
                                  <span>
                                    <Clock3 size={15} />
                                    {formatDuration(paintingTime(state, p.id))}
                                  </span>
                                  <button
                                    className="icon-button start-button"
                                    aria-label={`Timer für ${p.title} starten`}
                                    disabled={!!state.active || busy}
                                    onClick={() => start(p.id)}
                                  >
                                    <Play size={16} fill="currentColor" />
                                  </button>
                                </div>
                              </div>
                            </article>
                          ))}
                        <button className="add-painting" onClick={newPainting}>
                          <span className="icon-button">
                            <Plus size={22} />
                          </span>
                          <strong>Ein neues Bild</strong>
                          <span>Platz für deine nächste Idee</span>
                        </button>
                      </div>
                    ) : (
                      <section className="empty-gallery">
                        <span className="empty-symbol">
                          <Paintbrush size={38} strokeWidth={1} />
                        </span>
                        <p className="eyebrow">RAUM FÜR DEINE KUNST</p>
                        <h2>
                          Eine leere Leinwand.
                          <br />
                          Unendlich viele Möglichkeiten.
                        </h2>
                        <p className="muted">
                          Lege dein erstes Bild an und begleite es
                          <br />
                          vom ersten Pinselstrich bis zum letzten Detail.
                        </p>
                        <button className="primary" onClick={newPainting}>
                          <Plus size={18} />
                          Mein erstes Bild anlegen
                          <ArrowUpRight size={18} />
                        </button>
                      </section>
                    )}
                  </TabsContent>
                  <TabsContent value="sessions">
                    <SessionList
                      state={state}
                      edit={(s) =>
                        setModal({
                          kind: 'session',
                          id: s.id,
                          paintingId: s.paintingId,
                        })
                      }
                      add={() => setModal({ kind: 'session' })}
                    />
                  </TabsContent>
                  <TabsContent value="stats">
                    <Statistics state={state} />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </>
        )}
        <footer className="page-footer">
          <span>Deine Bilder. Deine Zeit.</span>
          <button onClick={() => setModal({ kind: 'settings' })}>
            <ShieldCheck size={14} />
            Lokal gespeichert · Sicherung & Installation
          </button>
        </footer>
      </main>
      {modal?.kind === 'painting' && (
        <PaintingEditor
          existing={state.paintings.find((p) => p.id === modal.id)}
          mutate={mutate}
          close={() => setModal(null)}
          done={(id) => {
            setSelected(id);
            setModal(null);
          }}
        />
      )}
      {modal?.kind === 'session' && (
        <SessionEditor
          state={state}
          existing={state.sessions.find((s) => s.id === modal.id)}
          initialPaintingId={modal.paintingId}
          mutate={mutate}
          close={() => setModal(null)}
          ask={ask}
        />
      )}
      {modal?.kind === 'photo' &&
        state.paintings.some((p) => p.id === modal.paintingId) && (
          <PhotoEditor
            painting={state.paintings.find((p) => p.id === modal.paintingId)!}
            photoId={modal.id}
            mutate={mutate}
            close={() => setModal(null)}
            ask={ask}
          />
        )}
      {modal?.kind === 'timer' && state.active && (
        <TimerEditor
          state={state}
          mutate={mutate}
          close={() => setModal(null)}
        />
      )}
      {modal?.kind === 'settings' && (
        <Settings
          state={state}
          ready={ready}
          offlineReady={offlineReady}
          mutate={mutate}
          close={() => setModal(null)}
          ask={ask}
          notice={setNotice}
        />
      )}
      {modal?.kind === 'viewer' && (
        <PhotoViewer
          painting={state.paintings.find((p) => p.id === modal.paintingId)!}
          photoId={modal.id}
          close={() => setModal(null)}
          edit={(id) =>
            setModal({ kind: 'photo', paintingId: modal.paintingId, id })
          }
        />
      )}
      <AlertDialog
        open={!!confirmation}
        onOpenChange={(open) => !open && setConfirmation(null)}
      >
        <AlertDialogContent className="confirm-modal">
          <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {confirmation?.description}
          </AlertDialogDescription>
          <div className="form-actions">
            <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="danger"
              disabled={busy}
              onClick={() =>
                void attempt(async () => {
                  await confirmation?.action();
                  setConfirmation(null);
                })
              }
            >
              {busy ? 'Wird gespeichert …' : 'Bestätigen'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
