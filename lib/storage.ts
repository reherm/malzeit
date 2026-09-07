import { freshAtelier, type Atelier } from './atelier';
let database: Promise<IDBDatabase> | undefined;
function db(): Promise<IDBDatabase> {
  if (!database)
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open('malzeit-atelier', 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore('atelier');
      request.onsuccess = () => {
        const connection = request.result;
        connection.onversionchange = () => {
          connection.close();
          database = undefined;
        };
        resolve(connection);
      };
      request.onerror = () => {
        database = undefined;
        reject(request.error);
      };
      request.onblocked = () => {
        database = undefined;
        reject(new Error('Bitte andere geöffnete Malzeit-Fenster schließen.'));
      };
    });
  return database;
}
export async function readAtelier(): Promise<Atelier> {
  const connection = await db();
  return new Promise((resolve, reject) => {
    const request = connection
      .transaction('atelier', 'readonly')
      .objectStore('atelier')
      .get('state');
    request.onsuccess = () => resolve(request.result ?? freshAtelier());
    request.onerror = () => reject(request.error);
  });
}
// Read and write in one transaction so two windows cannot create competing timers.
export async function updateAtelier(
  update: (state: Atelier) => Atelier,
): Promise<Atelier> {
  const connection = await db();
  return new Promise((resolve, reject) => {
    const tx = connection.transaction('atelier', 'readwrite');
    const store = tx.objectStore('atelier');
    const request = store.get('state');
    let result: Atelier;
    let failure: unknown;
    request.onsuccess = () => {
      try {
        result = update(request.result ?? freshAtelier());
        store.put(result, 'state');
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () =>
      reject(
        failure ??
          tx.error ??
          new Error('Die Änderung konnte nicht gespeichert werden.'),
      );
    tx.onerror = () => {
      failure ??= tx.error;
    };
  });
}
export async function imageData(file: File): Promise<string> {
  if (file.size > 35 * 1024 * 1024)
    throw new Error(
      'Das Foto ist zu groß. Bitte wähle eine Datei unter 35 MB.',
    );
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(
          new Error(
            'Dieses Foto kann nicht geöffnet werden. Bitte JPEG, PNG oder WebP wählen.',
          ),
        );
      img.src = url;
    });
    const ratio = Math.min(
      1,
      1600 / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Das Foto konnte nicht verarbeitet werden.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}
