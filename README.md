# Museo Rayo — Recorrido virtual 3D

Recorrido virtual en 3D del Museo Rayo de Roldanillo (Valle del Cauca). Funciona en escritorio, celular y visor VR (Meta Quest, WebXR).

> **Estado:** Fase 0 — especificación. Ver [`docs/especificacion.md`](docs/especificacion.md) y [`docs/decisiones.md`](docs/decisiones.md).

## Partes del proyecto

| Parte | Carpeta | Depende del backend |
|---|---|---|
| Visor (Three.js, estático) | `viewer/` | No. Lee JSON y assets directamente. Puede publicarse en cualquier hosting estático. |
| Backend opcional (Fastify) | `server/` | Es opcional. Sirve el visor con cabeceras correctas y añade panel de administración y estadísticas. |
| Herramientas de assets | `tools/` | No. Scripts Node para optimizar, derivar imágenes y validar datos. |

## Requisitos

- Node.js 22 o superior (verificado localmente con Node 24).
- **Blender** en su versión LTS vigente (la guía se escribe para Blender 5.2 LTS; verificar la instalada).
- Navegador moderno. Para VR: Meta Quest Browser, Chrome o Edge con HTTPS.
- Para exponer el proyecto fuera de la red local: [`cloudflared`](https://github.com/cloudflare/cloudflared).

## Estructura

```
viewer/
  index.html
  css/styles.css
  js/main.js         arranque, detección de dispositivo, modo y calidad
  js/scene.js        carga del GLB, materiales, color, lightmaps
  js/navigation.js   escritorio, táctil, VR
  js/interaction.js  puntos de interés, fichas, modo detalle
  js/audio.js        voz en off, ambiente, subtítulos
  js/catalog.js      catálogo tipo librito
  js/xr.js           WebXR, teletransporte, confort
  js/router.js       enlaces directos por URL
  js/i18n.js         textos de la interfaz
  data/obras.json
  data/recorrido.json
  data/i18n/es.json
  assets/models/     sala.glb (y proxies de colisión si se separan)
  assets/obras/thumbs/ | web/ | full/
  assets/audio/
  vendor/            librerías con versión fija
server/              backend opcional (fase 7)
tools/               scripts de optimización y validación
docs/                especificación y decisiones
```

### Comandos (fase 1)

```bash
npm install            # instala @gltf-transform/core (solo para tools/)
npm run tools:sala     # regenera viewer/assets/models/sala.glb (sala provisional)
npm run viewer         # sirve viewer/ en http://localhost:8080
```

Parámetros del visor (en la URL):

| Parámetro | Efecto |
|---|---|
| `?debug=1` | Panel de FPS, triángulos, draw calls y texturas; casillas para ver colisiones y marcadores. Expone `window.__visor` para inspección desde la consola. |
| `?calidad=bajo\|medio\|alto` | Fuerza el perfil de calidad (por defecto: `alto` en escritorio, `medio` en celular). |

**Celular en la red local:** `npm run viewer` muestra la IP local. Ese acceso no usa HTTPS, así que la VR no estará disponible (ver "Ejecución y exposición").

---

## Contrato con el modelo de Blender

Esta sección es el contrato entre el modelado en Blender y el código. Si algo aquí cambia, cambia también el código que lo lee.

### 1. Unidades y ejes

- **Unidades:** metros, escala 1:1. En Blender: *Scene Properties → Units* → System: Metric, Unit Scale: 1.0, Length: Meters.
- **Eje vertical:** Blender trabaja en Z-up. El exportador glTF convierte a Y-up si está activada la opción **+Y Up** (en *Transform*, activada por defecto). No se gira nada a mano.
- **Verificación obligatoria:** en la escena de prueba (sección 8), el suelo debe quedar horizontal y las paredes verticales en el visor. Si algo sale rotado, no se corrige en el código: se corrige la exportación.
- **Convención de dirección:** en Blender, el eje **+Y local** de los empties `SPAWN`, `OBRA_xx` y `PARADA_xx` indica la dirección de vista (ver sección 3). El exportador lo convierte a **−Z** de glTF, que es el "adelante" de Three.js.

### 2. Nombres de nodos reconocidos

Los nombres son sensibles a mayúsculas y no pueden repetirse. Sin espacios, sin tildes y **sin sufijos automáticos de Blender** (`.001`, `.002`): si Blender los añade, renombrar el objeto.

| Nombre | Tipo en Blender | Función |
|---|---|---|
| `SPAWN` | Empty (Plain Axes) | Punto de inicio de la visita. Su +Y local define el frente inicial. |
| `OBRA_01`, `OBRA_02`… | Empty (Plain Axes) (recomendado) o plano | Posición y orientación de cada obra. |
| `PARADA_01`, `PARADA_02`… | Empty (Plain Axes) | Puntos de teletransporte y paradas del recorrido guiado. |
| `COL_*` | Malla simple | Colisiones. Se ocultan en el visor. Ej.: `COL_muro_norte`. |
| `PISO_*` | Malla | Superficies caminables y destino de teletransporte. Ej.: `PISO_sala1`. |
| `ZONA_*` | Colección o empty padre (opcional) | Agrupación por sala para carga progresiva. Ej.: `ZONA_01`. |

Cualquier otro objeto se exporta y se renderiza como parte de la arquitectura. No hace falta nombrar nada más.

**Colecciones:** Blender exporta los objetos por nombre, no por colección. Las colecciones sirven para organizar la escena, pero el visor no las lee. Los `ZONA_*` sí deben existir como objeto (empty padre) si se quiere carga por zona.

### 3. Obras: cómo se colocan

- El **empty `OBRA_xx`** define **posición** y **orientación**. Su **+Y local** apunta hacia el interior de la sala (hacia donde se para el visitante para mirar la obra).
- La **cara frontal** de la obra es la que mira hacia ese lado.
- El **tamaño** no sale del empty: sale de `dimensiones` en `obras.json`, en metros. Así la obra siempre tiene su medida real aunque el empty tenga escala distinta de 1.
- La **escala del nodo `OBRA_xx` se ignora** por diseño. No aplicar escalas a los empties.
- Para obras tridimensionales (esculturas): el objeto puede tener un GLB propio referenciado en `obras.json` (`modelo3d`). Su origen debe estar en la base.

### 4. Luz horneada (lightmaps)

Se usa **un solo mapa de luz por sala o zona**, de **1024 a 2048 px**. El horneado se hace con **Cycles → Bake**.

**Recomendación: horneado en el color base (camino A).**

- En Blender se hornea la iluminación completa (*Bake Type: Combined*) en una imagen, y esa imagen se conecta como color base del material.
- El visor trata las mallas de arquitectura como **sin iluminación** (`MeshBasicMaterial`): la textura ya contiene la luz. No depende de que el exportador conserve un tipo de material especial.
- En el motor no hay luces que calcular para la arquitectura.
- Funciona igual en escritorio, celular y Quest.
- Coste: no hay iluminación dinámica sobre la arquitectura. Para el museo eso es aceptable.

**Alternativa (camino B): lightmap como oclusión (UV2).** Solo si se necesita ambiente oclusivo sobre materiales con luz real. Requiere un segundo UV map (UV2) en Blender, horneado en esa UV, y el exportador lo escribe como `TEXCOORD_1`; el mapa va en el canal de oclusión (`occlusionTexture` con `texCoord = 1`). Es más costoso en el visor y no se recomienda como primera opción.

**No se usa** el camino de "lightmap aparte aplicado por código" (camino C): glTF no tiene ese campo, el exportador lo descartaría y obligaría a un mapeo manual por nombres de archivo.

**Reglas comunes a los dos caminos:**
- **UV1** para texturas de color, sin solapes raros, sin estiramientos.
- **UV2** (solo para B) sin solapes, en isla por pieza. Blender lo hornea activando ese UV map como *Active Render* antes del Bake.
- **Sin sombras en tiempo real** en la escena. Luces dinámicas: ninguna para la arquitectura; como mucho una luz ambiental para esculturas.

### 5. Colisiones y pisos

- Los `COL_*` son mallas simples (cajas o planos). Se exportan **visibles** en el viewport de Blender; el visor los oculta y los usa para colisiones.
- Los `PISO_*` son las superficies caminables. Se exportan visibles; el visor las usa para el teletransporte.
- **Opción de archivo separado:** los proxies de colisión pueden ir en `assets/models/colisiones.glb`. Por defecto van dentro de `sala.glb` para tener un solo archivo.

### 6. Exportación desde Blender

Se usa el **exportador glTF 2.0 integrado en Blender** (*File → Export → glTF 2.0 (.glb/.gltf)*). No hace falta instalar nada.

**Pasos:**
1. Aplicar transformaciones a la **arquitectura** (*Ctrl+A → All Transforms*) para que su escala sea 1 y su rotación 0. **No** aplicar transformaciones a los empties `SPAWN`, `OBRA_xx` y `PARADA_xx`: su posición y orientación son la información.
2. Verificar la lista de la sección 7.
3. Exportar en formato **glTF Binary (`.glb`)**, con imágenes embebidas.
4. Configurar las opciones de la tabla siguiente.
5. Guardar en `viewer/assets/models/sala.glb`.
6. Ejecutar `npm run tools:validar` (a partir de la fase 2) para comprobar nodos y referencias.

**Opciones del exportador (Blender 5.2 LTS; los nombres pueden variar entre versiones):**

| Panel | Opción | Valor |
|---|---|---|
| Format | Format | glTF Binary (.glb) |
| Include | Limit to | Visible Objects (los `COL_*` y `PISO_*` deben estar visibles) |
| Include | Punctual Lights, Cameras | Desactivados |
| Transform | +Y Up | **Activado** (conversión Z-up → Y-up) |
| Geometry | Apply Modifiers | Activado (salvo que haya shape keys) |
| Geometry | UVs | Activado |
| Geometry | Normals | Activado |
| Geometry | Tangents | Desactivado |
| Geometry | Vertex Colors | Desactivado |
| Materials | Materials | Export |
| Compression | Draco / Meshopt | **Desactivados.** La compresión se aplica después con `tools/` (gltf-transform), donde queda controlada y es repetible. |
| Animation | Animation | Desactivado |

### 7. Lista de verificación antes de exportar

- [ ] Unidades en metros, Unit Scale 1.0.
- [ ] Arquitectura con escala 1 y rotación 0 (transformaciones aplicadas). Empties sin aplicar.
- [ ] Nombres exactos según la sección 2, sin duplicados, sin espacios, tildes ni sufijos `.001`.
- [ ] Existe `SPAWN`. Existen `OBRA_01`… y `PARADA_01`… con las cantidades previstas.
- [ ] Los `COL_*` y `PISO_*` están visibles en el viewport (la exportación usa *Visible Objects*).
- [ ] Cada malla horneada tiene UV1 y, si se usa camino B, UV2 sin solapes.
- [ ] Materiales simples: un material por zona; en el camino A, la textura horneada conectada al color base.
- [ ] Texturas de lightmap de 1024–2048 px, potencias de 2 cuando sea posible.
- [ ] Sin objetos ocultos que no deban salir, sin materiales sin usar, sin luces ni cámaras que no se necesiten.
- [ ] Planos de obras: una cara visible, con la normal hacia la sala.
- [ ] Polígonos totales razonables (orientativo: < 100 000 triángulos en la escena completa).
- [ ] Opciones de exportación de la tabla de la sección 6 aplicadas.

### 8. Escena de prueba de horneado (validar antes del museo completo)

Antes de modelar el museo, construir una **escena mínima** para validar el flujo completo:

- Una caja de 6 × 4 × 3 m (sala) con suelo `PISO_prueba`, muros `COL_prueba_*` visibles y techo.
- Un plano de obra en un muro, con su empty `OBRA_01` en posición y orientación conocidas.
- Un `SPAWN` en la sala y un `PARADA_01` en el centro.
- Un objeto de referencia con **marca visible en el lado frontal** (flecha o color), para verificar la orientación.
- Un cubo de 1 m con escala 1 para verificar la métrica.
- Una luz de área en el techo, para que el horneado tenga algo que mostrar.
- Horneado con **Cycles → Bake, Bake Type: Combined**, en una imagen de 2048 px:
  - Camino A: sobre UV1, la imagen se conecta al color base.
  - Camino B: sobre UV2, la imagen va al canal de oclusión (ver sección 4).
- Comparar ambos caminos en el visor.

**Criterios de aceptación:**
1. El suelo está horizontal y los muros, verticales.
2. La marca de la obra mira hacia el interior de la sala.
3. `SPAWN` se orienta hacia el frente esperado.
4. El cubo de 1 m mide 1 m en el visor.
5. El color de la textura horneada coincide con el render de referencia de Blender (con tolerancia visual).

---

## Color y fidelidad de las obras

- Las texturas de color se cargan como **sRGB**, y la salida del renderer es **sRGB**.
- **Tone mapping:** `NeutralToneMapping` para la sala. Justificación completa en `docs/decisiones.md` (D-03). Se compara contra *ninguno* en la fase 2 con una carta de color de prueba.
- **Obras:** material sin iluminación (`MeshBasicMaterial`) con `toneMapped = false`. Así los colores de la obra no cambian con la luz de la sala.
- Versiones de imagen:
  - **Miniatura** (≈ 512 px): catálogo y listados.
  - **Web** (≈ 2048 px, WebP o JPG de alta calidad): en la sala. Mipmaps y filtrado anisotrópico.
  - **Full** (original o casi): solo en el modo detalle, con zoom y arrastre, cargada bajo demanda.
- Las imágenes se generan desde los originales con `tools/` (sharp), conservando el perfil de color.

## Originales fuera del repositorio

Los originales de obras (TIFF, PSD, RAW) y los archivos `.blend` pesados **no se guardan en el repositorio**. Ruta prevista:

```
C:\Users\Davi\Documents\Antigravity\Museo-originales\
  obras\          originales de obras, sin comprimir
  modelos\        archivos .blend y exportaciones intermedias
```

Esa carpeta no se sincroniza con Git. Para las obras grandes, la versión `full` puede alojarse en otro servidor (ver sección de despliegue).

---

## Versiones fijadas

Verificadas el 31/10/2026 con `npm view`. Solo se usan versiones con al menos dos semanas de publicadas.

| Paquete | Versión | Publicada | Uso |
|---|---|---|---|
| `three` | 0.186.1 | 24/09/2026 | Visor (renderer, loaders, WebXR, decoders en `examples/jsm/libs/`) |
| `fastify` | 5.12.7 | 13/10/2026 | Backend |
| `@fastify/static` | 10.1.6 | 09/10/2026 | Servir `/viewer` |
| `@fastify/rate-limit` | 11.2.1 | 08/10/2026 | Límites de tasa en la API |
| `@fastify/helmet` | 13.2.0 | 13/10/2026 | Cabeceras de seguridad |
| `@fastify/multipart` | 10.1.4 | 15/10/2026 | Subida de imágenes y audios |
| `@fastify/compress` | 9.2.2 | 13/10/2026 | Compresión |
| `@fastify/cookie` | 11.1.3 | 08/10/2026 | Sesión del panel |
| `@fastify/session` | 11.1.4 | 09/10/2026 | Sesión del panel |
| `@gltf-transform/cli` y `core` | 4.5.1 | 28/09/2026 | Optimización del GLB |
| `sharp` | 0.35.5 | 27/09/2026 | Derivados de imágenes |
| `draco3d` | 1.5.9 | 16/10/2026 | Codificación Draco (usado por gltf-transform) |
| `meshoptimizer` | 1.3.0 | 25/09/2026 | Compresión Meshopt |
| `dotenv` | 18.0.8 | 14/10/2026 | Configuración del backend |

**Decodificadores en `viewer/vendor/`:** se copian desde el paquete `three` (misma versión), no desde `draco3d`:
- `three/examples/jsm/libs/draco/gltf/` → DRACOLoader
- `three/examples/jsm/libs/basis/` → KTX2Loader
- `three/examples/jsm/libs/meshopt_decoder.module.js` → MeshoptDecoder

**Herramienta externa:** para generar KTX2 desde gltf-transform hace falta el binario `toktx` (KTX-Software). Se instala aparte en Windows; se documentará en la fase 6.

---

## Backend (opcional, `server/`)

- **Fastify** sirve `/viewer` con compresión, caché adecuada, soporte de rangos HTTP para audio y MIME correctos (`.glb`, `.ktx2`, `.wasm`).
- **Panel de administración** (solo en localhost por defecto) para editar `obras.json` y `recorrido.json`, subir imágenes y audios.
- **Estadísticas anónimas:** visitas, obras más vistas, uso del recorrido. Sin datos personales ni cookies de seguimiento.
- **Seguridad:**
  - Validación de tipo y tamaño de archivos subidos, nombres saneados.
  - Límites de tasa en la API y cabeceras de seguridad.
  - Copias de seguridad automáticas de los JSON antes de cada edición.
  - Acceso remoto al panel solo con autenticación (contraseña en variable de entorno y sesión segura). Recomendado además proteger con **Cloudflare Access**.
- **Configuración:** archivo `server/.env` (se incluye un `server/.env.example`): puerto, contraseña del panel, rutas.

### Multijugador (no implementado)

Ver a otros visitantes en la sala **no está implementado**. La arquitectura lo deja preparado: el visor usa un módulo de estado separado que puede conectarse a un canal. Para implementarlo harían falta: un servidor de tiempo real (WebSocket), posiciones de avatares con frecuencia limitada, avatares sencillos, límite de visitantes por sala, moderación básica y un plan para el tráfico de la muestra.

---

## Ejecución y exposición

Las guías completas (servir el visor, arrancar el backend, túnel, gestor de procesos, GitHub Pages) se escriben en la fase 7.

Puntos ya fijados:
- **WebXR y HTTPS.** WebXR no funciona con `http://IP-local`. Para el Quest y para cualquier dispositivo fuera de `localhost`, hay que exponer por HTTPS con **Cloudflare Tunnel**.
- **Muestra larga.** Backend y túnel como servicio o con gestor de procesos que los reinicie si caen. Evitar la suspensión del computador. Revisar la velocidad de subida.
- **GitHub Pages (solo visor).** Límites: ≈ 1 GB por sitio, 100 MB por archivo. Git LFS no sirve: Pages no entrega los objetos LFS. Si el proyecto no cabe, las versiones `full` se alojan en otro servidor.

## Accesibilidad e idioma

- Navegación por teclado, etiquetas en botones, contraste adecuado, subtítulos y respeto a "reducir movimiento".
- Textos de la interfaz en `viewer/data/i18n/es.json`. Inglés más adelante sin tocar el código.
- Textos de obras y recorrido admiten campos por idioma (`{ "es": "...", "en": "..." }`).

## Modo desarrollo y modo kiosco

- `?debug=1`: FPS, triángulos, draw calls, memoria de texturas, colisiones y nodos. Desactiva el service worker.
- `?kiosco=1`: recorrido guiado en bucle, sin menús de salida, vuelta al inicio tras un tiempo de inactividad.
- `#obra=OBRA_03` o `#parada=PARADA_02`: abren directamente la obra o la parada. Útiles para códigos QR en una exposición física.
