// Tipos y catálogos compartidos por toda la aplicación.

export type Env = 'prod' | 'dev' | 'gen';
export type EnvFilter = Env | 'all';
export type NoteType = 'ticket' | 'link' | 'config' | 'glossary' | 'knowledge' | 'quick';
export type FolderId = 'pinned' | NoteType | 'archived';
export type View = 'notes' | 'graph' | 'new';

/** Una nota es un fichero Markdown con cabecera. */
export interface Note {
  id: string;
  title: string;
  type: NoteType;
  env: Env;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  url?: string;
  /** Fecha ISO de la última modificación. */
  updated: string;
  /** Contenido Markdown sin la cabecera ni el título. */
  body: string;
}

/** Un fichero tal como vive en disco o llega del servidor. */
export interface RawFile {
  path: string;
  content: string;
}

export const ENVS: Record<Env, { label: string; short: string; folder: string; swatch: string }> = {
  prod: { label: 'Producción', short: 'PROD', folder: 'prod', swatch: '#E5534B' },
  dev: { label: 'Desarrollo', short: 'DEV', folder: 'dev', swatch: '#2F86CE' },
  gen: { label: 'General', short: 'GEN', folder: 'general', swatch: '#D5B07A' },
};

export const TYPES: Record<NoteType, { label: string; singular: string; folder: string; color: string }> = {
  ticket: { label: 'Tickets', singular: 'Ticket', folder: 'tickets', color: '#E8834D' },
  link: { label: 'Enlaces', singular: 'Enlace', folder: 'enlaces', color: '#2F86CE' },
  config: { label: 'Configuraciones', singular: 'Configuración', folder: 'config', color: '#2A9D8F' },
  glossary: { label: 'Glosario', singular: 'Glosario', folder: 'glosario', color: '#7C63D0' },
  knowledge: { label: 'Conocimiento', singular: 'Conocimiento', folder: 'conocimiento', color: '#5FAE57' },
  quick: { label: 'Notas rápidas', singular: 'Nota rápida', folder: 'notas', color: '#D9577A' },
};

export const FOLDERS: { id: FolderId; label: string; color: string }[] = [
  { id: 'pinned', label: 'Fijados', color: '#E3AE3C' },
  { id: 'ticket', label: TYPES.ticket.label, color: TYPES.ticket.color },
  { id: 'link', label: TYPES.link.label, color: TYPES.link.color },
  { id: 'config', label: TYPES.config.label, color: TYPES.config.color },
  { id: 'glossary', label: TYPES.glossary.label, color: TYPES.glossary.color },
  { id: 'knowledge', label: TYPES.knowledge.label, color: TYPES.knowledge.color },
  { id: 'quick', label: TYPES.quick.label, color: TYPES.quick.color },
  { id: 'archived', label: 'Archivados', color: '#8F877C' },
];

export const ENV_KEYS = Object.keys(ENVS) as Env[];
export const TYPE_KEYS = Object.keys(TYPES) as NoteType[];
