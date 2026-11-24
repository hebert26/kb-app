// Tipos y catálogos compartidos por toda la aplicación.
export const ENVS = {
    prod: { label: 'Producción', short: 'PROD', folder: 'prod', swatch: '#E5534B' },
    dev: { label: 'Desarrollo', short: 'DEV', folder: 'dev', swatch: '#2F86CE' },
    gen: { label: 'General', short: 'GEN', folder: 'general', swatch: '#D5B07A' },
};
export const TYPES = {
    ticket: { label: 'Tickets', singular: 'Ticket', folder: 'tickets', color: '#E8834D' },
    link: { label: 'Enlaces', singular: 'Enlace', folder: 'enlaces', color: '#2F86CE' },
    config: { label: 'Configuraciones', singular: 'Configuración', folder: 'config', color: '#2A9D8F' },
    glossary: { label: 'Glosario', singular: 'Glosario', folder: 'glosario', color: '#7C63D0' },
    knowledge: { label: 'Conocimiento', singular: 'Conocimiento', folder: 'conocimiento', color: '#5FAE57' },
    quick: { label: 'Notas rápidas', singular: 'Nota rápida', folder: 'notas', color: '#D9577A' },
};
export const FOLDERS = [
    { id: 'pinned', label: 'Fijados', color: '#E3AE3C' },
    { id: 'ticket', label: TYPES.ticket.label, color: TYPES.ticket.color },
    { id: 'link', label: TYPES.link.label, color: TYPES.link.color },
    { id: 'config', label: TYPES.config.label, color: TYPES.config.color },
    { id: 'glossary', label: TYPES.glossary.label, color: TYPES.glossary.color },
    { id: 'knowledge', label: TYPES.knowledge.label, color: TYPES.knowledge.color },
    { id: 'quick', label: TYPES.quick.label, color: TYPES.quick.color },
    { id: 'archived', label: 'Archivados', color: '#8F877C' },
];
export const ENV_KEYS = Object.keys(ENVS);
export const TYPE_KEYS = Object.keys(TYPES);
