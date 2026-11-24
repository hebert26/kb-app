// Almacenamiento de notas. La aplicación solo conoce la interfaz NoteStore,
// así que pasar de los datos de prueba a tu servidor es cambiar una línea en app.ts.

import { Note, RawFile } from './types.js';
import { filePath, parseNote, serializeNote } from './markdown.js';
import { MOCK_FILES } from './data.js';

export interface NoteStore {
  load(): Promise<Note[]>;
  save(note: Note): Promise<void>;
}

const KEY = 'kb.notes.v1';

/** Guarda los ficheros Markdown en localStorage del navegador. Para probar sin servidor. */
export class LocalStore implements NoteStore {
  private read(): Record<string, string> | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Record<string, string>) : null;
    } catch {
      return null;
    }
  }

  private write(files: Record<string, string>): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(files));
    } catch {
      // Sin localStorage (modo privado estricto): los cambios duran hasta recargar.
    }
  }

  async load(): Promise<Note[]> {
    let files = this.read();
    if (!files) {
      files = {};
      for (const f of MOCK_FILES) {
        const n = parseNote(f.content);
        files[n.id] = f.content;
      }
      this.write(files);
    }
    return Object.entries(files).map(([id, content]) => parseNote(content, id));
  }

  async save(note: Note): Promise<void> {
    const files = this.read() || {};
    files[note.id] = serializeNote(note);
    this.write(files);
  }

  reset(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // nada que borrar
    }
  }
}

/**
 * Ejemplo para tu servidor en Docker. Espera:
 *   GET  {base}/notes        → [{ "path": "prod/tickets/pay-1482.md", "content": "---\n..." }]
 *   PUT  {base}/notes/{path} → cuerpo: el fichero Markdown completo
 */
export class HttpStore implements NoteStore {
  constructor(private readonly base = '/api') {}

  async load(): Promise<Note[]> {
    const res = await fetch(`${this.base}/notes`);
    if (!res.ok) throw new Error(`No se pudieron cargar las notas (${res.status})`);
    const files = (await res.json()) as RawFile[];
    return files.map((f) => parseNote(f.content));
  }

  async save(note: Note): Promise<void> {
    const res = await fetch(`${this.base}/notes/${encodeURI(filePath(note))}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      body: serializeNote(note),
    });
    if (!res.ok) throw new Error(`No se pudo guardar ${note.id} (${res.status})`);
  }
}
