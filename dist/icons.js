// Iconos de trazo en SVG. Usan currentColor para seguir el tema.
const svg = (size, body, extra = '') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;
export const icon = {
    search: (s = 15) => svg(s, '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    plus: (s = 14) => svg(s, '<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.4"'),
    bolt: (s = 16) => svg(s, '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>'),
    sun: (s = 17) => svg(s, '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
    moon: (s = 17) => svg(s, '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
    graph: (s = 16) => svg(s, '<circle cx="6" cy="7" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8.3 8.2l2.6 7.5M15.9 7.6l-2.8 8.1M8.5 6.8l7-.6"/>'),
    grid: (s = 15) => svg(s, '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
    server: (s = 15) => svg(s, '<rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/><path d="M8 7h.01M8 17h.01" stroke-width="2.6"/>'),
    code: (s = 15) => svg(s, '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14"/>'),
    book: (s = 15) => svg(s, '<path d="M4 5.5C6 4.5 9 4.5 12 6.5c3-2 6-2 8-1v13c-2-1-5-1-8 1-3-2-6-2-8-1zM12 6.5v13"/>'),
    chevron: (s = 14) => svg(s, '<path d="M9 6l6 6-6 6"/>', 'stroke-width="2.2"'),
    file: (s = 13) => svg(s, '<path d="M6 3h8l4 4v14H6zM14 3v4h4"/>'),
    edit: (s = 14) => svg(s, '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>'),
    archive: (s = 14) => svg(s, '<path d="M4 8h16v11H4zM3 4h18v4H3zM10 12h4"/>'),
    pin: (s = 14) => svg(s, '<path d="M9 4h6l-1 5 3 3H7l3-3-1-5zM12 12v8"/>'),
    arrowR: (s = 14) => svg(s, '<path d="M5 12h14M13 6l6 6-6 6"/>', 'stroke-width="2"'),
    arrowL: (s = 14) => svg(s, '<path d="M19 12H5M11 6l-6 6 6 6"/>', 'stroke-width="2"'),
    external: (s = 14) => svg(s, '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    close: (s = 14) => svg(s, '<path d="M6 6l12 12M18 6L6 18"/>', 'stroke-width="2.2"'),
    clock: (s = 12) => svg(s, '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', 'stroke-width="2"'),
    check: (s = 14) => svg(s, '<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="2.4"'),
    warn: (s = 15) => svg(s, '<path d="M12 4l9 16H3zM12 10v4M12 17.5v.5"/>', 'stroke-width="2"'),
    sparkle: (s = 16) => svg(s, '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z"/>', 'stroke-width="1.6"'),
    git: (s = 14) => svg(s, '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="9" r="2.5"/><path d="M6 8.5v7M18 11.5c0 3-4 3-9.5 5"/>'),
    minus: (s = 14) => svg(s, '<path d="M5 12h14"/>', 'stroke-width="2.4"'),
    link: (s = 14) => svg(s, '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>'),
};
export function folderIcon(color, w = 18, h = 15) {
    return `<svg width="${w}" height="${h}" viewBox="0 0 24 20" aria-hidden="true"><path d="M2 4.5A2.5 2.5 0 0 1 4.5 2H9l2.2 2.4H19.5A2.5 2.5 0 0 1 22 6.9v8.6a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 15.5z" fill="${color}"/><path d="M2 7.5h20" stroke="rgba(0,0,0,0.18)" stroke-width="1.2"/></svg>`;
}
export const logo = `<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect x="3" y="2" width="11" height="9" rx="2.5" fill="#E8A33A" stroke="currentColor" stroke-width="1.3"/><rect x="16" y="2" width="11" height="9" rx="2.5" fill="#B2D491" stroke="currentColor" stroke-width="1.3"/><rect x="3" y="13" width="24" height="7" rx="2.5" fill="#D6E5F6" stroke="currentColor" stroke-width="1.3"/><rect x="3" y="22" width="24" height="6" rx="2.5" fill="#E7DDF5" stroke="currentColor" stroke-width="1.3"/></svg>`;
