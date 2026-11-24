// Lectura y escritura de notas en Markdown, y un renderizador pequeño y propio.
// Soporta lo que hace falta en notas técnicas: títulos, párrafos, listas, tareas,
// citas (idea clave), bloques de código, código en línea, negrita, cursiva,
// enlaces externos y enlaces entre notas con [[id]] o [[id|texto]].
// Todo el texto se escapa antes de convertirse en HTML.
import { ENVS, ENV_KEYS, TYPES, TYPE_KEYS } from './types.js';
export function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
export function slugify(s) {
    const slug = s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
    return slug || 'nota';
}
// ---------- Ficheros ----------
export function parseFrontmatter(text) {
    const norm = text.replace(/\r\n/g, '\n');
    if (!norm.startsWith('---\n'))
        return { meta: {}, body: norm };
    const end = norm.indexOf('\n---', 4);
    if (end === -1)
        return { meta: {}, body: norm };
    const meta = {};
    for (const line of norm.slice(4, end).split('\n')) {
        const i = line.indexOf(':');
        if (i > 0)
            meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    const body = norm.slice(end + 4).replace(/^[^\n]*\n/, '').replace(/^\n+/, '');
    return { meta, body };
}
function parseList(v) {
    if (!v)
        return [];
    return v
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((s) => s.trim().replace(/^#/, ''))
        .filter(Boolean);
}
export function parseNote(content, fallbackId = '') {
    const { meta, body } = parseFrontmatter(content);
    let title = meta['titulo'] || '';
    let rest = body;
    const m = body.match(/^# (.+)\n?/);
    if (m) {
        title = m[1].trim();
        rest = body.slice(m[0].length).replace(/^\n+/, '');
    }
    const env = ENV_KEYS.includes(meta['entorno']) ? meta['entorno'] : 'gen';
    const type = TYPE_KEYS.includes(meta['tipo']) ? meta['tipo'] : 'quick';
    return {
        id: meta['id'] || fallbackId || slugify(title),
        title: title || 'Sin título',
        type,
        env,
        tags: parseList(meta['etiquetas']),
        pinned: meta['fijado'] === 'true',
        archived: meta['archivado'] === 'true',
        url: meta['url'] || undefined,
        updated: meta['actualizado'] || new Date().toISOString(),
        body: rest.replace(/\s+$/, ''),
    };
}
export function serializeNote(n) {
    const lines = ['---', `id: ${n.id}`, `tipo: ${n.type}`, `entorno: ${n.env}`, `etiquetas: [${n.tags.join(', ')}]`];
    if (n.pinned)
        lines.push('fijado: true');
    if (n.archived)
        lines.push('archivado: true');
    if (n.url)
        lines.push(`url: ${n.url}`);
    lines.push(`actualizado: ${n.updated}`, '---', '', `# ${n.title}`, '');
    if (n.body)
        lines.push(n.body, '');
    return lines.join('\n');
}
export function filePath(n) {
    return `${ENVS[n.env].folder}/${TYPES[n.type].folder}/${n.id}.md`;
}
// ---------- Enlaces entre notas ----------
const WIKI_RE = /\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g;
export function extractLinks(body) {
    const out = [];
    for (const m of body.matchAll(WIKI_RE)) {
        const id = m[1].trim();
        if (!out.includes(id))
            out.push(id);
    }
    return out;
}
/** Primera cita del cuerpo: se usa como "idea clave" de la nota. */
export function keyIdea(body) {
    const buf = [];
    for (const line of body.split('\n')) {
        if (line.startsWith('>'))
            buf.push(line.replace(/^>\s?/, ''));
        else if (buf.length)
            break;
    }
    return buf.join(' ').trim();
}
/** Texto plano, con los enlaces sustituidos por el nombre de la nota. */
export function plainText(md, resolve) {
    return md
        .replace(WIKI_RE, (_m, id, alias) => alias || resolve(id.trim())?.label || id.trim())
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[*`]/g, '')
        .replace(/^\s*(?:[-*]|\d+\.)\s+(?:\[[ xX]\]\s+)?/gm, '')
        .replace(/^>\s?/gm, '')
        .replace(/\s+/g, ' ')
        .trim();
}
/** Primer párrafo normal del cuerpo, en texto plano. */
export function excerpt(body, resolve, max = 120) {
    const blocks = body.split(/\n\s*\n/);
    const para = blocks.find((b) => {
        const t = b.trim();
        return t && !t.startsWith('>') && !t.startsWith('```') && !t.startsWith('#');
    });
    const text = plainText(para || '', resolve);
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
// ---------- Renderizado ----------
export function renderInline(text, resolve) {
    return text
        .split(/(`[^`\n]+`)/)
        .map((part) => {
        if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
            return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
        }
        let s = escapeHtml(part);
        s = s.replace(WIKI_RE, (_m, rawId, alias) => {
            const id = rawId.trim();
            const target = resolve(id);
            if (!target) {
                return `<span class="wl wl-missing" title="La nota «${id}» no existe todavía">${alias || id}</span>`;
            }
            const label = alias || escapeHtml(target.label);
            return `<a class="wl" href="#/nota/${encodeURIComponent(id)}" title="Abrir ${escapeHtml(target.label)}">${label}</a>`;
        });
        s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a class="ext" href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
        return s;
    })
        .join('');
}
const LIST_RE = /^\s*[-*]\s+/;
const OL_RE = /^\s*\d+\.\s+/;
const FENCE_RE = /^```/;
const HEAD_RE = /^(#{1,4})\s+(.*)$/;
function isBlockStart(line) {
    return FENCE_RE.test(line) || HEAD_RE.test(line) || line.startsWith('>') || LIST_RE.test(line) || OL_RE.test(line);
}
export function renderMarkdown(body, resolve) {
    const lines = body.replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (FENCE_RE.test(line)) {
            const lang = line.slice(3).trim();
            const code = [];
            i++;
            while (i < lines.length && !FENCE_RE.test(lines[i]))
                code.push(lines[i++]);
            i++;
            out.push(`<div class="code"><div class="code-bar"><span class="lab">${escapeHtml(lang || 'código')}</span>` +
                `<button type="button" class="btn btn-ghost btn-xs" data-action="copy-code">` +
                `<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 4H6.5A2.5 2.5 0 0 0 4 6.5V16" fill="none" stroke="currentColor" stroke-width="2"/></svg>Copiar</button></div>` +
                `<pre><code>${escapeHtml(code.join('\n'))}</code></pre></div>`);
            continue;
        }
        const head = line.match(HEAD_RE);
        if (head) {
            const level = Math.min(4, head[1].length + 1);
            out.push(`<h${level}>${renderInline(head[2], resolve)}</h${level}>`);
            i++;
            continue;
        }
        if (line.startsWith('>')) {
            const quote = [];
            while (i < lines.length && lines[i].startsWith('>'))
                quote.push(lines[i++].replace(/^>\s?/, ''));
            out.push(`<aside class="callout"><span class="callout-ico" aria-hidden="true">✦</span><div><div class="lab">Idea clave</div>` +
                `<p>${renderInline(quote.join(' '), resolve)}</p></div></aside>`);
            continue;
        }
        if (LIST_RE.test(line) || OL_RE.test(line)) {
            const ordered = OL_RE.test(line);
            const re = ordered ? OL_RE : LIST_RE;
            const items = [];
            let tasks = false;
            while (i < lines.length && re.test(lines[i])) {
                const text = lines[i].replace(re, '');
                const task = text.match(/^\[([ xX])\]\s+(.*)$/);
                if (task) {
                    tasks = true;
                    const done = task[1] !== ' ';
                    items.push(`<li class="task${done ? ' done' : ''}"><span class="box" aria-hidden="true">${done ? '✓' : ''}</span>` +
                        `<span>${renderInline(task[2], resolve)}</span></li>`);
                }
                else {
                    items.push(`<li>${renderInline(text, resolve)}</li>`);
                }
                i++;
            }
            const tag = ordered ? 'ol' : 'ul';
            out.push(`<${tag}${tasks ? ' class="tasks"' : ''}>${items.join('')}</${tag}>`);
            continue;
        }
        if (!line.trim()) {
            i++;
            continue;
        }
        const para = [];
        while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i]))
            para.push(lines[i++]);
        out.push(`<p>${renderInline(para.join(' '), resolve)}</p>`);
    }
    return out.join('\n');
}
