# Mi Base

Base de conocimiento personal con notas en Markdown enlazadas entre sí (método Zettelkasten).
Hecha solo con TypeScript, HTML y CSS: **sin dependencias de terceros** en tiempo de ejecución.

## Probarla

Las notas de prueba se guardan en el `localStorage` del navegador, así que no hace falta servidor de API.
Solo hay que servir la carpeta por HTTP (los módulos ES no cargan desde `file://`):

```bash
# cualquiera de estas vale
npx --yes http-server .          # si tienes Node
python -m http.server 8080       # si tienes Python
```

Abre `http://localhost:8080`. El botón «Restablecer datos» (abajo a la izquierda) vuelve a los datos de prueba.

## Compilar

`dist/` ya viene compilado. Si cambias algo en `src/`:

```bash
npm install -g typescript   # solo hace falta en tu máquina, no en el contenedor
tsc -p .
```

## Estructura

| Fichero | Qué hace |
| --- | --- |
| `index.html` | Página única. Carga `styles.css` y `dist/app.js`. |
| `styles.css` | Temas oscuro y claro con variables CSS. |
| `src/types.ts` | Tipos (`Note`, entornos, carpetas) y catálogos de colores y nombres. |
| `src/data.ts` | 15 notas de prueba escritas como ficheros Markdown. |
| `src/markdown.ts` | Leer y escribir ficheros con cabecera, renderizador Markdown propio y enlaces `[[id]]`. |
| `src/store.ts` | Interfaz `NoteStore`, `LocalStore` (pruebas) y `HttpStore` (ejemplo para tu servidor). |
| `src/graph.ts` | Colocación del grafo por fuerzas, determinista y sin solapes. |
| `src/icons.ts` | Iconos SVG de trazo. |
| `src/app.ts` | Estado, rutas, vistas, eventos, búsqueda, autocompletado y grafo. |

## Formato de una nota

```markdown
---
id: pay-1482
tipo: ticket            # ticket | link | config | glossary | knowledge | quick
entorno: prod           # prod | dev | gen
etiquetas: [pagos, sqs]
fijado: true            # opcional
archivado: true         # opcional
url: https://…          # opcional, para tickets y enlaces
actualizado: 2026-11-24T08:12:00.000Z
---

# PAY-1482 · Pagos duplicados tras timeout

> La primera cita es la idea clave de la nota.

Texto libre con enlaces a otras notas: [[idempotencia]] o [[idempotencia|con otro texto]].
```

Ruta en disco: `{entorno}/{carpeta}/{id}.md`, por ejemplo `prod/tickets/pay-1482.md`.

## Conectarla a tu servidor

En `src/app.ts` cambia una línea:

```ts
const store: NoteStore = new HttpStore('/api');
```

`HttpStore` espera dos rutas:

- `GET /api/notes` → `[{ "path": "prod/tickets/pay-1482.md", "content": "---\n…" }]`
- `PUT /api/notes/{path}` → cuerpo: el fichero Markdown completo

Los enlaces inversos y el grafo se calculan en el navegador leyendo los `[[ ]]` de todos los ficheros,
así que el servidor solo tiene que leer y escribir ficheros.

## Atajos

| Tecla | Acción |
| --- | --- |
| `Ctrl K` o `/` | Buscar (título, id, `#etiqueta` o texto) |
| `N` | Nueva nota |
| `Q` | Nota rápida |
| `E` | Editar la nota abierta |
| `Ctrl S` | Guardar |
| `Esc` | Cancelar o volver |
| `←` `→` | Nota anterior o siguiente de la carpeta |
| `G` | Grafo centrado en la nota abierta |
| `Ctrl Intro` | Abrir la URL del ticket o enlace |
| `[[` | Al escribir, elegir una nota para enlazar |
| En el grafo: `1` `2` `0`, `+` `−` | Profundidad y zoom |

## Seguridad

- Todo el texto de las notas se escapa antes de mostrarse; no se ejecuta HTML de las notas.
- Los enlaces externos solo admiten `http` y `https`, y se abren con `rel="noopener noreferrer"`.
- No carga nada de internet: ni fuentes, ni scripts, ni CDN. La fuente es la monoespaciada del sistema
  (JetBrains Mono si la tienes instalada; si no, Cascadia o Consolas en Windows).
