'use client';
import { type ReactNode, useState, useRef } from 'react';
import { X, Camera, ImagePlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { imageData } from '@/lib/storage';
import { duration, type Atelier, type Painting } from '@/lib/atelier';
export type Mutate = (
  fn: (state: Atelier) => Atelier,
  message?: string,
) => Promise<Atelier>;
export type Ask = (
  title: string,
  description: string,
  action: () => Promise<void>,
) => void;
export const uid = () => crypto.randomUUID();
export const dateLabel = (date: string | number) =>
  new Date(
    typeof date === 'string' ? date + 'T12:00:00' : date,
  ).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
export const clockLabel = (time: number) =>
  new Date(time).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
export const paintingTime = (state: Atelier, id: string) =>
  state.sessions
    .filter((s) => s.paintingId === id)
    .reduce((sum, s) => sum + duration(s), 0);
export const cover = (p: Painting) =>
  p.photos.find((ph) => ph.id === p.coverId) ?? p.photos.at(-1);
export function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v !== null && onChange(v)}
      items={options}
    >
      <SelectTrigger className="choice" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function ModalFrame({
  title,
  description,
  children,
  close,
}: {
  title: string;
  description: string;
  children: ReactNode;
  close: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="editor-modal" showCloseButton={false}>
        <div className="modal-heading">
          <div>
            <DialogTitle className="modal-title">{title}</DialogTitle>
            <DialogDescription className="modal-description">
              {description}
            </DialogDescription>
          </div>
          <DialogClose className="icon-button" aria-label="Schließen">
            <X size={18} />
          </DialogClose>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function Feedback({ error }: { error: string }) {
  return error ? (
    <p role="alert" className="form-error">
      {error}
    </p>
  ) : null;
}
export function Empty({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="small-empty">
      <span className="empty-symbol">{icon}</span>
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      {action}
    </div>
  );
}
export function PhotoPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const library = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const pick = async (file?: File) => {
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      onChange(await imageData(file));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="photo-picker">
      {value && (
        <img className="upload-preview" src={value} alt="Ausgewähltes Foto" />
      )}
      <input
        className="sr-only"
        tabIndex={-1}
        ref={library}
        type="file"
        accept="image/*"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        className="sr-only"
        tabIndex={-1}
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div className="photo-options">
        <button
          type="button"
          className="secondary"
          disabled={loading}
          onClick={() => library.current?.click()}
        >
          <ImagePlus size={18} />
          {loading
            ? 'Foto wird geladen …'
            : value
              ? 'Foto ersetzen'
              : 'Aus Fotos wählen'}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={loading}
          onClick={() => camera.current?.click()}
        >
          <Camera size={18} />
          Kamera
        </button>
      </div>
      <Feedback error={error} />
      <p className="hint">
        Fotos werden platzsparend mit bis zu 1.600 Pixeln gespeichert.
      </p>
    </div>
  );
}
