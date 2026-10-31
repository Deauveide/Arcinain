# Especificación funcional — Museo Rayo, recorrido virtual 3D

Documento de referencia para implementar el proyecto por fases. El contrato con el modelo de Blender está en el [README](../README.md). Las decisiones pendientes están en [decisiones.md](decisiones.md).

## 1. Objetivo y uso

- Recorrido virtual del Museo Rayo en escritorio, celular y visor VR (Meta Quest, WebXR).
- **Uso previsto:** muestras puntuales, no un sitio público permanente.
- **Prioridad:** que funcione bien en local y pueda exponerse por túnel HTTPS durante un tiempo prolongado.
- **Secundario:** publicar solo el visor en GitHub Pages si el peso lo permite.

## 2. Compatibilidad

| Plataforma | Modo |
|---|---|
| Chrome, Edge, Firefox (escritorio) | Escritorio, y VR si hay WebXR con headset conectado |
| Safari iOS (iPhone/iPad) | Solo celular (no hay WebXR en iOS) |
| Chrome Android | Celular y VR si el dispositivo lo soporta |
| Meta Quest Browser | VR (y escritorio en el navegador del visor) |

Si no hay WebXR, el botón "Entrar en VR" no aparece.

## 3. Arquitectura

- **Visor:** estático. Lee `data/*.json` y `assets/` directamente. No depende del backend.
- **Backend:** opcional, Fastify. Sirve el visor con cabeceras correctas y añade panel, estadísticas y seguridad.
- **Túnel:** Cloudflare Tunnel expone el backend (o solo el visor) por HTTPS.

## 4. Modelo de datos

### 4.1 `data/obras.json`

```json
{
  "version": 1,
  "obras": [
    {
      "id": "OBRA_01",
      "tipo": "plano",
      "titulo": { "es": "Título de la obra" },
      "artista": { "es": "Nombre del artista" },
      "anio": 1978,
      "tecnica": { "es": "Óleo sobre tela" },
      "dimensiones": { "alto_m": 0.9, "ancho_m": 0.7, "profundidad_m": 0.03 },
      "descripcion": { "es": "Texto de ficha." },
      "creditos": "Colección Museo Rayo",
      "derechos": "© Artista, todos los derechos reservados",
      "miniatura": "assets/obras/thumbs/OBRA_01.webp",
      "web": "assets/obras/web/OBRA_01.webp",
      "full": "assets/obras/full/OBRA_01.webp",
      "nodo": "OBRA_01",
      "parada": "PARADA_01",
      "audio": null,
      "modelo3d": null
    }
  ]
}
```

Reglas:
- `id` y `nodo` coinciden con el nombre del empty en el GLB.
- `tipo`: `plano` (imagen en cara) o `escultura` (usa `modelo3d`, GLB con origen en la base).
- `dimensiones` en metros. Determinan el tamaño de la obra en la sala.
- `full` puede ser una ruta local o una URL absoluta (alojamiento externo).
- Los campos de texto son objetos por idioma. Si falta el idioma pedido, se usa `es`.

### 4.2 `data/recorrido.json`

```json
{
  "version": 1,
  "inicio": "SPAWN",
  "paradas": [
    {
      "id": "PARADA_01",
      "orden": 1,
      "titulo": { "es": "Sala de bienvenida" },
      "audio": { "ogg": "assets/audio/parada01.ogg", "mp3": "assets/audio/parada01.mp3" },
      "subtitulos": { "es": "Texto que se muestra mientras suena el audio." },
      "obra_destacada": "OBRA_01"
    }
  ],
  "kiosco": { "inactividad_s": 90, "pausa_entre_paradas_s": 5 }
}
```

Reglas:
- `paradas` define el orden del recorrido guiado. La posición de cada parada sale del nodo `PARADA_xx` del GLB.
- `audio` admite OGG y MP3 (alternativa para Safari si hace falta). Al menos uno.

### 4.3 `data/i18n/es.json`

Textos de la interfaz. Claves agrupadas por pantalla (`inicio`, `ficha`, `recorrido`, `catalogo`, `vr`, `errores`).

## 5. Nodos del GLB reconocidos

Definidos en el README (sección 2). Resumen: `SPAWN`, `OBRA_xx`, `PARADA_xx`, `COL_*`, `PISO_*`, `ZONA_*`.

## 6. Funcionalidades

### 6.1 Navegación
- **Escritorio:** WASD + ratón con *pointer lock*. Colisiones contra `COL_*`. Navegable solo con teclado (flechas y WASD).
- **Celular:** joystick virtual para moverse, arrastre para mirar. Toque sobre un `PARADA_xx` o `PISO_*` para teletransportarse.
- **VR:** teletransporte con puntero (sin movimiento continuo por defecto), giro por pasos (*snap turn*), viñeta de confort opcional, modo sentado o de pie, calibración de altura.

### 6.2 Obras e interacción
- Al acercarse (escritorio/celular) o apuntar (VR), aparece la ficha de la obra.
- Tocar la obra abre el **modo detalle**: imagen `full` con zoom y arrastre, cargada bajo demanda.
- En VR, la ficha es un panel en el espacio, anclado a la obra.

### 6.3 Recorrido guiado
- Controles: iniciar, pausar, siguiente, anterior, salir a exploración libre.
- Subtítulos activables.
- Audio ambiente suave opcional, con volumen y silencio.
- El audio se habilita tras el primer gesto del usuario (requisito de los navegadores).

### 6.4 Catálogo tipo librito
- Botón siempre visible.
- Lista de todas las obras con miniatura, buscador por título o artista y filtros simples.
- Por obra: ver ficha e imagen en detalle, o **"Ir a esta obra"** (teletransporte a su parada).
- En VR: versión simplificada, 6 obras por página.

### 6.5 Enlaces directos
- `#obra=OBRA_03` y `#parada=PARADA_02` abren directamente la obra o la parada.
- Útil para compartir y para códigos QR en una exposición física.

### 6.6 Modo kiosco
- `?kiosco=1`: recorrido en bucle, sin menús de salida.
- Vuelta al inicio tras el tiempo de inactividad de `recorrido.json`.

### 6.7 Calidad adaptativa
- Perfiles bajo, medio y alto. Selección automática y selector manual.
- Qué cambia entre perfiles: pixel ratio, tamaño de texturas `web`, distancia de dibujado.

### 6.8 Pantalla de inicio
- Título, instrucciones breves.
- Botones: **"Entrar"**, **"Entrar en VR"** (solo con WebXR), **"Recorrido guiado"**, **"Catálogo"**.
- Barra de progreso de carga.

### 6.9 Accesibilidad
- Navegación por teclado, etiquetas en botones, contraste adecuado.
- Subtítulos y respeto a `prefers-reduced-motion`.

### 6.10 Modo depuración
- `?debug=1`: FPS, triángulos, draw calls, memoria de texturas, visualización de colisiones y nodos.
- Desactiva el service worker.

## 7. Rendimiento y peso

- Presupuesto: escena < ~100 000 triángulos, pocos draw calls (fusionar mallas estáticas), un solo renderer, sin sombras ni postprocesado pesado.
- **Carga progresiva:**
  1. Sala y miniaturas.
  2. Versiones `web` de las obras cercanas.
  3. Versiones `full` solo bajo demanda.
- Si hay varias `ZONA_*`, la carga se hace por zona.
- **Mensajes claros** si falta HTTPS, si WebXR no está disponible o si falla la carga de algún asset.
- **Service worker opcional:** cachea modelo y texturas para uso sin internet durante la muestra. Versionado de caché para no servir archivos viejos.

## 8. Herramientas (`tools/`)

| Script | Función | Fase |
|---|---|---|
| `tools:sala` | Genera la sala provisional `sala.glb` con la convención de nombres | 1 |
| `tools:obras` | Genera `thumbs/`, `web/` y `full/` desde las imágenes originales con sharp, conservando el perfil de color | 2 |
| `tools:optimizar` | Optimiza el GLB con gltf-transform: Draco o Meshopt, texturas a KTX2 o WebP, limpieza | 6 |
| `tools:validar` | Valida `obras.json` y `recorrido.json`: campos obligatorios, archivos existentes, nodos presentes en el GLB | 2 (básico), 6 (completo) |

Todos los scripts se documentan en el README al implementarse.

## 9. Backend (`server/`, fase 7)

- Sirve `/viewer` con compresión, caché (`immutable` para assets con versión, `no-cache` para JSON), rangos HTTP para audio y MIME correctos (`.glb`, `.ktx2`, `.wasm`).
- **Panel de administración:**
  - Edición de `obras.json` y `recorrido.json` con formularios.
  - Subida de imágenes (genera thumbs, web y full con `tools:obras`).
  - Subida de audios.
  - Solo en localhost por defecto. Acceso remoto con autenticación.
- **Estadísticas anónimas** (D-12): visitas, obras más vistas, uso del recorrido. Sin datos personales ni cookies de seguimiento.
- **Seguridad:**
  - Validación de tipo y tamaño de archivos, nombres saneados.
  - Límites de tasa en la API pública.
  - Cabeceras de seguridad con helmet.
  - Copias de seguridad antes de cada edición (D-13).
  - Solo se expone por túnel el visor y la API pública de lectura.
- **Configuración** en `server/.env` (ejemplo en `server/.env.example`): puerto, contraseña del panel, rutas.

## 10. Ejecución y despliegue (resumen, detalle en fase 7)

- Visor en estático para pruebas locales.
- Backend con gestor de procesos que lo reinicie si cae.
- Cloudflare Tunnel con nombre para la muestra (D-10).
- Evitar la suspensión del computador durante la muestra.
- GitHub Pages solo para el visor, con sus límites (≈ 1 GB por sitio, 100 MB por archivo). Git LFS no sirve para Pages.

## 11. Fases y criterios de aceptación

Al final de cada fase, **se detiene el trabajo para que el usuario pruebe**.

### Fase 1 — Base del visor
Entregables:
- Estructura de `viewer/`, `index.html`, `importmap`, vendor de Three.js 0.186.1 con decoders.
- Pantalla de inicio con botones (VR oculto si no hay WebXR).
- Sala provisional `sala.glb` generada por `tools:sala`, con `SPAWN`, `OBRA_01`…`OBRA_05`, `PARADA_01`…`PARADA_03`, `COL_*`, `PISO_*`.
- Navegación de escritorio (WASD + ratón con colisiones) y de celular (joystick y arrastre, toque en paradas).
- Modo `?debug=1`.

Criterios: la sala carga sin errores en Chrome de escritorio y en el modo celular de DevTools; no se ven rotaciones en el suelo ni en las paredes; el modo debug muestra FPS y triángulos.

### Fase 2 — Obras, fichas y color
- `obras.json` con datos de ejemplo marcados como tales.
- Fichas y modo detalle (imagen `full` con zoom).
- Gestión de color: sRGB, `NeutralToneMapping` validado contra ninguno con carta de color, obras unlit con `toneMapped = false`.
- `tools:obras` y `tools:validar` básico.

Criterios: cada obra se ve a su tamaño según `dimensiones`; la carta de color muestra la decisión de tone mapping documentada en `decisiones.md`.

### Fase 3 — VR
- Teletransporte con puntero, snap turn, viñeta opcional, modo sentado o de pie, calibración de altura.
- Fichas como paneles en el espacio.
- Mensaje claro si WebXR no está disponible.

Criterios: funciona en el Meta Quest Browser a través de HTTPS (túnel de prueba).

### Fase 4 — Recorrido guiado y kiosco
- Recorrido con controles, subtítulos, audio ambiente, habilitación tras gesto.
- Audios de prueba para las tres paradas.
- Modo kiosco con bucle e inactividad.

Criterios: el recorrido completo se reproduce en bucle; los subtítulos coinciden con el audio.

### Fase 5 — Catálogo y enlaces directos
- Catálogo tipo librito con buscador, filtros, "Ir a esta obra" y versión VR paginada.
- `#obra=` y `#parada=`.

Criterios: cada enlace directo abre la obra o parada correcta en escritorio, celular y VR.

### Fase 6 — Escena de horneado y sala real
- Escena de prueba de horneado (README, sección 8) validada en el visor.
- Carga de `sala.glb` real sin cambios en la lógica.
- `tools:optimizar` (gltf-transform) y `tools:validar` completo.
- Calidad adaptativa y service worker.

Criterios: el checklist de exportación se cumple; el visor carga la sala real con los mismos nodos; el service worker permite uso sin internet tras la primera carga.

### Fase 7 — Backend y despliegue
- Servidor Fastify, panel de administración, estadísticas, seguridad.
- Guías completas de túnel, gestor de procesos y GitHub Pages.

Criterios: el panel solo responde en localhost por defecto; las subidas se validan; los JSON tienen copia de seguridad antes de cada edición.
