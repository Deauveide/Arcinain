# Skills, plugins y servidores MCP para trabajar en este proyecto

Lista de lo que conviene tener instalado en Claude Code (u otro agente compatible) para trabajar en el recorrido virtual 3D del Museo Rayo. Está pensada para leerse desde otra máquina u otro agente y dejar el entorno listo.

Se armó a partir de `docs/especificacion.md` (fases 1 a 7), `README.md` y `CLAUDE.md`. Cada entrada dice **para qué fase o tarea** sirve. La columna «Estado» indica si ya estaba instalada en la máquina original (11/11/2026) o si es una recomendación nueva.

> Las versiones de librerías del proyecto **no** se instalan desde aquí: se fijan con versión exacta en `package.json` y `viewer/vendor/` (regla 4 de `CLAUDE.md`).

---

## 1. Plugins (marketplace)

Se instalan desde Claude Code con `/plugin marketplace add <repo>` y luego `/plugin install <plugin>@<marketplace>`.

### Marketplace oficial de Anthropic (`anthropics/claude-plugins-official`)

| Plugin | Para qué sirve aquí | Fases | Estado |
|---|---|---|---|
| `superpowers` | Flujo disciplinado: brainstorming antes de diseñar, `writing-plans`, `executing-plans`, `systematic-debugging` (p. ej. el bug de colisiones D-34), `test-driven-development`, `verification-before-completion`. Encaja con la regla «por fases, parar y esperar confirmación» | Todas | Instalado |
| `frontend-design` | Pantalla de inicio, fichas, catálogo tipo librito, controles de narración; interfaz cuidada sin plantillas genéricas | 1, 2, 4, 5 | Instalado |
| `playwright` | Probar el visor en navegador real: carga de `sala.glb`, modo celular, `?debug=1`, `?kiosco=1`, enlaces `#obra=`, capturas | 1–6 | Instalado |
| `code-review` | Revisar cambios antes de cada commit o al cerrar una fase | Todas | Instalado |
| `code-simplifier` | Limpiar código del visor sin cambiar comportamiento | Todas | Instalado |
| `github` | Issues, PR y Pages del repositorio `Deauveide/Arcinain` (necesita token válido) | 7 | Instalado (falló la conexión el 11/11: revisar el token) |

### Otros marketplaces

| Marketplace (`repo`) | Plugin | Para qué sirve aquí | Fases | Estado |
|---|---|---|---|---|
| `ChromeDevTools/chrome-devtools-mcp` | `chrome-devtools-mcp` | Rendimiento (FPS, draw calls, memoria de texturas), consola, red, Lighthouse, accesibilidad (`a11y-debugging`), LCP del primer render | 1, 6 | Instalado (no conectó el 11/11) |
| `rohitg00/pro-workflow` | `pro-workflow` | Commits con chequeos (`smart-commit`), handoff entre sesiones, `wrap-up`, planificador | Todas | Instalado |
| `tigerless-labs/autoharness` | `autoharness` | Acumula skills propias a partir de las sesiones | Todas | Instalado |
| `thedotmack/claude-mem` | `claude-mem` | Memoria entre sesiones (estado de fases, decisiones) | Todas | Instalado |
| `mksglu/context-mode` | `context-mode` | Reduce consumo de contexto en sesiones largas | Todas | Instalado |
| `pbakaus/impeccable` | (skills de diseño) | Pulido visual de la interfaz | 1, 2, 5 | Marketplace añadido |

---

## 2. Servidores MCP

| Servidor | Para qué sirve aquí | Fases | Cómo instalar | Estado |
|---|---|---|---|---|
| **Blender MCP** (`ahujasid/blender-mcp`) | Modelar los módulos, colocar `SPAWN`, `OBRA_xx`, `PARADA_xx`, `ZONA_moduloN`, `COL_*`, `PISO_*` y exportar `viewer/assets/models/sala.glb` desde esta misma sesión (spec 10.1) | 1, 6 | `claude mcp add blender -- uvx blender-mcp` + instalar el add-on `addon.py` en Blender y pulsar «Connect» | Usado antes; **no aparece configurado ahora: reinstalar** |
| **Playwright MCP** | Igual que el plugin; viene con él | 1–6 | Con el plugin `playwright` | Instalado |
| **Chrome DevTools MCP** | Perfilado de rendimiento y depuración | 1, 6 | Con el plugin `chrome-devtools-mcp` | Instalado |
| **Claude in Chrome** (extensión) | Probar en el Chrome real del usuario, grabar GIF de recorridos | 1–6 | Extensión de Chrome de Claude | Disponible |
| **Three.js 3D Viewer** (conector de claude.ai) | Consultar documentación de Three.js (`learn_threejs`) y previsualizar escenas | 1–6 | Conector de claude.ai | Disponible |
| **Figma** (conector de claude.ai) | Opcional: maquetar la interfaz (inicio, fichas, catálogo) antes de codificar | 1, 2, 5 | Conector de claude.ai | Disponible |
| **Cloudflare** (`cloudflare/mcp-server-cloudflare`) | Opcional: gestionar el túnel con nombre y el dominio propio | 7 | Ver el repositorio oficial de Cloudflare | Recomendado, no instalado |

> El MCP de `qgis` está configurado en la máquina pero no tiene uso en este proyecto.

---

## 3. Skills personales (`~/.claude/skills/`)

No vienen de un marketplace: hay que **copiar la carpeta** de cada una a `~/.claude/skills/` en la otra máquina.

| Skill | Para qué sirve aquí | Fases |
|---|---|---|
| `img2threejs` | Convertir una imagen de referencia en un modelo Three.js procedural (piezas sueltas, mobiliario, prototipos de sala) | 1, 6 |
| `preview-local-html-in-browser` | Abrir y probar `viewer/index.html` servido en local en el navegador / Playwright | 1–6 |
| `git-github-workflow` | Commits, push, finales de línea CRLF/LF en Windows, GitHub Pages, `remote set-url` | Todas, 7 |
| `spec-plan-authoring` | Mantener `docs/especificacion.md` y `docs/decisiones.md` coherentes cuando cambian decisiones | Todas |
| `subagent-delegation` | Delegar tareas a subagentes de forma controlada | Todas |
| `mobile-native` | Que el visor en celular se sienta nativo: `100vh`, zoom en inputs, notch, gestos, pull-to-refresh | 1, 5 |
| `gestures` | Joystick virtual, arrastre para mirar, zoom y arrastre del modo detalle | 1, 2 |
| `animate`, `choreograph`, `animation-performance` | Transiciones de fichas, catálogo y fundidos sin perder frames; respetar `prefers-reduced-motion` | 2, 4, 5 |
| `break-ui` | Probar fichas y catálogo con datos extremos (títulos largos, campos vacíos, muchas obras) | 2, 5 |
| `pdf-text-extraction` | Leer PDFs de referencia (catálogos del museo, planos) | 2, 6 |

## 4. Skills integradas de Claude Code y de `anthropic-skills`

Vienen con Claude Code o con la cuenta; solo hay que saber que existen.

| Skill | Uso en el proyecto |
|---|---|
| `run` | Arrancar el visor (`npm run viewer`) y verlo funcionando |
| `code-review`, `security-review` | Revisión antes de commits; la de seguridad es clave en la fase 7 (panel, subidas, helmet, límites de tasa) |
| `simplify` | Limpieza del código cambiado |
| `claude-api` | Solo si algún día se añade IA al proyecto (no está previsto) |
| `anthropic-skills:pdf`, `docx`, `xlsx` | Leer o generar documentos del museo (fichas recibidas en Word/Excel, catálogos) |
| `anthropic-skills:chrome-browser` | Guía para usar Claude in Chrome |
| `artifact-design`, `artifact-diagramming` | Diagramas de la arquitectura o del recorrido para compartir |

---

## 5. Herramientas fuera de Claude que el proyecto necesita

No son skills, pero sin ellas las anteriores no sirven:

- **Node.js ≥ 22** y `npm install` en la raíz (`@gltf-transform/core` y `@gltf-transform/extensions` 4.5.1; en la fase 2 se suma `sharp`).
- **Blender** (con el add-on de Blender MCP) para la arquitectura.
- **uv / uvx** (Python) para ejecutar `blender-mcp`.
- **cloudflared** para el túnel HTTPS (VR en el Quest exige HTTPS; fase 3 de prueba y fase 7).
- **Meta Quest Browser** para probar la fase 3.

## 6. Orden sugerido de instalación

1. Node 22, Blender, uv, `npm install`.
2. Marketplace oficial → `superpowers`, `frontend-design`, `playwright`, `code-review`, `code-simplifier`, `github`.
3. `chrome-devtools-mcp` y `pro-workflow`.
4. Blender MCP (`claude mcp add blender -- uvx blender-mcp`) y el add-on en Blender.
5. Copiar las skills personales de la sección 3.
6. Fase 7: `cloudflared` y, si se quiere, el MCP de Cloudflare.
