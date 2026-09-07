'use client';
import { useState, useRef, useEffect } from 'react';
import {
  Download,
  Upload,
  ShieldCheck,
  Smartphone,
  Clock3,
} from 'lucide-react';
import { localDate, validateBackup, type Atelier } from '@/lib/atelier';
import { readAtelier } from '@/lib/storage';
import { ModalFrame, Feedback, dateLabel, type Mutate, type Ask } from './ui';
export function Settings({
  state,
  ready,
  offlineReady,
  mutate,
  close,
  ask,
  notice,
}: {
  state: Atelier;
  ready: boolean;
  offlineReady: boolean;
  mutate: Mutate;
  close: () => void;
  ask: Ask;
  notice: (s: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [download, setDownload] = useState<{
    url: string;
    name: string;
    file: File;
  } | null>(null);
  const downloadRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
    },
    [],
  );
  const prepare = async () => {
    setBusy(true);
    setError('');
    try {
      const snapshot = await readAtelier();
      const stamp = Date.now();
      const file = new File(
        [JSON.stringify({ ...snapshot, lastBackup: stamp })],
        `malzeit-sicherung-${localDate()}-${String(new Date().getHours()).padStart(2, '0')}${String(new Date().getMinutes()).padStart(2, '0')}.json`,
        { type: 'application/json' },
      );
      if (file.size > 250 * 1024 * 1024)
        throw new Error(
          'Die Sicherung überschreitet 250 MB. Bitte vor weiteren Fotos einen größeren Sicherungsexport einrichten lassen.',
        );
      if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
      const url = URL.createObjectURL(file);
      downloadRef.current = url;
      setDownload({ url, name: file.name, file });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const marked = () => {
    void mutate((s) => ({ ...s, lastBackup: Date.now() })).catch((e) =>
      setError((e as Error).message),
    );
  };
  const share = () => {
    if (!download) return;
    void navigator
      .share({ files: [download.file], title: 'Malzeit-Sicherung' })
      .then(() => {
        marked();
        notice(
          'Sicherung geteilt. Bewahre die Datei an einem sicheren Ort auf.',
        );
      })
      .catch((e) => {
        if (e.name !== 'AbortError')
          setError(
            'Teilen war nicht möglich. Nutze stattdessen „Datei herunterladen“.',
          );
      });
  };
  const restore = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      if (file.size > 250 * 1024 * 1024)
        throw new Error(
          'Die Sicherung ist zu groß für einen sicheren Import (maximal 250 MB).',
        );
      const imported = validateBackup(JSON.parse(await file.text()));
      if (state.active)
        throw new Error(
          'Beende den aktiven Timer, bevor du eine Sicherung importierst.',
        );
      ask(
        'Sicherung wiederherstellen?',
        `${imported.paintings.length} Bilder, ${imported.sessions.length} Malsitzungen und ${imported.paintings.reduce((sum, p) => sum + p.photos.length, 0)} Fotos ersetzen den aktuellen Stand vollständig. Exportiere vorher eine Sicherung, falls du die bisherigen Daten behalten möchtest.${imported.active ? ' Der gesicherte Timer wird fortgesetzt; seine Zeit kannst du danach korrigieren.' : ''}`,
        async () => {
          await mutate((s) => {
            if (s.active)
              throw new Error('Bitte zuerst den aktiven Timer beenden.');
            return imported;
          }, 'Sicherung vollständig wiederhergestellt.');
          setDownload(null);
          close();
        },
      );
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? 'Die Datei enthält keine lesbare Malzeit-Sicherung.'
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalFrame
      title="Dein Atelier, gut aufgehoben"
      description="Sicherung, Offline-Nutzung und Installation."
      close={close}
    >
      <div className="settings-section">
        <h3>
          <ShieldCheck size={20} />
          Deine Daten
        </h3>
        <p>
          Alle Bilder, Fotos und Zeiten bleiben auf diesem Gerät. Es gibt kein
          Konto und keine automatische Cloud-Sicherung.
        </p>
        <p>
          Speichere regelmäßig eine Sicherung in „Dateien“, zum Beispiel in
          iCloud Drive. Sie enthält auch deine Fotos und einen eventuell
          laufenden Timer. Beim Löschen der Website-Daten können die lokalen
          Daten verloren gehen.
        </p>
        <div className="backup-summary">
          <span>{state.paintings.length} Bilder</span>
          <span>{state.sessions.length} Sitzungen</span>
          <span>
            {state.paintings.reduce((sum, p) => sum + p.photos.length, 0)} Fotos
          </span>
        </div>
        <button
          className="primary"
          disabled={busy || !ready}
          onClick={() => void prepare()}
        >
          <Download size={17} />
          {busy ? 'Wird vorbereitet …' : 'Sicherung vorbereiten'}
        </button>
        {download && (
          <div className="download-ready">
            <p>Deine Sicherung ist bereit. Speichere die Datei jetzt ab.</p>
            <a
              className="secondary"
              href={download.url}
              download={download.name}
              onClick={marked}
            >
              Datei herunterladen
            </a>
            {typeof navigator !== 'undefined' &&
              navigator.canShare?.({ files: [download.file] }) && (
                <button className="secondary" onClick={share}>
                  In Dateien speichern / Teilen
                </button>
              )}
          </div>
        )}
        <p className="hint">
          {state.lastBackup
            ? `Letzter Exportversuch: ${dateLabel(state.lastBackup)}. Prüfe, ob die Datei gespeichert wurde.`
            : 'Noch keine Sicherung exportiert.'}
        </p>
        <input
          type="file"
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          ref={fileInput}
          onChange={(e) => {
            void restore(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button
          className="secondary"
          disabled={busy || !ready}
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={17} />
          Sicherung importieren
        </button>
        <Feedback error={error} />
      </div>
      <div className="settings-section">
        <h3>
          <Smartphone size={20} />
          Auf dem iPhone installieren
        </h3>
        <ol>
          <li>Diese App in Safari öffnen.</li>
          <li>Auf „Teilen“ und dann „Zum Home-Bildschirm“ tippen.</li>
          <li>
            Falls angezeigt: „Als Web-App öffnen“ aktivieren. Anschließend
            „Hinzufügen“ wählen.
          </li>
          <li>
            Malzeit vom Home-Bildschirm einmal online öffnen, bis „Offline
            bereit“ erscheint.
          </li>
        </ol>
        <p className="hint">
          Beginne am besten direkt in der installierten App. Falls deine
          Safari-Daten dort fehlen, kannst du sie mit einer Sicherung
          übertragen.
        </p>
        <div className="offline-status">
          <span className="status-dot" />
          {offlineReady
            ? 'Offline bereit – du kannst ohne Internet malen.'
            : 'Offline-Einrichtung erfolgt in der veröffentlichten App.'}
        </div>
      </div>
      <div className="settings-section">
        <h3>
          <Clock3 size={20} />
          So zählt dein Timer
        </h3>
        <p>
          Malzeit merkt sich Beginn und Pausen. Beim erneuten Öffnen wird die
          verstrichene Zeit berechnet, auch nach einer Bildschirmsperre. Du
          kannst den Beginn im Timer ändern und nach dem Stoppen auch das Ende
          korrigieren.
        </p>
      </div>
    </ModalFrame>
  );
}
