// Colocación de las notas en el grafo con un algoritmo de fuerzas sencillo
// (Fruchterman-Reingold) y una pasada final que evita que las etiquetas se pisen.
// Es determinista: las mismas notas y enlaces dan siempre el mismo dibujo.
export function layoutGraph(ids, edges, widths, width, height) {
    const pos = {};
    const n = ids.length;
    if (n === 0)
        return pos;
    const sorted = [...ids].sort();
    sorted.forEach((id, i) => {
        const a = (i / n) * Math.PI * 2;
        pos[id] = { x: width / 2 + Math.cos(a) * width * 0.3, y: height / 2 + Math.sin(a) * height * 0.3 };
    });
    const k = Math.sqrt((width * height) / n) * 0.75;
    let temp = width / 8;
    for (let iter = 0; iter < 420; iter++) {
        const disp = {};
        for (const id of sorted)
            disp[id] = { x: 0, y: 0 };
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const a = sorted[i];
                const b = sorted[j];
                let dx = pos[a].x - pos[b].x;
                let dy = pos[a].y - pos[b].y;
                let d = Math.sqrt(dx * dx + dy * dy);
                if (d < 0.01) {
                    dx = 0.1;
                    dy = 0.1;
                    d = 0.14;
                }
                const f = (k * k) / d;
                disp[a].x += (dx / d) * f;
                disp[a].y += (dy / d) * f;
                disp[b].x -= (dx / d) * f;
                disp[b].y -= (dy / d) * f;
            }
        }
        for (const [a, b] of edges) {
            if (!pos[a] || !pos[b])
                continue;
            const dx = pos[a].x - pos[b].x;
            const dy = pos[a].y - pos[b].y;
            const d = Math.max(0.01, Math.sqrt(dx * dx + dy * dy));
            const f = (d * d) / k;
            disp[a].x -= (dx / d) * f;
            disp[a].y -= (dy / d) * f;
            disp[b].x += (dx / d) * f;
            disp[b].y += (dy / d) * f;
        }
        for (const id of sorted) {
            // Una gravedad suave hacia el centro evita que las notas sueltas se vayan lejos.
            disp[id].x += (width / 2 - pos[id].x) * 0.02 * k / 10;
            disp[id].y += (height / 2 - pos[id].y) * 0.02 * k / 10;
            const d = Math.max(0.01, Math.sqrt(disp[id].x ** 2 + disp[id].y ** 2));
            pos[id].x += (disp[id].x / d) * Math.min(d, temp);
            pos[id].y += (disp[id].y / d) * Math.min(d, temp);
        }
        temp = Math.max(1, temp * 0.985);
    }
    // Estirar los centros para ocupar todo el área, dejando sitio a la etiqueta más ancha.
    const pad = 24;
    const boxH = 34;
    const maxHalfW = Math.max(...sorted.map((id) => widths[id] / 2));
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const id of sorted) {
        minX = Math.min(minX, pos[id].x);
        maxX = Math.max(maxX, pos[id].x);
        minY = Math.min(minY, pos[id].y);
        maxY = Math.max(maxY, pos[id].y);
    }
    const availW = width - 2 * (pad + maxHalfW);
    const availH = height - 2 * pad - boxH;
    const sx = availW / Math.max(1, maxX - minX);
    const sy = availH / Math.max(1, maxY - minY);
    for (const id of sorted) {
        pos[id] = {
            x: pad + maxHalfW + (pos[id].x - minX) * sx,
            y: pad + boxH / 2 + (pos[id].y - minY) * sy,
        };
    }
    // Separar cajas que se solapan (las etiquetas son más anchas que altas), sin salirse del área.
    const clamp = (id) => {
        const hw = widths[id] / 2;
        pos[id].x = Math.min(width - pad - hw, Math.max(pad + hw, pos[id].x));
        pos[id].y = Math.min(height - pad - boxH / 2, Math.max(pad + boxH / 2, pos[id].y));
    };
    for (let pass = 0; pass < 200; pass++) {
        let moved = false;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const a = sorted[i];
                const b = sorted[j];
                const overlapX = (widths[a] + widths[b]) / 2 + 22 - Math.abs(pos[a].x - pos[b].x);
                const overlapY = boxH + 16 - Math.abs(pos[a].y - pos[b].y);
                if (overlapX > 0 && overlapY > 0) {
                    moved = true;
                    if (overlapY < overlapX) {
                        const s = pos[a].y < pos[b].y ? -1 : pos[a].y > pos[b].y ? 1 : i % 2 ? 1 : -1;
                        pos[a].y += (s * overlapY) / 2 + s;
                        pos[b].y -= (s * overlapY) / 2 + s;
                    }
                    else {
                        const s = pos[a].x < pos[b].x ? -1 : 1;
                        pos[a].x += (s * overlapX) / 2 + s;
                        pos[b].x -= (s * overlapX) / 2 + s;
                    }
                    clamp(a);
                    clamp(b);
                }
            }
        }
        if (!moved)
            break;
    }
    for (const id of sorted)
        pos[id] = { x: Math.round(pos[id].x), y: Math.round(pos[id].y) };
    return pos;
}
