# CLAUDE.md — Museo Rayo, recorrido virtual 3D

Instrucciones para Claude Code en este proyecto. Léelo antes de tocar código.

## Qué es
Recorrido virtual en 3D del Museo Rayo de Roldanillo (Valle del Cauca). Escritorio, celular y VR (Meta Quest, WebXR). La arquitectura la modela el usuario en Blender y llega como `sala.glb` (exportado con el glTF 2.0 integrado de Blender). Hasta entonces, el código usa una sala provisional generada por script con la misma convención de nombres.

Especificación completa: `docs/especificacion.md`. Decisiones y su estado: `docs/decisiones.md`. Contrato con Blender: sección correspondiente en `README.md`.

## Idioma
- Respuestas al usuario, comentarios de código, textos de la interfaz (`viewer/data/i18n/es.json`) y documentación: **español** con tildes completas.
- Identificadores de código y nombres técnicos en su forma original (`PARADA_01`, `WebXR`, `NeutralToneMapping`).

## Reglas de trabajo
1. **Por fases.** Se trabaja en las fases 1 a 7 de `docs/especificacion.md`. Al terminar cada una, paro, digo qué probar y espero la confirmación del usuario antes de iniciar la siguiente.
2. **Sin commits ni push sin pedirlo.** No crear commits por iniciativa propia.
3. **Originales pesados fuera del repo.** Los TIFF/PSD/RAW de obras y los archivos `.blend` pesados no entran al repositorio. Ruta prevista: `C:\Users\Davi\Documents\Antigravity\Museo-originales\` (ver `README.md`).
4. **Versiones de librerías.** Fijadas con versión exacta. Antes de fijar una, verificar con `npm view <paquete> time --json` que la versión tenga **al menos dos semanas** de publicada. No usar `latest` ni rangos.
5. **Sin paso de build para el visor.** HTML, CSS y JS vanilla, módulos ES con `importmap`. Librerías en `viewer/vendor/` con rutas locales.
6. **Sin dependencias de terceros en runtime** (fuentes, CDN, analítica). Todo se sirve desde el propio dominio.
7. **Sin cookies de seguimiento.** Estadísticas anónimas (ver especificación).
8. **Compatibilidad.** Chrome/Edge/Firefox escritorio, Safari iOS, Chrome Android, navegador del Meta Quest. En iOS no hay WebXR: ocultar el botón "Entrar en VR".
9. **WebXR exige HTTPS** (o `localhost`). Nunca dar `http://IP-local` como solución para VR.
10. **Contrato de nombres.** `SPAWN`, `OBRA_xx`, `PARADA_xx`, `COL_*`, `PISO_*`, `ZONA_*` son sagrados: el código los reconoce exactamente así. Si cambia el contrato, se cambia primero en el README y en `docs/decisiones.md`.
11. **El GLB se reemplaza sin tocar lógica.** Cualquier cambio que obligue a tocar `js/` para usar el modelo real es un bug de diseño.

## Estructura
```
viewer/        visor estático (Three.js, WebXR)
  index.html, css/, js/, data/ (obras.json, recorrido.json, i18n/), assets/, vendor/
server/        backend opcional (Fastify) — fase 7
tools/         scripts Node: optimización, derivados de imágenes, validación, sala provisional
docs/          especificación y decisiones
blender/       archivos fuente de Blender (.blend y GLB de trabajo, sin versionar); ver docs/especificacion.md, sección 10.1
README.md      guía de uso y contrato con Blender
```

## Convenciones de código
- Comentarios en español, explicando el *porqué* cuando no sea obvio.
- Un solo renderer, un solo loop de animación.
- Nada de sombras en tiempo real ni postprocesado pesado.
- Presupuesto de escena: < ~100 000 triángulos, pocos draw calls (fusionar mallas estáticas).
- Textos visibles siempre pasan por `i18n.js`; nunca literales en el HTML de la lógica.
- Respetar `prefers-reduced-motion`.

## Estado
- **Fase 0 (especificación): completada y confirmada por el usuario** (31/10/2026). Repositorio: https://github.com/Deauveide/Arcinain (remoto `origin` configurado, sin commits).
- **Fase 1 (base del visor): implementada, pendiente de prueba del usuario.** Probada en headless: escritorio (movimiento, giro, colisiones) y celular (joystick, arrastre, tocar piso y paradas).
- Fases 2–7: pendientes.

## Datos del usuario (confirmados)
- Tiene dominio propio (nombre por confirmar) para el túnel de Cloudflare (fase 7).
- Las obras ya están digitalizadas; el formato aún no está definido. Los datos se recogen en `docs/obras-tabla.csv` (plantilla).
- Voz en off en español; por ahora audios de prueba.
- Modelo de Quest: aún no definido.
- Modelado en **Blender** (no 3ds Max).

## Comandos
- `npm install` · `npm run tools:sala` · `npm run viewer` (detalle en `README.md`).
- Pendientes: `tools:obras`, `tools:optimizar`, `tools:validar` (fases 2 y 6), backend (fase 7).
