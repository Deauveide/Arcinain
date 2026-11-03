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

- **Contenido:** carpeta `contenido/` (fichas, módulos, recorrido, imágenes y audios de trabajo). Es la fuente de verdad; se edita a mano o, en la fase 7, desde el panel.
- **Visor:** estático. Lee `data/*.json` y `assets/` directamente (generados desde `contenido/` por `tools:obras`). No depende del backend.
- **Backend:** opcional, Fastify. Sirve el visor con cabeceras correctas y añade panel, estadísticas y seguridad.
- **Túnel:** Cloudflare Tunnel expone el backend (o solo el visor) por HTTPS.

## 4. Contenido y modelo de datos

El museo tiene **varios módulos** (hoy previstos: 3; el diseño no fija un tope). Todos viven en **un solo `sala.glb`**; cada módulo es una zona `ZONA_moduloN` dentro de ese archivo (D-27). Los textos, imágenes y audios se escriben en la carpeta `contenido/`, que es la **fuente de verdad** (D-28). El visor nunca lee `contenido/`: lee los JSON y los assets que `tools:obras` genera en `viewer/`.

### 4.1 Carpeta `contenido/`

```
contenido/
  museo.md                  nombre del museo, texto de bienvenida, ajustes del kiosco
  recorrido.md              orden del recorrido guiado (ver 4.4)
  modulo1/
    modulo.md               título e introducción escrita del módulo (ver 4.3)
    intro.ogg  (+ intro.mp3)   narración del módulo (opcional)
    OBRA_01/
      ficha.md              datos y descripción de la obra (ver 4.2)
      imagen.jpg|png|tif    versión liviana de la obra (ver nota sobre originales)
      audio.ogg (+ audio.mp3)  audio de la obra (opcional)
      modelo.glb            solo esculturas (opcional)
    OBRA_02/ …
  modulo2/ …
  modulo3/ …
```

**Cómo agregar, modificar y quitar** (sin tocar código):

| Acción | Pasos |
|---|---|
| Agregar una obra | 1) En Blender, colocar `OBRA_xx` y `PARADA_xx` dentro de la zona del módulo. 2) Copiar una carpeta `OBRA_xx` existente dentro de `contenido/moduloN/` y renombrarla. 3) Llenar `ficha.md` y reemplazar `imagen`. 4) `npm run tools:obras`. 5) `npm run tools:validar`. |
| Modificar una obra | Editar `ficha.md` o reemplazar `imagen`/`audio`. Volver a ejecutar `tools:obras`. |
| Quitar una obra | Borrar su carpeta (y su línea en `recorrido.md`, si estaba). Volver a ejecutar `tools:obras`. El nodo en Blender puede quedarse; `tools:validar` avisa que no tiene carpeta. |
| Mover una obra de módulo | Moverla en Blender a la otra zona y mover su carpeta. El ID no cambia. |
| Agregar un módulo | Crear `contenido/moduloN/` con su `modulo.md`, y en Blender la zona `ZONA_moduloN` y el punto `PARADA_moduloN`. |
| Cambiar el orden del tour | Mover líneas en `recorrido.md`. No se renombra nada. |

**Originales pesados (regla 3).** Los TIFF/PSD/RAW originales no entran al repositorio: quedan en `Museo-originales/`. La `imagen` de cada carpeta es una versión de trabajo (JPG/PNG de buena calidad, sin límite estricto de lado largo, ver D-29); `tools:obras` genera de ella `thumbs/`, `web/` y `full/` conservando el perfil de color.

**Idiomas.** Hoy solo `es` (D-19). Para sumar un idioma después se añaden archivos con sufijo (`ficha.en.md`, `modulo.en.md`, `intro.en.ogg`); si falta, el visor usa el español.

### 4.2 `ficha.md` (una por obra)

Datos en el encabezado (entre `---`) y descripción como texto libre debajo:

```
---
titulo: Título de la obra
artista: Nombre del artista
anio: 1978
tecnica: Óleo sobre tela
alto_m: 0.90
ancho_m: 0.70
profundidad_m: 0.03
creditos: Colección Museo Rayo
derechos: © Artista, todos los derechos reservados
tipo: plano
---
Texto de la ficha, en párrafos normales. No hay que cuidar comillas ni comas.
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `titulo`, `artista`, `anio`, `tecnica` | Sí | Texto. `anio` es un número. |
| `alto_m`, `ancho_m` | Sí | Metros. Determinan el tamaño de la obra en la sala. |
| `profundidad_m` | No | Metros. Por defecto 0,03. |
| `creditos`, `derechos` | No | Texto. |
| `tipo` | No | `plano` (por defecto) o `escultura`. Una escultura exige `modelo.glb` (origen en la base). |
| Descripción | No | Todo el texto bajo el encabezado. |

Reglas:
- El **ID** de la obra es el nombre de su carpeta (`OBRA_07`) y coincide con el nodo del GLB. Es estable: no cambia aunque la obra cambie de módulo ni de orden.
- Un archivo presente se activa solo: si existe `audio.ogg`, la ficha muestra "Escuchar"; si existe `modelo.glb`, se usa. No hay que declararlos en la ficha.
- Un `plano` exige `imagen`. Un dato obligatorio ausente detiene el script con un mensaje en español, por ejemplo: `OBRA_03: falta "alto_m" en ficha.md`.
- Los datos de ejemplo deben llevar `EJEMPLO` en el título, y `tools:validar` los lista para no olvidarlos.

### 4.3 `modulo.md` y `museo.md`

`modulo.md`: encabezado con `titulo`; el texto debajo es la **introducción escrita** del módulo, que se muestra como subtítulo mientras suena `intro.ogg`.

`museo.md`: encabezado con `nombre`, `inicio_modulo` (módulo donde aparece el visitante, por defecto el primero), `kiosco_inactividad_s` (90), `pausa_entre_paradas_s` (5) y `pausa_sin_audio_s` (8); el texto debajo es la bienvenida de la pantalla de inicio.

### 4.4 `recorrido.md`

Una línea por parada, en orden. `modulo1` es la parada de introducción de ese módulo; `OBRA_03` es la parada de esa obra. Se ignoran las líneas vacías y las que empiezan con `#`.

```
# Recorrido completo
modulo1
OBRA_01
OBRA_03
modulo2
OBRA_07
```

- Las obras que no aparecen en la lista siguen visibles en el museo y en el catálogo, pero no entran al recorrido.
- **"Recorrer solo este módulo"** toma, de esta lista, la línea del módulo y las obras que le pertenecen.
- Cada parada reutiliza los audios que ya existen (`intro.ogg` del módulo, `audio.ogg` de la obra). No hay grabaciones aparte para el tour.
- `tools:validar` avisa si una línea nombra un módulo u obra inexistente.

### 4.5 Datos generados (no se editan a mano)

`tools:obras` lee `contenido/`, valida y escribe en `viewer/`:

- `data/obras.json`: una entrada por obra, con `id`, `modulo`, `tipo`, textos por idioma (`titulo`, `artista`, `tecnica`, `descripcion`), `anio`, `dimensiones` (`alto_m`, `ancho_m`, `profundidad_m`), `creditos`, `derechos`, rutas `miniatura`/`web`/`full`, `audio`, `modelo3d`, `nodo` (`OBRA_xx`) y `parada` (`PARADA_xx`, el mismo número).
- `data/modulos.json`: `id` (`modulo1`), `zona` (`ZONA_modulo1`), `parada` (`PARADA_modulo1`), título, introducción escrita, `audio`.
- `data/recorrido.json`: la lista de `recorrido.md` resuelta (cada parada con su tipo, referencia, nodo de destino y audio) más los ajustes de `museo.md`.
- `assets/obras/{thumbs,web,full}/`, `assets/audio/` y `assets/obras/modelos/`: copias derivadas.

Todos llevan `"version": 2` y un aviso de que son generados. El campo `full` puede ser una URL absoluta si se aloja fuera.

### 4.6 `data/i18n/es.json`

Textos de la interfaz. Claves agrupadas por pantalla (`inicio`, `ficha`, `recorrido`, `modulo`, `catalogo`, `vr`, `errores`).

## 5. Nodos del GLB reconocidos

Definidos en el README (sección 2). Resumen: `SPAWN`, `OBRA_xx`, `PARADA_xx`, `ZONA_moduloN`, `PARADA_moduloN`, `COL_*`, `PISO_*`.

- Una obra **pertenece al módulo cuya zona contiene su `OBRA_xx`**. `tools:validar` comprueba que la carpeta `contenido/moduloN/OBRA_xx/` coincida con esa zona.
- `PARADA_xx` va emparejada por número con `OBRA_xx` (punto desde donde se ve la obra).
- `PARADA_moduloN` es el punto donde el tour deja al visitante para la introducción de cada módulo.
- `ZONA_moduloN` es un volumen (caja) que cubre el espacio navegable del módulo. Su proyección en planta decide si el visitante está dentro.

## 6. Funcionalidades

### 6.1 Navegación
- **Escritorio:** WASD + ratón con *pointer lock*. Colisiones contra `COL_*`. Navegable solo con teclado (flechas y WASD).
- **Celular:** joystick virtual para moverse, arrastre para mirar. Toque sobre un `PARADA_xx` o `PISO_*` para teletransportarse.
- **VR:** teletransporte con puntero (sin movimiento continuo por defecto), giro por pasos (*snap turn*), viñeta de confort opcional, modo sentado o de pie, calibración de altura.

### 6.2 Obras e interacción
- Al acercarse (escritorio/celular) o apuntar (VR), aparece la ficha de la obra.
- Tocar la obra abre el **modo detalle**: imagen `full` con zoom y arrastre, cargada bajo demanda.
- En VR, la ficha es un panel en el espacio, anclado a la obra.
- Si la obra tiene `audio`, la ficha muestra el botón **"Escuchar"**. El audio de una obra **solo suena cuando el visitante lo pide** (D-31).

### 6.3 Narración y recorrido guiado

**Narración de módulo en exploración libre (D-30).** Cada módulo tiene una narración (`intro.ogg`) ligada a su `ZONA_moduloN`:
1. Al entrar por primera vez, suena sola.
2. Al salir, baja con un fundido corto (≈ 0,8 s). La posición que se guarda es la del instante **justo antes de que empiece el fundido**, para no perder lo último que se oyó.
3. Al volver a entrar, **continúa desde la posición guardada** hasta que termine.
4. Una vez terminada, no se repite sola.
5. Un **botón en pantalla** (control fijo de la interfaz, visible en escritorio, celular y VR) la reproduce de nuevo desde el inicio.
6. Estado por módulo durante la visita: `pendiente` → `en curso (posición)` → `terminada`. Solo vive en memoria; no se guarda nada permanente en el dispositivo.
7. Para evitar parpadeos en el borde de una zona, la salida se confirma tras unos 0,5 m fuera del volumen.
8. Si suena el audio de una obra (6.2) mientras corre la narración del módulo, esta se pausa y se reanuda cuando termine la de la obra.
9. El audio se habilita tras el primer gesto del usuario (requisito de los navegadores); el botón de inicio ya cuenta.

**Recorrido guiado (D-32).** Es **uno solo y continuo** por todos los módulos, definido en `recorrido.md` (4.4), y puede empezar desde cualquier módulo ("Recorrer solo este módulo"):
- Parada de módulo: teletransporte a `PARADA_moduloN`, subtítulos con la introducción escrita y narración `intro.ogg` desde el inicio (en el tour no se reanuda; al terminar el módulo queda como `terminada`).
- Parada de obra: teletransporte a `PARADA_xx`, ficha visible y, si existe, su `audio` (aquí sí suena sin pedirlo, porque el visitante eligió el tour).
- Se avanza al terminar el audio más `pausa_entre_paradas_s`; si la parada no tiene audio, tras `pausa_sin_audio_s`.
- Durante el tour las narraciones por zona están desactivadas: el tour las dirige. Al salir del tour vuelve la exploración libre y el estado de los módulos se conserva.
- Controles: iniciar, pausar, siguiente, anterior, salir a exploración libre.
- Subtítulos activables.
- Audio ambiente suave opcional, con volumen y silencio.

### 6.4 Catálogo tipo librito
- Botón siempre visible.
- Lista de todas las obras con miniatura, buscador por título o artista y filtros simples.
- Por obra: ver ficha e imagen en detalle, o **"Ir a esta obra"** (teletransporte a su parada).
- En VR: versión simplificada, 6 obras por página.

### 6.5 Enlaces directos
- `#obra=OBRA_03`, `#parada=PARADA_02` y `#modulo=modulo2` abren directamente la obra, la parada o el módulo.
- Útil para compartir y para códigos QR en una exposición física.

### 6.6 Modo kiosco
- `?kiosco=1`: recorrido en bucle, sin menús de salida.
- Vuelta al inicio tras `kiosco_inactividad_s` (definido en `museo.md`).

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
- Todos los módulos van en un solo `sala.glb`, así que **el peso del GLB crece con cada módulo**. Presupuesto de triángulos por módulo: (total ≈ 100 000) / nº de módulos, a revisar cuando exista la geometría. La carga de **imágenes y audios** sí es por módulo: las versiones `web` y los audios de un módulo se piden al acercarse a él.
- **Mensajes claros** si falta HTTPS, si WebXR no está disponible o si falla la carga de algún asset.
- **Service worker opcional:** cachea modelo y texturas para uso sin internet durante la muestra. Versionado de caché para no servir archivos viejos.

## 8. Herramientas (`tools/`)

| Script | Función | Fase |
|---|---|---|
| `tools:sala` | Genera la sala provisional `sala.glb` con la convención de nombres | 1 |
| `tools:obras` | Lee `contenido/`, valida las fichas, genera `obras.json`, `modulos.json` y `recorrido.json`, copia audios y modelos, y crea `thumbs/`, `web/` y `full/` con sharp conservando el perfil de color | 2 |
| `tools:optimizar` | Optimiza el GLB con gltf-transform: Draco o Meshopt, texturas a KTX2 o WebP, limpieza | 6 |
| `tools:validar` | Cruza `contenido/` con el GLB. Avisa de: obra sin nodo `OBRA_xx`/`PARADA_xx` en Blender; nodo sin carpeta; carpeta cuyo módulo no coincide con la zona; módulo sin `ZONA_`/`PARADA_modulo`; línea de `recorrido.md` inexistente; audios o imágenes faltantes; fichas de ejemplo pendientes. Mensajes en español, con el ID de la obra | 2 (básico), 6 (completo) |

Todos los scripts se documentan en el README al implementarse. `docs/obras-tabla.csv` queda reemplazado por las fichas de `contenido/` (D-28, D-29); se borra al implementar la fase 2.

## 9. Backend (`server/`, fase 7)

- Sirve `/viewer` con compresión, caché (`immutable` para assets con versión, `no-cache` para JSON), rangos HTTP para audio y MIME correctos (`.glb`, `.ktx2`, `.wasm`).
- **Panel de administración:**
  - Edición de fichas, módulos y `recorrido.md` con formularios; escribe en `contenido/` y ejecuta `tools:obras` (la fuente de verdad sigue siendo `contenido/`).
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

## 10.1 Flujo de trabajo con Blender

- **Archivos fuente:** los `.blend` de trabajo viven en `blender/` dentro del proyecto (ej.: `blender/Modulo museo.blend`).
- **Qué se versiona:** solo el GLB que usa el visor, `viewer/assets/models/sala.glb`. Los `.blend` y los `.glb` de trabajo dentro de `blender/` están ignorados por Git.
- **Dónde trabajar:** el modelado y las exportaciones con el MCP de Blender se hacen desde esta sesión de Claude Code, no desde chats separados.
- **Referencias:** capturas, planos y medidas de referencia van a una carpeta de referencias que el usuario creará cuando la necesite. Hasta entonces no existe.
- **Exportación:** cada exportación para el visor sigue la sección 6 del README (glTF Binary, +Y Up, sin Draco ni Meshopt) y se escribe en `viewer/assets/models/sala.glb`.

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
- Estructura `contenido/` (sección 4) con 3 módulos de ejemplo y obras de ejemplo marcadas como tales.
- `tools:obras` (lee `contenido/`, genera los JSON y los derivados) y `tools:validar` básico.
- El visor lee `obras.json`, `modulos.json` y `recorrido.json`.
- Fichas y modo detalle (imagen `full` con zoom), con el botón "Escuchar" cuando hay audio.
- Gestión de color: sRGB, `NeutralToneMapping` validado contra ninguno con carta de color, obras unlit con `toneMapped = false`.

Criterios: agregar una obra copiando una carpeta, llenando `ficha.md` y ejecutando `tools:obras` la hace aparecer en la sala sin tocar código; cada obra se ve a su tamaño según `alto_m` y `ancho_m`; la carta de color muestra la decisión de tone mapping documentada en `decisiones.md`.

### Fase 3 — VR
- Teletransporte con puntero, snap turn, viñeta opcional, modo sentado o de pie, calibración de altura.
- Fichas como paneles en el espacio.
- Mensaje claro si WebXR no está disponible.

Criterios: funciona en el Meta Quest Browser a través de HTTPS (túnel de prueba).

### Fase 4 — Recorrido guiado y kiosco
- Detección de zona `ZONA_moduloN` y narración de módulo con fundido, reanudación, estado `pendiente/en curso/terminada` y botón de repetir (6.3).
- Recorrido continuo desde `recorrido.md`, con "Recorrer solo este módulo", controles, subtítulos, audio ambiente y habilitación tras gesto.
- Audios de prueba para cada módulo y obra de ejemplo.
- Modo kiosco con bucle e inactividad.

Criterios: salir de un módulo a mitad de la narración y volver continúa desde donde se cortó; tras terminar no se repite sola y el botón la reproduce desde el inicio; el recorrido completo se reproduce en bucle; los subtítulos coinciden con el audio.

### Fase 5 — Catálogo y enlaces directos
- Catálogo tipo librito con buscador, filtros, "Ir a esta obra" y versión VR paginada.
- `#obra=`, `#parada=` y `#modulo=`.
- El catálogo agrupa y filtra por módulo.

Criterios: cada enlace directo abre la obra, parada o módulo correcto en escritorio, celular y VR.

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
