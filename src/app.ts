// Mi Base: base de conocimiento personal con notas Markdown enlazadas (Zettelkasten).
// Sin dependencias: TypeScript y la API del navegador.

import { Env, ENVS, ENV_KEYS, EnvFilter, FolderId, FOLDERS, Note, NoteType, TYPES, TYPE_KEYS, View } from './types.js';
import {
  escapeHtml as e,
  excerpt,
  extractLinks,
  filePath,
  keyIdea,
  LinkResolver,
  parseNote,
  plainText,
  renderInline,
  renderMarkdown,
  serializeNote,
  slugify,
} from './markdown.js';
import { LocalStore, NoteStore } from './store.js';
import { layoutGraph, Point } from './graph.js';
import { folderIcon, icon, logo } from './icons.js';

// Para usar tu servidor: const store: NoteStore = new HttpStore('/api');
const localStore = new LocalStore();
const store: NoteStore = localStore;

const GRAPH_W = 820;
const GRAPH_H = 580;

type Depth = 1 | 2 | 'all';
type GroupId = NoteType | 'archived';

interface State {
  notes: Note[];
  view: View;
  env: EnvFilter;
  selectedId: string | null;
  folder: FolderId;
  open: Partial<Record<FolderId, boolean>>;
  editing: boolean;
  draft: string;
  theme: 'dark' | 'light';
  quick: { open: boolean; title: string; body: string; env: Env };
  palette: { open: boolean; query: string; index: number; env: EnvFilter };
  graph: { focus: string | null; depth: Depth; hidden: Partial<Record<GroupId, boolean>>; zoom: number; panX: number; panY: number; trail: string[] };
  draftNote: { title: string; env: Env; type: NoteType; tags: string[]; body: string; url: string; forcedId: string };
}

const state: State = {
  notes: [],
  view: 'notes',
  env: 'all',
  selectedId: null,
  folder: 'pinned',
  open: { pinned: true },
  editing: false,
  draft: '',
  theme: readTheme(),
  quick: { open: false, title: '', body: '', env: 'gen' },
  palette: { open: false, query: '', index: 0, env: 'all' },
  graph: { focus: null, depth: 'all', hidden: {}, zoom: 1, panX: 0, panY: 0, trail: [] },
  draftNote: emptyDraft('gen'),
};

let pendingFocus: string | null = null;
let lastHash = '';

function emptyDraft(env: Env): State['draftNote'] {
  return { title: '', env, type: 'knowledge', tags: [], body: '', url: '', forcedId: '' };
}

function readTheme(): 'dark' | 'light' {
  try {
    const t = localStorage.getItem('kb.theme');
    if (t === 'dark' || t === 'light') return t;
  } catch {
    // sin almacenamiento
  }
  return 'dark';
}

// ---------- Consultas sobre las notas ----------

function byId(id: string | null | undefined): Note | undefined {
  return id ? state.notes.find((n) => n.id === id) : undefined;
}

function labelOf(n: Note): string {
  return n.type === 'ticket' ? n.title.split(' · ')[0] : n.title;
}

function shortOf(n: Note, max = 16): string {
  const l = labelOf(n);
  return l.length > max ? l.slice(0, max - 1) + '…' : l;
}

const resolve: LinkResolver = (id) => {
  const n = byId(id);
  return n ? { label: labelOf(n) } : null;
};

function linkIndex(): { out: Record<string, string[]>; missing: Record<string, string[]>; inc: Record<string, string[]> } {
  const out: Record<string, string[]> = {};
  const missing: Record<string, string[]> = {};
  const inc: Record<string, string[]> = {};
  for (const n of state.notes) inc[n.id] = [];
  for (const n of state.notes) {
    const links = extractLinks(n.body).filter((id) => id !== n.id);
    out[n.id] = links.filter((id) => byId(id));
    missing[n.id] = links.filter((id) => !byId(id));
    for (const t of out[n.id]) inc[t].push(n.id);
  }
  return { out, missing, inc };
}

function inEnv(n: Note, env: EnvFilter = state.env): boolean {
  return env === 'all' || n.env === env;
}

function inFolder(n: Note, f: FolderId): boolean {
  if (f === 'pinned') return n.pinned && !n.archived;
  if (f === 'archived') return n.archived;
  return n.type === f && !n.archived;
}

function notesInFolder(f: FolderId): Note[] {
  return state.notes.filter((n) => inEnv(n) && inFolder(n, f)).sort((a, b) => b.updated.localeCompare(a.updated));
}

function defaultFolder(n: Note): FolderId {
  return n.archived ? 'archived' : n.type;
}

function siblings(n: Note): { list: Note[]; folder: FolderId; index: number } {
  const folder = inFolder(n, state.folder) ? state.folder : defaultFolder(n);
  let list = notesInFolder(folder);
  if (!list.includes(n)) list = [n, ...list];
  return { list, folder, index: list.indexOf(n) };
}

function groupOf(n: Note): GroupId {
  return n.archived ? 'archived' : n.type;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  const hm = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if (diff === 0) return `hoy, ${hm}`;
  if (diff === 1) return `ayer, ${hm}`;
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('es-ES', opts);
}

function uniqueId(base: string): string {
  let id = slugify(base);
  let i = 2;
  while (byId(id)) id = `${slugify(base)}-${i++}`;
  return id;
}

function stripKeyIdea(body: string): string {
  const lines = body.split('\n');
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i >= lines.length || !lines[i].startsWith('>')) return body;
  while (i < lines.length && lines[i].startsWith('>')) i++;
  return lines.slice(i).join('\n').replace(/^\n+/, '');
}

// ---------- Rutas ----------
// #/nota/<id>?f=<carpeta> · #/grafo · #/grafo/<id> · #/nueva

function parseHash(): { view: View; id?: string; folder?: FolderId } {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [path, query] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  const f = new URLSearchParams(query || '').get('f') || undefined;
  const folder = FOLDERS.some((x) => x.id === f) ? (f as FolderId) : undefined;
  if (parts[0] === 'grafo') return { view: 'graph', id: parts[1] };
  if (parts[0] === 'nueva') return { view: 'new' };
  if (parts[0] === 'nota') return { view: 'notes', id: parts[1], folder };
  return { view: 'notes' };
}

function go(hash: string): void {
  if (location.hash === hash) onRoute();
  else location.hash = hash;
}

function editDirty(): boolean {
  const n = byId(state.selectedId);
  return state.editing && !!n && state.draft !== serializeNote(n);
}

function onRoute(): void {
  if (editDirty()) {
    const target = location.hash;
    history.replaceState(null, '', lastHash || '#/');
    void ask('Tienes cambios sin guardar en esta nota.', 'Descartar cambios').then((ok) => {
      if (!ok) return;
      state.editing = false;
      go(target);
    });
    return;
  }
  const r = parseHash();
  state.editing = false;
  state.palette.open = false;
  state.quick.open = false;
  closeAc();

  if (r.view === 'notes') {
    const n = byId(r.id) || byId(state.selectedId) || state.notes.find((x) => x.pinned) || state.notes[0];
    if (n) selectNote(n, r.folder);
  } else if (r.view === 'graph') {
    const f = byId(r.id) || byId(state.graph.focus) || byId(state.selectedId) || state.notes[0];
    if (f) focusGraph(f.id, false);
  } else if (r.view === 'new' && state.view !== 'new' && !state.draftNote.title && !state.draftNote.body) {
    state.draftNote = emptyDraft(state.env === 'all' ? 'gen' : state.env);
    pendingFocus = '#nn-title';
  }
  state.view = r.view;
  lastHash = location.hash;
  render();
  window.scrollTo(0, 0);
}

function selectNote(n: Note, folder?: FolderId): void {
  const f = folder && inFolder(n, folder) ? folder : inFolder(n, state.folder) ? state.folder : defaultFolder(n);
  state.selectedId = n.id;
  state.folder = f;
  state.open[f] = true;
}

function focusGraph(id: string, rerender = true): void {
  state.graph.focus = id;
  state.graph.trail = [...state.graph.trail.filter((t) => t !== id), id].slice(-7);
  if (rerender) {
    history.replaceState(null, '', `#/grafo/${encodeURIComponent(id)}`);
    lastHash = location.hash;
    render();
  }
}

// ---------- Plantillas compartidas ----------

function envPill(env: Env, short = false): string {
  return `<span class="pill p-${env}"><span class="sw" style="background:${ENVS[env].swatch}"></span>${short ? ENVS[env].short : ENVS[env].label}</span>`;
}

function envIcon(id: EnvFilter): string {
  return id === 'all' ? icon.grid() : id === 'prod' ? icon.server() : id === 'dev' ? icon.code() : icon.book();
}

function header(): string {
  const tabs = (['all', ...ENV_KEYS] as EnvFilter[])
    .map((id) => {
      const on = state.env === id;
      const label = id === 'all' ? 'Todos' : ENVS[id].label;
      return `<button type="button" class="tab${on ? ' on' : ''}${on && id === 'prod' ? ' on-prod' : ''}" data-action="set-env" data-env="${id}" aria-pressed="${on}">${envIcon(id)}${label}</button>`;
    })
    .join('');
  const themeBtn = state.theme === 'dark' ? icon.sun() : icon.moon();
  return `<header class="topbar">
    <a class="brand" href="#/">${logo}<span>Mi <span class="hl">Base</span></span></a>
    <nav class="tabs" aria-label="Entorno">${tabs}</nav>
    <button type="button" class="search-btn" data-action="open-palette">${icon.search()}<span class="grow">Buscar en todo…</span><span class="kbd">Ctrl K</span></button>
    <a class="btn${state.view === 'graph' ? ' btn-on' : ''}" href="#/grafo">${icon.graph()}Grafo <span class="kbd">G</span></a>
    <button type="button" class="btn btn-icon" data-action="toggle-theme" aria-label="${state.theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}">${themeBtn}</button>
    <button type="button" class="btn btn-icon" data-action="open-quick" aria-label="Nota rápida" title="Nota rápida (Q)">${icon.bolt()}</button>
    <a class="btn btn-primary" href="#/nueva">${icon.plus()}Nueva nota <span class="kbd">N</span></a>
  </header>
  ${state.env === 'prod' ? `<div class="banner-prod" role="status">${icon.warn()}<b>PRODUCCIÓN</b><span>Lo que copies o ejecutes desde aquí afecta a clientes reales.</span></div>` : ''}`;
}

function callout(text: string): string {
  return `<aside class="callout"><span class="callout-ico">${icon.sparkle()}</span><div><div class="lab">Idea clave</div><p>${renderInline(text, resolve)}</p></div></aside>`;
}

function editorHtml(id: string, text: string, previewHtml: string, fileLabel: string): string {
  return `<div class="split">
    <div class="ed">
      <div class="ed-bar"><label for="${id}" class="lab">Markdown · ${e(fileLabel)}</label><span class="hint"><span class="kbd">[[</span> enlazar nota</span></div>
      <textarea id="${id}" class="ed-area" spellcheck="false">${e(text)}</textarea>
    </div>
    <div class="preview iso"><div class="lab muted">Vista previa</div><div id="${id}-preview" class="md">${previewHtml}</div></div>
  </div>`;
}

// ---------- Vista: notas ----------

function notesView(): string {
  const idx = linkIndex();
  const n = byId(state.selectedId);
  const visibleNotes = state.notes.filter((x) => inEnv(x));
  const linkCount = visibleNotes.reduce((s, x) => s + idx.out[x.id].length, 0);
  const tags = [...new Set(visibleNotes.flatMap((x) => x.tags))].sort();

  const folders = FOLDERS.map((f) => {
    const list = notesInFolder(f.id);
    const open = !!state.open[f.id];
    const items = list
      .map((x) => {
        const on = x.id === state.selectedId && f.id === state.folder;
        return `<a class="tree-item${on ? ' on' : ''}" href="#/nota/${encodeURIComponent(x.id)}?f=${f.id}"${on ? ' aria-current="page"' : ''}>${icon.file()}<span class="grow ellipsis">${e(x.title)}</span>${state.env === 'all' ? `<span class="sw" style="background:${ENVS[x.env].swatch}" title="${ENVS[x.env].label}"></span>` : ''}</a>`;
      })
      .join('');
    return `<div class="folder">
      <button type="button" class="folder-btn" data-action="toggle-folder" data-folder="${f.id}" aria-expanded="${open}"><span class="chev${open ? ' open' : ''}">${icon.chevron()}</span>${folderIcon(f.color)}<span class="grow">${f.label}</span><span class="count">${list.length}</span></button>
      ${open ? `<div class="tree-children">${items || '<span class="empty">Vacía</span>'}</div>` : ''}
    </div>`;
  }).join('');

  const sidebar = `<aside class="sidebar" aria-label="Carpetas">
    <div class="side-head"><span class="side-title">${folderIcon('currentColor')}Mi carpeta</span><span class="count">${visibleNotes.length} notas · ${linkCount} enlaces</span></div>
    <div class="tree">${folders}</div>
    <div class="side-foot">
      <div class="mini-card"><span class="lab">Etiquetas</span><span class="count">${tags.length}</span></div>
      <div class="tags">${tags.map((t) => `<button type="button" class="tag" data-action="search-tag" data-tag="${e(t)}">#${e(t)}</button>`).join('')}</div>
      <div class="side-meta">${icon.git()}<span>~/kb · ficheros .md</span><button type="button" class="linkish" data-action="reset-data">Restablecer datos</button></div>
    </div>
  </aside>`;

  if (!n) {
    return `${sidebar}<main class="card main"><p class="empty-main">Elige una nota de la carpeta para verla aquí.</p></main><aside class="right"></aside>`;
  }

  const sib = siblings(n);
  const folderLabel = FOLDERS.find((f) => f.id === sib.folder)!.label;
  const out = idx.out[n.id];
  const inc = idx.inc[n.id];
  const missing = idx.missing[n.id];
  const fileName = filePath(n).split('/').pop()!;

  const actions = state.editing
    ? `<button type="button" class="btn" data-action="cancel-edit">Cancelar <span class="kbd">Esc</span></button>
       <button type="button" class="btn btn-primary" data-action="save-edit">${icon.check()}Guardar <span class="kbd">Ctrl S</span></button>`
    : `<button type="button" class="btn" data-action="edit">${icon.edit()}Editar <span class="kbd">E</span></button>
       <button type="button" class="btn" data-action="pin" aria-pressed="${n.pinned}">${icon.pin()}${n.pinned ? 'Quitar de fijados' : 'Fijar'}</button>
       <button type="button" class="btn" data-action="archive">${icon.archive()}${n.archived ? 'Restaurar' : 'Archivar'}</button>`;

  const stage = state.editing
    ? editorHtml('editor', state.draft, renderMarkdown(parseNote(state.draft, n.id).body, resolve), filePath(n))
    : `<article class="md">${renderMarkdown(stripKeyIdea(n.body), resolve) || '<p class="muted">Esta nota todavía no tiene contenido.</p>'}
        ${n.url ? `<a class="btn btn-pop" href="${e(n.url)}" target="_blank" rel="noopener noreferrer">${icon.external()}${n.type === 'ticket' ? 'Abrir ticket' : 'Abrir enlace'}<span class="kbd">Ctrl Intro</span></a>` : ''}
      </article>`;

  const sibStrip = sib.list
    .map((s, i) => `<a class="sib${s.id === n.id ? ' on' : ''}" href="#/nota/${encodeURIComponent(s.id)}?f=${sib.folder}"><span class="sib-dot">${i + 1}</span><span class="sib-label">${e(shortOf(s, 14))}</span></a>`)
    .join('');

  const main = `<main class="card main">
    <div class="note-head">
      <div class="grow min0">
        <div class="crumb">${ENVS[n.env].label} / ${folderLabel} / ${sib.index + 1} de ${sib.list.length}</div>
        <h1 class="title">${e(n.title)}</h1>
        <p class="excerpt">${e(excerpt(n.body, resolve))}</p>
      </div>
      <div class="pills">${envPill(n.env)}<span class="pill p-kind">${TYPES[n.type].singular}</span><span class="pill p-time">${icon.clock()}${fmtDate(n.updated)}</span></div>
    </div>
    <div class="stats">
      <div class="stat"><div class="lab">${icon.file(11)}Fichero</div><div class="stat-v">${e(fileName)}</div></div>
      <div class="stat"><div class="lab">${icon.arrowR(11)}Enlaza a</div><div class="stat-v">${out.length}</div></div>
      <div class="stat"><div class="lab">${icon.arrowL(11)}Enlazado desde</div><div class="stat-v">${inc.length}</div></div>
      <span class="grow"></span>
      <div class="actions">${actions}</div>
    </div>
    <div class="stage iso">${stage}</div>
    <div class="sib-strip">
      <div class="row between"><span class="lab">En ${folderLabel.toLowerCase()}</span><span class="count">${sib.index + 1} / ${sib.list.length}</span></div>
      <div class="sibs">${sibStrip}</div>
    </div>
  </main>`;

  const prev = sib.list[sib.index - 1];
  const next = sib.list[sib.index + 1];
  const key = keyIdea(n.body);
  const outRows = out
    .map((id) => byId(id)!)
    .map((t) => `<a class="link-row" href="#/nota/${encodeURIComponent(t.id)}"><span class="sw" style="background:${ENVS[t.env].swatch}"></span><span class="grow ellipsis">${e(t.title)}</span><span class="count">${TYPES[t.type].singular}</span></a>`)
    .join('');
  const missingRows = missing
    .map((id) => `<div class="link-row missing"><span class="sw"></span><span class="grow ellipsis">[[${e(id)}]] no existe</span><button type="button" class="btn btn-xs" data-action="create-missing" data-id="${e(id)}">Crear</button></div>`)
    .join('');
  const inRows = inc
    .map((id) => byId(id)!)
    .map((src) => {
      const line = src.body.split('\n').find((l) => l.includes(`[[${n.id}]]`) || l.includes(`[[${n.id}|`)) || '';
      let ctx = plainText(line, resolve);
      if (ctx.length > 90) ctx = '…' + ctx.slice(-89);
      return `<a class="link-row col" href="#/nota/${encodeURIComponent(src.id)}"><span class="row gap10 w100"><span class="sw" style="background:${ENVS[src.env].swatch}"></span><span class="grow ellipsis">${e(src.title)}</span></span>${ctx ? `<span class="ctx">«${e(ctx)}»</span>` : ''}</a>`;
    })
    .join('');

  const right = `<aside class="right" aria-label="Resumen y enlaces">
    <div class="card pad stack">
      <div class="row between"><span class="lab">Nota ${sib.index + 1} / ${sib.list.length}</span>${envPill(n.env, true)}</div>
      ${key ? callout(key) : '<p class="muted sm">Sin idea clave todavía. Al editar, añade una línea que empiece por «&gt;».</p>'}
      <div class="row gap8">
        <button type="button" class="btn" data-action="prev"${prev ? '' : ' disabled'}>${icon.arrowL()}Anterior</button>
        <button type="button" class="btn btn-primary grow min0 between" data-action="next"${next ? '' : ' disabled'}><span class="ellipsis">${next ? 'Siguiente: ' + e(shortOf(next, 18)) : 'Es la última'}</span>${icon.arrowR()}</button>
      </div>
      <div class="hints"><span><span class="kbd">←</span> <span class="kbd">→</span> nota</span><span><span class="kbd">E</span> editar</span><span><span class="kbd">G</span> grafo</span></div>
    </div>
    <div class="card pad stack">
      <div>
        <div class="row between mb6"><span class="lab">${icon.arrowR(12)}Enlaza a</span><span class="count">${out.length}</span></div>
        ${outRows || missingRows ? outRows + missingRows : '<p class="muted sm">No enlaza a ninguna nota. Edítala y escribe [[ para conectarla.</p>'}
      </div>
      <div class="divider"></div>
      <div>
        <div class="row between mb6"><span class="lab">${icon.arrowL(12)}Enlazado desde</span><span class="count">${inc.length}</span></div>
        ${inRows || '<p class="muted sm">Ninguna nota apunta aquí todavía.</p>'}
      </div>
      <a class="btn btn-block" href="#/grafo/${encodeURIComponent(n.id)}">${icon.graph(15)}Ver esta nota en el grafo</a>
    </div>
  </aside>`;

  return sidebar + main + right;
}

// ---------- Vista: nueva nota ----------

function draftPath(): string {
  const d = state.draftNote;
  const id = d.forcedId || (d.title.trim() ? uniqueId(d.title) : 'nueva-nota');
  return filePath({ id, env: d.env, type: d.type });
}

function draftLinksHtml(): string {
  const links = extractLinks(state.draftNote.body);
  if (!links.length) {
    return '<p class="muted sm">Todavía no enlaza a nada. Escribe <span class="kbd">[[</span> en el texto para elegir una nota.</p>';
  }
  return links
    .map((id) => {
      const t = byId(id);
      return t
        ? `<div class="link-row"><span class="sw" style="background:${ENVS[t.env].swatch}"></span><span class="grow ellipsis">${e(t.title)}</span><span class="ok">${icon.check(13)}</span></div>`
        : `<div class="link-row missing"><span class="sw"></span><span class="grow ellipsis">[[${e(id)}]] no existe</span></div>`;
    })
    .join('');
}

function newView(): string {
  const d = state.draftNote;
  const envBtns = ENV_KEYS.map(
    (k) => `<button type="button" class="chip${d.env === k ? ` on on-${k}` : ''}" data-action="nn-env" data-env="${k}" aria-pressed="${d.env === k}"><span class="sw" style="background:${ENVS[k].swatch}"></span>${ENVS[k].label}</button>`,
  ).join('');
  const typeBtns = TYPE_KEYS.map(
    (k) => `<button type="button" class="chip${d.type === k ? ' on' : ''}" data-action="nn-type" data-type="${k}" aria-pressed="${d.type === k}">${folderIcon(TYPES[k].color, 15, 12)}${TYPES[k].label}</button>`,
  ).join('');
  const tagChips = d.tags
    .map((t, i) => `<span class="tag-chip">#${e(t)}<button type="button" class="x" data-action="nn-tag-remove" data-index="${i}" aria-label="Quitar etiqueta ${e(t)}">${icon.close(10)}</button></span>`)
    .join('');
  const needsUrl = d.type === 'ticket' || d.type === 'link';

  return `<main class="card main">
    <div class="row wrap gap10 between">
      <div class="row wrap gap10"><span class="pill p-gen caps">Nueva nota</span><span class="muted sm">Se guardará en <b id="nn-path" class="ink2">${e(draftPath())}</b></span></div>
      <div class="row gap8">
        <button type="button" class="btn" data-action="nn-discard">Descartar</button>
        <button type="button" class="btn btn-primary" data-action="nn-save">${icon.check()}Guardar nota <span class="kbd">Ctrl S</span></button>
      </div>
    </div>
    <div>
      <label for="nn-title" class="lab muted">Título · la idea en una frase</label>
      <input id="nn-title" class="title-input" value="${e(d.title)}" placeholder="Por ejemplo: Idempotencia en consumidores de colas" autocomplete="off">
    </div>
    <div class="props">
      <div class="prop"><div class="lab muted">Entorno</div><div class="row wrap gap4">${envBtns}</div></div>
      <div class="prop grow"><div class="lab muted">Carpeta</div><div class="row wrap gap4">${typeBtns}</div></div>
      <div class="prop grow"><label class="lab muted" for="nn-tag">Etiquetas</label><div class="row wrap gap6">${tagChips}<input id="nn-tag" class="tag-input" placeholder="+ añadir y pulsa Intro" autocomplete="off"></div></div>
      ${needsUrl ? `<div class="prop grow"><label class="lab muted" for="nn-url">URL ${d.type === 'ticket' ? 'del ticket' : 'del enlace'}</label><input id="nn-url" class="input" value="${e(d.url)}" placeholder="https://…" autocomplete="off"></div>` : ''}
    </div>
    ${editorHtml('nn-body', d.body, renderMarkdown(d.body, resolve) || '<p class="muted">La vista previa aparece mientras escribes.</p>', 'texto de la nota')}
  </main>
  <aside class="right" aria-label="Enlaces y método">
    <div class="card pad stack">
      <div class="row between"><span class="lab">Enlaces de esta nota</span></div>
      <div id="nn-links">${draftLinksHtml()}</div>
      <div class="divider"></div>
      <p class="muted sm">Cuando la guardes, cada nota enlazada la mostrará en su lista «Enlazado desde».</p>
    </div>
    <div class="card pad key-card">
      <span class="callout-ico">${icon.sparkle()}</span>
      <div>
        <div class="lab vi">Método Zettelkasten</div>
        <ol class="rules"><li>Una sola idea por nota.</li><li>El título es la idea, no el tema.</li><li>Escríbela con tus palabras.</li><li>Enlázala al menos con otra nota.</li></ol>
        <p class="sm">Empieza con <span class="kbd">&gt;</span> para escribir la idea clave.</p>
      </div>
    </div>
  </aside>`;
}

// ---------- Vista: grafo ----------

let layoutCache: { sig: string; pos: Record<string, Point> } | null = null;

function nodeWidth(n: Note): number {
  return Math.round(shortOf(n, 24).length * 7.4 + 50);
}

function graphPositions(): Record<string, Point> {
  const idx = linkIndex();
  const edges: [string, string][] = [];
  for (const n of state.notes) for (const t of idx.out[n.id]) edges.push([n.id, t]);
  const sig = state.notes.map((n) => n.id + ':' + shortOf(n, 24)).sort().join('|') + '#' + edges.map((x) => x.join('>')).sort().join('|');
  if (!layoutCache || layoutCache.sig !== sig) {
    const widths: Record<string, number> = {};
    for (const n of state.notes) widths[n.id] = nodeWidth(n);
    layoutCache = { sig, pos: layoutGraph(state.notes.map((n) => n.id), edges, widths, GRAPH_W, GRAPH_H) };
  }
  return layoutCache.pos;
}

function viewBox(): string {
  const g = state.graph;
  const w = GRAPH_W / g.zoom;
  const h = GRAPH_H / g.zoom;
  return `${((GRAPH_W - w) / 2 - g.panX).toFixed(1)} ${((GRAPH_H - h) / 2 - g.panY).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
}

function boxEdge(from: Point, to: Point, halfW: number, halfH: number): Point {
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  if (!dx && !dy) return to;
  const f = Math.min(Math.abs(dx) > 0.01 ? halfW / Math.abs(dx) : Infinity, Math.abs(dy) > 0.01 ? halfH / Math.abs(dy) : Infinity);
  return { x: to.x + dx * Math.min(1, f), y: to.y + dy * Math.min(1, f) };
}

function graphView(): string {
  const g = state.graph;
  const idx = linkIndex();
  const pos = graphPositions();
  const visible = state.notes.filter((n) => inEnv(n) && !g.hidden[groupOf(n)]);
  const visibleIds = new Set(visible.map((n) => n.id));
  const adj: Record<string, Set<string>> = {};
  for (const n of visible) adj[n.id] = new Set();
  for (const n of visible) {
    for (const t of idx.out[n.id]) {
      if (!visibleIds.has(t)) continue;
      adj[n.id].add(t);
      adj[t].add(n.id);
    }
  }
  const focus = g.focus && visibleIds.has(g.focus) ? g.focus : null;
  const dist: Record<string, number> = {};
  if (focus) {
    dist[focus] = 0;
    const queue = [focus];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nb of adj[cur]) {
        if (dist[nb] === undefined) {
          dist[nb] = dist[cur] + 1;
          queue.push(nb);
        }
      }
    }
  }
  const shown = visible.filter((n) => !focus || g.depth === 'all' || (dist[n.id] !== undefined && dist[n.id] <= g.depth));
  const shownIds = new Set(shown.map((n) => n.id));

  let edgeCount = 0;
  const edgeSvg: string[] = [];
  for (const n of shown) {
    for (const t of idx.out[n.id]) {
      if (!shownIds.has(t)) continue;
      edgeCount++;
      const A = pos[n.id];
      const B = pos[t];
      const tn = byId(t)!;
      const both = idx.out[t].includes(n.id);
      let off = { x: 0, y: 0 };
      if (both) {
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        const s = n.id < t ? 1 : -1;
        off = { x: (-dy / len) * 4 * s, y: (dx / len) * 4 * s };
      }
      const a2 = { x: A.x + off.x, y: A.y + off.y };
      const b2 = { x: B.x + off.x, y: B.y + off.y };
      const start = boxEdge(b2, a2, nodeWidth(n) / 2 + 2, 17);
      const end = boxEdge(a2, b2, nodeWidth(tn) / 2 + 5, 20);
      const touch = !!focus && (n.id === focus || t === focus);
      edgeSvg.push(
        `<line class="gedge${touch ? ' touch' : focus ? ' far' : ''}" x1="${start.x.toFixed(1)}" y1="${start.y.toFixed(1)}" x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}" marker-end="url(#${touch ? 'arr-on' : 'arr'})"/>`,
      );
    }
  }

  let hub: Note | null = null;
  for (const n of shown) if (!hub || adj[n.id].size > adj[hub.id].size) hub = n;

  const nodeSvg = shown
    .map((n) => {
      const p = pos[n.id];
      const w = nodeWidth(n);
      const isFocus = n.id === focus;
      const isNb = !!focus && dist[n.id] === 1;
      const far = !!focus && !isFocus && !isNb;
      const h = isFocus ? 34 : 30;
      const cls = isFocus ? 'focus' : isNb ? 'nb' : far ? 'far' : '';
      const deg = adj[n.id].size;
      return `<g class="gnode ${cls}" data-action="g-focus" data-id="${e(n.id)}" transform="translate(${p.x} ${p.y})" tabindex="0" role="button" aria-label="${e(n.title)}, ${deg} conexiones">
        <title>${e(n.title)} · doble clic para abrir</title>
        ${isFocus ? `<rect class="g-ring" x="${-w / 2 - 6}" y="${-h / 2 - 6}" width="${w + 12}" height="${h + 12}" rx="13"/>` : ''}
        ${isFocus || isNb ? `<rect class="g-shadow" x="${-w / 2 + 1.5}" y="${-h / 2 + 2.5}" width="${w}" height="${h}" rx="9"/>` : ''}
        <rect class="g-bg" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="9"/>
        <rect x="${-w / 2 + 11}" y="-5" width="10" height="10" rx="3" fill="${TYPES[n.type].color}" stroke="rgba(0,0,0,.35)"/>
        <text class="g-label" x="${-w / 2 + 28}" y="4.2">${e(shortOf(n, 24))}</text>
        <circle cx="${w / 2 - 12}" cy="0" r="3.2" fill="${ENVS[n.env].swatch}"/>
      </g>`;
    })
    .join('');

  const depthBtns = ([1, 2, 'all'] as Depth[])
    .map((d) => `<button type="button" class="seg-btn${g.depth === d ? ' on' : ''}" data-action="g-depth" data-depth="${d}" aria-pressed="${g.depth === d}">${d === 'all' ? 'Todo' : d === 1 ? '1 salto' : '2 saltos'}</button>`)
    .join('');
  const hints: Record<string, string> = {
    '1': 'Solo la nota activa y las que enlaza o la enlazan.',
    '2': 'Añade las vecinas de sus vecinas: el contexto cercano.',
    all: 'Toda la red. Lo que no conecta con la nota activa se atenúa.',
  };
  const groups: { id: GroupId; label: string; color: string }[] = [
    ...TYPE_KEYS.map((k) => ({ id: k as GroupId, label: TYPES[k].label, color: TYPES[k].color })),
    { id: 'archived', label: 'Archivados', color: '#8F877C' },
  ];
  const groupBtns = groups
    .map((gr) => {
      const on = !g.hidden[gr.id];
      const count = state.notes.filter((n) => inEnv(n) && groupOf(n) === gr.id).length;
      return `<button type="button" class="check-row${on ? '' : ' off'}" data-action="g-type" data-type="${gr.id}" aria-pressed="${on}"><span class="check" style="border-color:${gr.color};background:${on ? gr.color : 'transparent'}">${on ? icon.check(10) : ''}</span><span class="grow">${gr.label}</span><span class="count">${count}</span></button>`;
    })
    .join('');

  const F = byId(focus) || byId(g.focus);
  const trail = g.trail
    .filter((id) => byId(id))
    .map((id, i) => {
      const n = byId(id)!;
      return `${i ? `<span class="muted">${icon.arrowR(12)}</span>` : ''}<button type="button" class="chip${id === g.focus ? ' on' : ''}" data-action="g-focus" data-id="${e(id)}">${e(shortOf(n, 18))}</button>`;
    })
    .join('');

  let rightPanel = '<aside class="right"></aside>';
  if (F) {
    const outL = idx.out[F.id].map((id) => byId(id)!);
    const inL = idx.inc[F.id].map((id) => byId(id)!);
    const row = (n: Note, dir: 'in' | 'out') =>
      `<button type="button" class="link-row" data-action="g-focus" data-id="${e(n.id)}"><span class="sq" style="background:${TYPES[n.type].color}"></span><span class="grow ellipsis">${e(n.title)}</span>${dir === 'out' ? icon.arrowR(12) : icon.arrowL(12)}</button>`;
    const key = keyIdea(F.body);
    rightPanel = `<aside class="right" aria-label="Nota activa">
      <div class="card pad stack">
        <div class="row between"><span class="lab">Nota activa</span>${envPill(F.env, true)}</div>
        <div><div class="row gap8 muted xs mb4">${folderIcon(TYPES[F.type].color, 15, 12)}${TYPES[F.type].label}${F.archived ? ' · archivada' : ''}</div><h2 class="h2">${e(F.title)}</h2></div>
        ${key ? callout(key) : `<p class="muted sm">${e(excerpt(F.body, resolve))}</p>`}
        <a class="btn btn-primary between" href="#/nota/${encodeURIComponent(F.id)}">Abrir la nota${icon.arrowR()}</a>
      </div>
      <div class="card pad stack">
        <div><div class="row between mb6"><span class="lab">Enlaza a</span><span class="count">${outL.length}</span></div>${outL.map((n) => row(n, 'out')).join('') || '<p class="muted sm">No enlaza a ninguna nota.</p>'}</div>
        <div class="divider"></div>
        <div><div class="row between mb6"><span class="lab">Enlazado desde</span><span class="count">${inL.length}</span></div>${inL.map((n) => row(n, 'in')).join('') || '<p class="muted sm">Ninguna nota apunta aquí.</p>'}</div>
      </div>
      <div class="hints"><span><span class="kbd">1</span> <span class="kbd">2</span> <span class="kbd">0</span> profundidad</span><span><span class="kbd">+</span> <span class="kbd">−</span> zoom</span><span>doble clic abre</span></div>
    </aside>`;
  }

  return `<aside class="sidebar filters" aria-label="Filtros del grafo">
      <div class="card pad"><div class="lab mb8">Profundidad</div><div class="seg">${depthBtns}</div><p class="muted sm mt8">${hints[String(g.depth)]}</p></div>
      <div class="card pad"><div class="row between mb6"><span class="lab">Carpetas</span><span class="count">color del nodo</span></div>${groupBtns}</div>
      <div class="card pad stat-grid">
        <div class="stat"><div class="lab">Notas</div><div class="stat-big">${shown.length}</div></div>
        <div class="stat"><div class="lab">Enlaces</div><div class="stat-big">${edgeCount}</div></div>
        <div class="stat span2"><div class="lab">Más conectada</div><div class="stat-v">${hub ? e(shortOf(hub, 22)) + ' · ' + adj[hub.id].size : '—'}</div></div>
      </div>
    </aside>
    <main class="card main">
      <div class="row wrap between gap10">
        <div class="min0"><div class="crumb">Grafo / centrado en</div><h1 class="title sm">${F ? e(F.title) : 'Ninguna nota'}</h1></div>
        <div class="row gap6">
          <button type="button" class="btn btn-icon" data-action="g-zoom-out" aria-label="Alejar">${icon.minus()}</button>
          <button type="button" class="btn" data-action="g-zoom-reset" id="zoom-label">${Math.round(g.zoom * 100)}%</button>
          <button type="button" class="btn btn-icon" data-action="g-zoom-in" aria-label="Acercar">${icon.plus()}</button>
        </div>
      </div>
      <div class="graph-box iso" id="graph-box">
        ${shown.length ? '' : '<div class="graph-empty">No hay notas con estos filtros.</div>'}
        <svg id="graph-svg" viewBox="${viewBox()}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Grafo de notas">
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="arr" d="M0 1 L9 5 L0 9 z"/></marker>
            <marker id="arr-on" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="arr-on" d="M0 1 L9 5 L0 9 z"/></marker>
          </defs>
          <g>${edgeSvg.join('')}</g>
          <g>${nodeSvg}</g>
        </svg>
      </div>
      <div class="legend">
        <span><i class="lg-line on"></i>enlaces de la nota activa</span>
        <span><i class="lg-line"></i>otros enlaces</span>
        <span>la flecha apunta a la nota enlazada</span>
        <span class="row gap6"><span class="sw round" style="background:${ENVS.prod.swatch}"></span>prod <span class="sw round" style="background:${ENVS.dev.swatch}"></span>dev <span class="sw round" style="background:${ENVS.gen.swatch}"></span>general</span>
        <span class="grow"></span><span>arrastra para moverte · rueda para zoom</span>
      </div>
      <div class="trail"><span class="lab">Recorrido</span>${trail}</div>
    </main>
    ${rightPanel}`;
}

// ---------- Modales ----------

function quickModal(): string {
  const q = state.quick;
  const envBtns = ENV_KEYS.map(
    (k) => `<button type="button" class="chip${q.env === k ? ` on on-${k}` : ''}" data-action="q-env" data-env="${k}" aria-pressed="${q.env === k}"><span class="sw" style="background:${ENVS[k].swatch}"></span>${ENVS[k].label}</button>`,
  ).join('');
  return `<div class="scrim" data-action="scrim-close">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="q-head">
      <div class="modal-head"><h2 id="q-head" class="pill p-gen caps">Nota rápida</h2><button type="button" class="btn btn-icon sm" data-action="close-modal" aria-label="Cerrar">${icon.close()}</button></div>
      <div class="modal-body">
        <label for="q-title" class="sr">Título</label>
        <input id="q-title" class="title-input sm" value="${e(q.title)}" placeholder="Título" autocomplete="off">
        <label for="q-body" class="sr">Texto</label>
        <textarea id="q-body" class="plain-area" placeholder="Lo que necesites recordar. Escribe [[ para enlazar otra nota.">${e(q.body)}</textarea>
      </div>
      <div class="modal-foot"><div class="row wrap gap6 grow">${envBtns}</div><button type="button" class="btn btn-primary" data-action="q-save">Guardar <span class="kbd">Ctrl Intro</span></button></div>
    </div>
  </div>`;
}

interface Hit {
  note: Note;
  score: number;
  context: string;
}

function searchNotes(query: string, env: EnvFilter): Hit[] {
  const q = query.trim().toLowerCase();
  const pool = state.notes.filter((n) => inEnv(n, env));
  if (!q) {
    return [...pool]
      .sort((a, b) => b.updated.localeCompare(a.updated))
      .slice(0, 8)
      .map((note) => ({ note, score: 0, context: '' }));
  }
  const hits: Hit[] = [];
  for (const n of pool) {
    const title = n.title.toLowerCase();
    let score = 0;
    let context = '';
    if (q.startsWith('#')) {
      const tag = q.slice(1);
      if (n.tags.some((t) => t.startsWith(tag))) score = 50;
    } else {
      if (title.startsWith(q) || n.id.startsWith(q)) score = 100;
      else if (title.includes(q) || n.id.includes(q)) score = 80;
      else if (n.tags.some((t) => t.includes(q))) score = 50;
      else {
        const text = plainText(n.body, resolve);
        const at = text.toLowerCase().indexOf(q);
        if (at >= 0) {
          score = 20;
          const from = Math.max(0, at - 30);
          context = (from ? '…' : '') + text.slice(from, at + q.length + 40) + '…';
        }
      }
    }
    if (score) hits.push({ note: n, score: score - (n.archived ? 5 : 0), context });
  }
  return hits.sort((a, b) => b.score - a.score || b.note.updated.localeCompare(a.note.updated));
}

function highlight(text: string, q: string): string {
  const query = q.trim().replace(/^#/, '');
  if (!query) return e(text);
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return e(text);
  return e(text.slice(0, at)) + '<mark>' + e(text.slice(at, at + query.length)) + '</mark>' + e(text.slice(at + query.length));
}

function paletteResults(): { html: string; flat: Note[] } {
  const p = state.palette;
  const hits = searchNotes(p.query, p.env);
  if (!hits.length) return { html: '<div class="pal-empty">Nada coincide. Prueba otra palabra o crea la nota con <span class="kbd">N</span>.</div>', flat: [] };
  const flat: Note[] = [];
  let html = '';
  // Los grupos se ordenan por su mejor resultado, así el primero de la lista es siempre el mejor.
  const firstAt = (env: Env) => {
    const i = hits.findIndex((h) => h.note.env === env);
    return i < 0 ? Infinity : i;
  };
  const groups: (Env | 'recent')[] = p.query.trim() ? [...ENV_KEYS].sort((a, b) => firstAt(a) - firstAt(b)) : ['recent'];
  for (const gid of groups) {
    const list = gid === 'recent' ? hits : hits.filter((h) => h.note.env === gid);
    if (!list.length) continue;
    html += `<div class="pal-group ${gid === 'recent' ? '' : 'g-' + gid}">${gid === 'recent' ? 'Recientes' : ENVS[gid].label}</div>`;
    for (const h of list) {
      const i = flat.length;
      flat.push(h.note);
      html += `<a class="pal-row${i === p.index ? ' on' : ''}" href="#/nota/${encodeURIComponent(h.note.id)}" role="option" aria-selected="${i === p.index}" data-index="${i}">
        ${envPill(h.note.env, true)}
        <span class="grow min0"><span class="pal-title">${highlight(h.note.title, p.query)}</span>
        <span class="pal-sub">${h.context ? highlight(h.context, p.query) : TYPES[h.note.type].singular + ' · ' + e(filePath(h.note))}</span></span>
        ${i === p.index ? '<span class="kbd">Intro</span>' : ''}
      </a>`;
    }
  }
  return { html, flat };
}

function paletteEnvChips(): string {
  const p = state.palette;
  return (['all', ...ENV_KEYS] as EnvFilter[])
    .map((id) => {
      const count = searchNotes(p.query, id).length;
      const on = p.env === id;
      return `<button type="button" class="chip${on ? ' on' : ''}" data-action="pal-env" data-env="${id}" aria-pressed="${on}">${id === 'all' ? '' : `<span class="sw" style="background:${ENVS[id].swatch}"></span>`}${id === 'all' ? 'Todos' : ENVS[id].label} · ${count}</button>`;
    })
    .join('');
}

function paletteModal(): string {
  return `<div class="scrim" data-action="scrim-close">
    <div class="palette" role="dialog" aria-modal="true" aria-label="Buscar notas">
      <div class="pal-input-row">${icon.search(17)}<label for="pal-input" class="sr">Buscar</label><input id="pal-input" value="${e(state.palette.query)}" placeholder="Busca por título, id, #etiqueta o texto…" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="pal-list"><span class="kbd">Esc</span></div>
      <div class="pal-envs" id="pal-envs">${paletteEnvChips()}</div>
      <div class="pal-list" id="pal-list" role="listbox">${paletteResults().html}</div>
      <div class="pal-foot"><span><span class="kbd">↑</span> <span class="kbd">↓</span> moverse</span><span><span class="kbd">Intro</span> abrir</span><span><span class="kbd">#</span> buscar etiqueta</span></div>
    </div>
  </div>`;
}

function refreshPalette(): void {
  const list = document.getElementById('pal-list');
  const chips = document.getElementById('pal-envs');
  if (list) list.innerHTML = paletteResults().html;
  if (chips) chips.innerHTML = paletteEnvChips();
  document.querySelector('.pal-row.on')?.scrollIntoView({ block: 'nearest' });
}

// ---------- Renderizado ----------

const root = document.getElementById('app')!;

function render(): void {
  document.documentElement.dataset.theme = state.theme;
  const body = state.view === 'graph' ? graphView() : state.view === 'new' ? newView() : notesView();
  root.innerHTML = `${header()}<div class="body view-${state.view}">${body}</div>${state.quick.open ? quickModal() : ''}${state.palette.open ? paletteModal() : ''}`;
  if (pendingFocus) {
    const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(pendingFocus);
    if (el) {
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
    pendingFocus = null;
  }
}

/** Diálogo de confirmación propio (confirm() no funciona dentro de algunos marcos). */
function ask(message: string, okLabel: string): Promise<boolean> {
  return new Promise((done) => {
    const wrap = document.createElement('div');
    wrap.className = 'scrim';
    wrap.innerHTML = `<div class="modal confirm" role="alertdialog" aria-modal="true" aria-labelledby="ask-msg">
      <div class="modal-body"><p id="ask-msg" class="ask-msg">${e(message)}</p></div>
      <div class="modal-foot"><span class="grow"></span><button type="button" class="btn" data-ask="no">Cancelar</button><button type="button" class="btn btn-primary" data-ask="yes">${e(okLabel)}</button></div>
    </div>`;
    const finish = (value: boolean) => {
      wrap.remove();
      window.removeEventListener('keydown', onKey, true);
      done(value);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' && ev.key !== 'Enter') return;
      ev.preventDefault();
      ev.stopPropagation();
      finish(ev.key === 'Enter');
    };
    wrap.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const b = (ev.target as Element).closest('[data-ask]');
      if (b) finish(b.getAttribute('data-ask') === 'yes');
      else if (ev.target === wrap) finish(false);
    });
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(wrap);
    wrap.querySelector<HTMLButtonElement>('[data-ask="yes"]')?.focus();
  });
}

let toastTimer = 0;
function toast(msg: string): void {
  const t = document.getElementById('toast')!;
  t.innerHTML = `${icon.check()}<span>${e(msg)}</span>`;
  t.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), 2200);
}

// ---------- Acciones ----------

async function persist(n: Note): Promise<boolean> {
  try {
    await store.save(n);
    return true;
  } catch (err) {
    toast('No se pudo guardar: ' + (err instanceof Error ? err.message : String(err)));
    return false;
  }
}

function upsert(n: Note): void {
  const i = state.notes.findIndex((x) => x.id === n.id);
  if (i >= 0) state.notes[i] = n;
  else state.notes.push(n);
}

function startEdit(): void {
  const n = byId(state.selectedId);
  if (!n || state.view !== 'notes') return;
  state.editing = true;
  state.draft = serializeNote(n);
  pendingFocus = '#editor';
  render();
}

async function saveEdit(): Promise<void> {
  const n = byId(state.selectedId);
  if (!n || !state.editing) return;
  const parsed = parseNote(state.draft, n.id);
  const updated: Note = { ...parsed, id: n.id, updated: new Date().toISOString() };
  if (!(await persist(updated))) return;
  upsert(updated);
  state.editing = false;
  closeAc();
  selectNote(updated, state.folder);
  render();
  toast(`Guardado en ${filePath(updated)}`);
}

async function saveDraftNote(): Promise<void> {
  const d = state.draftNote;
  const title = d.title.trim();
  if (!title) {
    toast('Ponle un título a la nota');
    document.getElementById('nn-title')?.focus();
    return;
  }
  const id = d.forcedId && !byId(d.forcedId) ? d.forcedId : uniqueId(title);
  const note: Note = {
    id,
    title,
    type: d.type,
    env: d.env,
    tags: d.tags,
    pinned: false,
    archived: false,
    url: d.url.trim() || undefined,
    updated: new Date().toISOString(),
    body: d.body.replace(/\s+$/, ''),
  };
  if (!(await persist(note))) return;
  upsert(note);
  state.draftNote = emptyDraft(d.env);
  state.folder = note.type;
  state.open[note.type] = true;
  closeAc();
  go(`#/nota/${encodeURIComponent(id)}?f=${note.type}`);
  toast(`Nota creada en ${filePath(note)}`);
}

async function saveQuick(): Promise<void> {
  const q = state.quick;
  const title = q.title.trim();
  if (!title) {
    toast('Ponle un título a la nota');
    document.getElementById('q-title')?.focus();
    return;
  }
  const note: Note = {
    id: uniqueId(title),
    title,
    type: 'quick',
    env: q.env,
    tags: [],
    pinned: false,
    archived: false,
    updated: new Date().toISOString(),
    body: q.body.trim(),
  };
  if (!(await persist(note))) return;
  upsert(note);
  state.quick = { open: false, title: '', body: '', env: q.env };
  state.folder = 'quick';
  state.open.quick = true;
  closeAc();
  go(`#/nota/${encodeURIComponent(note.id)}?f=quick`);
  toast('Nota rápida guardada');
}

async function createStub(title: string, env: Env): Promise<string> {
  const note: Note = {
    id: uniqueId(title),
    title,
    type: 'quick',
    env,
    tags: [],
    pinned: false,
    archived: false,
    updated: new Date().toISOString(),
    body: '',
  };
  await persist(note);
  upsert(note);
  toast(`Creada la nota «${title}»`);
  return note.id;
}

function openPalette(query = ''): void {
  state.palette = { open: true, query, index: 0, env: state.env };
  state.quick.open = false;
  pendingFocus = '#pal-input';
  render();
}

function closeModals(): void {
  state.palette.open = false;
  state.quick.open = false;
  closeAc();
  render();
}

function moveInFolder(step: number): void {
  const n = byId(state.selectedId);
  if (!n) return;
  const sib = siblings(n);
  const target = sib.list[sib.index + step];
  if (target) go(`#/nota/${encodeURIComponent(target.id)}?f=${sib.folder}`);
}

function setZoom(z: number): void {
  state.graph.zoom = Math.min(2.5, Math.max(0.5, Math.round(z * 100) / 100));
  const svgEl = document.getElementById('graph-svg');
  const label = document.getElementById('zoom-label');
  if (svgEl) svgEl.setAttribute('viewBox', viewBox());
  if (label) label.textContent = `${Math.round(state.graph.zoom * 100)}%`;
}

function updateEditorPreview(id: string, md: string): void {
  const prev = document.getElementById(`${id}-preview`);
  if (prev) prev.innerHTML = renderMarkdown(md, resolve) || '<p class="muted">La vista previa aparece mientras escribes.</p>';
}

// ---------- Autocompletado de [[enlaces]] ----------

interface AcItem {
  create: boolean;
  id: string;
  title: string;
  sub: string;
  color: string;
  env: Env;
}

const ac = {
  open: false,
  el: null as HTMLTextAreaElement | null,
  start: 0,
  query: '',
  index: 0,
  items: [] as AcItem[],
  env: 'gen' as Env,
};

function closeAc(): void {
  ac.open = false;
  ac.el = null;
  const box = document.getElementById('ac');
  if (box) box.hidden = true;
}

function updateAc(ta: HTMLTextAreaElement, selfId: string, env: Env): void {
  const pos = ta.selectionStart;
  const before = ta.value.slice(0, pos);
  const m = before.match(/\[\[([^\]\n|]{0,40})$/);
  if (!m) return closeAc();
  const q = m[1].trim().toLowerCase();
  const items: AcItem[] = state.notes
    .filter((n) => n.id !== selfId)
    .map((n) => {
      const t = n.title.toLowerCase();
      const score = !q ? 1 : n.id.startsWith(q) || t.startsWith(q) ? 3 : n.id.includes(q) || t.includes(q) ? 2 : 0;
      return { n, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.n.updated.localeCompare(a.n.updated))
    .slice(0, 6)
    .map(({ n }) => ({
      create: false,
      id: n.id,
      title: n.title,
      sub: `${n.archived ? 'Archivados' : TYPES[n.type].label} · ${ENVS[n.env].short}`,
      color: n.archived ? '#8F877C' : TYPES[n.type].color,
      env: n.env,
    }));
  if (q && !byId(slugify(m[1]))) {
    items.push({ create: true, id: '', title: m[1].trim(), sub: 'Crear una nota nueva y enlazarla', color: TYPES.quick.color, env });
  }
  if (!items.length) return closeAc();
  ac.open = true;
  ac.el = ta;
  ac.start = pos - m[1].length;
  ac.query = m[1];
  ac.items = items;
  ac.env = env;
  if (ac.index >= items.length) ac.index = 0;
  renderAc();
}

function renderAc(): void {
  const box = document.getElementById('ac');
  if (!box || !ac.el) return;
  const rows = ac.items
    .map((it, i) => {
      const label = it.create ? `Crear «${e(it.title)}»` : highlight(it.title, ac.query);
      return `<div class="ac-row${i === ac.index ? ' on' : ''}" data-ac="${i}" role="option" aria-selected="${i === ac.index}">
        ${it.create ? `<span class="ac-plus">${icon.plus(12)}</span>` : folderIcon(it.color, 15, 12)}
        <span class="grow min0"><span class="ac-title">${label}</span><span class="ac-sub">${e(it.sub)}</span></span>
        ${it.create ? '' : envPill(it.env, true)}
      </div>`;
    })
    .join('');
  box.innerHTML = `<div class="ac-head"><span class="lab">Enlazar con…</span><span class="count">${ac.query ? '«' + e(ac.query) + '»' : 'escribe para filtrar'}</span></div>
    <div class="ac-list" role="listbox">${rows}</div>
    <div class="ac-foot"><span><span class="kbd">↑</span> <span class="kbd">↓</span> elegir</span><span><span class="kbd">Intro</span> enlazar</span><span><span class="kbd">Esc</span> cerrar</span></div>`;
  box.hidden = false;

  // Coloca la lista bajo la línea del cursor (aproximado, sin contar líneas partidas).
  const ta = ac.el;
  const r = ta.getBoundingClientRect();
  const cs = getComputedStyle(ta);
  const lh = parseFloat(cs.lineHeight) || 22;
  const before = ta.value.slice(0, ta.selectionStart).split('\n');
  const line = before.length;
  const col = before[before.length - 1].length;
  const charW = parseFloat(cs.fontSize) * 0.6;
  let top = r.top + parseFloat(cs.paddingTop) + line * lh - ta.scrollTop + 6;
  top = Math.min(Math.max(top, r.top + lh), r.bottom - 8);
  const boxH = box.offsetHeight;
  if (top + boxH > window.innerHeight - 12) top = Math.max(12, top - boxH - lh - 12);
  const left = Math.min(r.left + parseFloat(cs.paddingLeft) + col * charW - 20, window.innerWidth - box.offsetWidth - 12);
  box.style.top = `${Math.round(top)}px`;
  box.style.left = `${Math.round(Math.max(12, left))}px`;
}

async function pickAc(i: number): Promise<void> {
  const it = ac.items[i];
  const ta = ac.el;
  if (!it || !ta) return;
  const start = ac.start;
  const end = ta.selectionStart;
  const env = ac.env;
  closeAc();
  const id = it.create ? await createStub(it.title, env) : it.id;
  const value = ta.value;
  const after = value.slice(end).replace(/^[^\]\n]*\]\]/, '');
  ta.value = value.slice(0, start) + id + ']]' + after;
  const caret = start + id.length + 2;
  ta.focus();
  ta.setSelectionRange(caret, caret);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

function handleAcKey(ev: KeyboardEvent): boolean {
  if (!ac.open) return false;
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    ac.index = (ac.index + (ev.key === 'ArrowDown' ? 1 : -1) + ac.items.length) % ac.items.length;
    renderAc();
  } else if (ev.key === 'Enter' || ev.key === 'Tab') {
    void pickAc(ac.index);
  } else if (ev.key === 'Escape') {
    closeAc();
  } else {
    return false;
  }
  ev.preventDefault();
  ev.stopPropagation();
  return true;
}

// ---------- Eventos ----------

document.addEventListener('click', (ev) => {
  const target = ev.target as Element;
  const el = target.closest('[data-action]');
  if (!el) return;
  const action = el.getAttribute('data-action');
  const data = (k: string) => el.getAttribute(`data-${k}`) || '';

  switch (action) {
    case 'scrim-close':
      if (target === el) closeModals();
      return;
    case 'close-modal':
      closeModals();
      return;
    case 'set-env':
      state.env = data('env') as EnvFilter;
      render();
      return;
    case 'toggle-theme':
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('kb.theme', state.theme);
      } catch {
        // sin almacenamiento
      }
      document.documentElement.dataset.theme = state.theme;
      render();
      return;
    case 'open-palette':
      openPalette();
      return;
    case 'open-quick':
      state.quick.open = true;
      state.quick.env = state.env === 'all' ? 'gen' : state.env;
      pendingFocus = '#q-title';
      render();
      return;
    case 'toggle-folder': {
      const f = data('folder') as FolderId;
      state.open[f] = !state.open[f];
      render();
      return;
    }
    case 'search-tag':
      openPalette('#' + data('tag'));
      return;
    case 'reset-data':
      void ask('¿Volver a los datos de prueba? Se perderán los cambios hechos en este navegador.', 'Restablecer').then((ok) => {
        if (!ok) return;
        localStore.reset();
        location.hash = '#/';
        location.reload();
      });
      return;
    case 'edit':
      startEdit();
      return;
    case 'cancel-edit':
      state.editing = false;
      closeAc();
      render();
      return;
    case 'save-edit':
      void saveEdit();
      return;
    case 'pin':
    case 'archive': {
      const n = byId(state.selectedId);
      if (!n) return;
      const updated: Note = action === 'pin' ? { ...n, pinned: !n.pinned } : { ...n, archived: !n.archived };
      updated.updated = new Date().toISOString();
      void persist(updated).then((ok) => {
        if (!ok) return;
        upsert(updated);
        if (action === 'archive') {
          state.folder = defaultFolder(updated);
          state.open[state.folder] = true;
          toast(updated.archived ? 'Archivada. Sus enlaces siguen funcionando.' : 'Restaurada');
        } else {
          toast(updated.pinned ? 'Añadida a fijados' : 'Quitada de fijados');
        }
        render();
      });
      return;
    }
    case 'prev':
      moveInFolder(-1);
      return;
    case 'next':
      moveInFolder(1);
      return;
    case 'copy-code': {
      const pre = el.closest('.code')?.querySelector('pre');
      if (!pre) return;
      navigator.clipboard
        ?.writeText(pre.textContent || '')
        .then(() => toast('Copiado al portapapeles'))
        .catch(() => toast('No se pudo copiar'));
      return;
    }
    case 'create-missing': {
      const id = data('id');
      const n = byId(state.selectedId);
      state.draftNote = { ...emptyDraft(n ? n.env : 'gen'), title: id.replace(/-/g, ' '), forcedId: id };
      pendingFocus = '#nn-title';
      go('#/nueva');
      return;
    }
    case 'g-focus':
      if (dragMoved) return;
      focusGraph(data('id'));
      return;
    case 'g-depth': {
      const d = data('depth');
      state.graph.depth = d === 'all' ? 'all' : (Number(d) as Depth);
      render();
      return;
    }
    case 'g-type': {
      const t = data('type') as GroupId;
      state.graph.hidden[t] = !state.graph.hidden[t];
      render();
      return;
    }
    case 'g-zoom-in':
      setZoom(state.graph.zoom + 0.15);
      return;
    case 'g-zoom-out':
      setZoom(state.graph.zoom - 0.15);
      return;
    case 'g-zoom-reset':
      state.graph.panX = 0;
      state.graph.panY = 0;
      setZoom(1);
      return;
    case 'nn-env':
      state.draftNote.env = data('env') as Env;
      render();
      return;
    case 'nn-type':
      state.draftNote.type = data('type') as NoteType;
      render();
      return;
    case 'nn-tag-remove':
      state.draftNote.tags.splice(Number(data('index')), 1);
      render();
      return;
    case 'nn-save':
      void saveDraftNote();
      return;
    case 'nn-discard': {
      const leave = () => {
        state.draftNote = emptyDraft(state.draftNote.env);
        go(state.selectedId ? `#/nota/${encodeURIComponent(state.selectedId)}` : '#/');
      };
      if (state.draftNote.title || state.draftNote.body) {
        void ask('¿Descartar esta nota? Lo que has escrito se perderá.', 'Descartar').then((ok) => ok && leave());
      } else {
        leave();
      }
      return;
    }
    case 'q-env':
      state.quick.env = data('env') as Env;
      render();
      pendingFocus = null;
      return;
    case 'q-save':
      void saveQuick();
      return;
    case 'pal-env':
      state.palette.env = data('env') as EnvFilter;
      state.palette.index = 0;
      refreshPalette();
      document.getElementById('pal-input')?.focus();
      return;
  }
});

document.addEventListener('dblclick', (ev) => {
  const node = (ev.target as Element).closest('.gnode');
  if (node) go(`#/nota/${encodeURIComponent(node.getAttribute('data-id') || '')}`);
});

document.addEventListener('input', (ev) => {
  const t = ev.target as HTMLInputElement | HTMLTextAreaElement;
  switch (t.id) {
    case 'editor': {
      state.draft = t.value;
      const n = byId(state.selectedId);
      updateEditorPreview('editor', parseNote(t.value, state.selectedId || '').body);
      updateAc(t as HTMLTextAreaElement, state.selectedId || '', n ? n.env : 'gen');
      return;
    }
    case 'nn-title': {
      state.draftNote.title = t.value;
      const p = document.getElementById('nn-path');
      if (p) p.textContent = draftPath();
      return;
    }
    case 'nn-url':
      state.draftNote.url = t.value;
      return;
    case 'nn-body': {
      state.draftNote.body = t.value;
      updateEditorPreview('nn-body', t.value);
      const links = document.getElementById('nn-links');
      if (links) links.innerHTML = draftLinksHtml();
      updateAc(t as HTMLTextAreaElement, '', state.draftNote.env);
      return;
    }
    case 'q-title':
      state.quick.title = t.value;
      return;
    case 'q-body':
      state.quick.body = t.value;
      updateAc(t as HTMLTextAreaElement, '', state.quick.env);
      return;
    case 'pal-input':
      state.palette.query = t.value;
      state.palette.index = 0;
      refreshPalette();
      return;
  }
});

document.addEventListener('focusout', (ev) => {
  if (ac.open && ev.target === ac.el) window.setTimeout(() => {
    if (document.activeElement !== ac.el) closeAc();
  }, 120);
});

document.addEventListener('mousedown', (ev) => {
  const row = (ev.target as Element).closest('[data-ac]');
  if (row) {
    ev.preventDefault();
    void pickAc(Number(row.getAttribute('data-ac')));
  }
});

window.addEventListener('resize', () => closeAc());
document.addEventListener('scroll', () => closeAc(), true);

document.addEventListener('keydown', (ev) => {
  if (handleAcKey(ev)) return;
  const t = ev.target as HTMLElement;
  const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
  const mod = ev.ctrlKey || ev.metaKey;
  const key = ev.key.toLowerCase();

  if (mod && key === 'k') {
    ev.preventDefault();
    openPalette();
    return;
  }

  if (state.palette.open) {
    const flat = paletteResults().flat;
    if (ev.key === 'Escape') closeModals();
    else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (!flat.length) return;
      state.palette.index = (state.palette.index + (ev.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length;
      refreshPalette();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const n = flat[state.palette.index];
      if (n) go(`#/nota/${encodeURIComponent(n.id)}`);
    }
    return;
  }

  if (state.quick.open) {
    if (ev.key === 'Escape') closeModals();
    else if (mod && ev.key === 'Enter') {
      ev.preventDefault();
      void saveQuick();
    }
    return;
  }

  if (mod && key === 's') {
    if (state.editing) {
      ev.preventDefault();
      void saveEdit();
    } else if (state.view === 'new') {
      ev.preventDefault();
      void saveDraftNote();
    }
    return;
  }

  if (t.id === 'nn-tag' && (ev.key === 'Enter' || ev.key === ',')) {
    ev.preventDefault();
    const input = t as HTMLInputElement;
    const tag = slugify(input.value.replace(/^#/, ''));
    if (input.value.trim() && !state.draftNote.tags.includes(tag)) state.draftNote.tags.push(tag);
    pendingFocus = '#nn-tag';
    render();
    return;
  }

  if (ev.key === 'Escape') {
    if (state.editing) {
      const stop = () => {
        state.editing = false;
        closeAc();
        render();
      };
      if (!editDirty()) stop();
      else void ask('¿Descartar los cambios de esta nota?', 'Descartar cambios').then((ok) => ok && stop());
    } else if (state.view !== 'notes' && !typing) {
      go(state.selectedId ? `#/nota/${encodeURIComponent(state.selectedId)}` : '#/');
    }
    return;
  }

  if (typing || mod || ev.altKey) return;

  if (state.view === 'notes') {
    if (key === 'e') {
      ev.preventDefault();
      startEdit();
      return;
    }
    if (ev.key === 'ArrowLeft') return moveInFolder(-1);
    if (ev.key === 'ArrowRight') return moveInFolder(1);
  }

  if (state.view === 'graph') {
    if (key === '1' || key === '2' || key === '0') {
      state.graph.depth = key === '0' ? 'all' : (Number(key) as Depth);
      render();
      return;
    }
    if (key === '+' || key === '=') return setZoom(state.graph.zoom + 0.15);
    if (key === '-') return setZoom(state.graph.zoom - 0.15);
    if (ev.key === 'Enter' && t.classList.contains('gnode')) {
      const id = t.getAttribute('data-id') || '';
      if (id === state.graph.focus) go(`#/nota/${encodeURIComponent(id)}`);
      else focusGraph(id);
      return;
    }
  }

  if (key === 'n') {
    ev.preventDefault();
    go('#/nueva');
  } else if (key === 'q') {
    ev.preventDefault();
    state.quick = { ...state.quick, open: true, env: state.env === 'all' ? 'gen' : state.env };
    pendingFocus = '#q-title';
    render();
  } else if (key === 'g') {
    go(state.selectedId ? `#/grafo/${encodeURIComponent(state.selectedId)}` : '#/grafo');
  } else if (key === '/') {
    ev.preventDefault();
    openPalette();
  }
});

// Ctrl+Intro en una nota abre su URL.
document.addEventListener('keydown', (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter' && state.view === 'notes' && !state.editing && !state.quick.open && !state.palette.open) {
    const n = byId(state.selectedId);
    if (n?.url) window.open(n.url, '_blank', 'noopener');
  }
});

// Arrastrar el grafo para moverse y rueda para hacer zoom.
let drag: { x: number; y: number; panX: number; panY: number } | null = null;
let dragMoved = false;

document.addEventListener('pointerdown', (ev) => {
  const svgEl = (ev.target as Element).closest('#graph-svg');
  if (!svgEl || ev.button !== 0) return;
  dragMoved = false;
  drag = { x: ev.clientX, y: ev.clientY, panX: state.graph.panX, panY: state.graph.panY };
});

document.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  const svgEl = document.getElementById('graph-svg');
  if (!svgEl) return;
  const dx = ev.clientX - drag.x;
  const dy = ev.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) dragMoved = true;
  if (!dragMoved) return;
  const scale = GRAPH_W / state.graph.zoom / Math.max(1, svgEl.clientWidth);
  state.graph.panX = drag.panX + dx * scale;
  state.graph.panY = drag.panY + dy * scale;
  svgEl.setAttribute('viewBox', viewBox());
  svgEl.classList.add('dragging');
});

document.addEventListener('pointerup', () => {
  if (!drag) return;
  drag = null;
  document.getElementById('graph-svg')?.classList.remove('dragging');
  window.setTimeout(() => (dragMoved = false), 0);
});

document.addEventListener(
  'wheel',
  (ev) => {
    if (!(ev.target as Element).closest('#graph-svg')) return;
    ev.preventDefault();
    setZoom(state.graph.zoom * (ev.deltaY < 0 ? 1.1 : 1 / 1.1));
  },
  { passive: false },
);

window.addEventListener('hashchange', onRoute);

// ---------- Arranque ----------

async function start(): Promise<void> {
  document.documentElement.dataset.theme = state.theme;
  try {
    state.notes = await store.load();
  } catch (err) {
    root.innerHTML = `<div class="boot-error">No se pudieron cargar las notas: ${e(err instanceof Error ? err.message : String(err))}</div>`;
    return;
  }
  onRoute();
}

void start();
