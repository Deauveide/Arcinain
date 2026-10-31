# Registro de decisiones

Estado: **Propuesta** (pendiente de confirmación del usuario), **Confirmada** o **Cambiada**.

| ID | Tema | Decisión | Estado |
|---|---|---|---|
| D-00 | Herramienta de modelado | **Blender** (no 3ds Max). Exportación con el glTF 2.0 integrado. | Confirmada (mensaje del usuario, 31/10/2026) |
| D-01 | Backend | **Fastify 5** en lugar de Express: mejor rendimiento para servir archivos grandes con rangos HTTP, plugins oficiales de seguridad (helmet, rate-limit) y soporte nativo de esquemas para validar entradas. | Propuesta |
| D-02 | Versión de Three.js | **0.186.1**. La 0.187.0 se publicó el 30/10/2026 y no cumple la regla de dos semanas. Se actualizará cuando cumpla. | Propuesta |
| D-03 | Tone mapping | **`NeutralToneMapping`** para la sala. Justificación abajo. Se valida en la fase 2 contra *ninguno* con una carta de color. | Propuesta |
| D-04 | Color de las obras | Material `MeshBasicMaterial` (sin iluminación) con `toneMapped = false`. Los colores de la obra no cambian con la luz ni con el tone mapping de la sala. | Propuesta |
| D-05 | Lightmap | **Camino A**: iluminación horneada en el color base; las mallas de arquitectura se muestran sin iluminación. Camino B (UV2 en oclusión) como alternativa. Camino C descartado. | Propuesta |
| D-06 | Colisiones en el GLB | `COL_*` y `PISO_*` dentro de `sala.glb` por defecto (un solo archivo). Opción de `colisiones.glb` separado. | Propuesta |
| D-07 | Exportación | Exportador glTF 2.0 integrado de Blender, sin Draco ni Meshopt; la compresión se aplica después en `tools/` con gltf-transform. | Propuesta |
| D-08 | Sala provisional | Se genera por script (`tools/` con `@gltf-transform/core`) un `sala.glb` con la misma convención de nombres. Así cambiar al modelo real es reemplazar el archivo. | Propuesta |
| D-09 | Placeholders de obras | Imágenes de prueba generadas por script y guardadas en `assets/obras/`. Audios de prueba generados por script (tonos cortos). | Propuesta |
| D-10 | Túnel | **Cloudflare Tunnel con nombre** (dominio propio) para la muestra larga. El "quick tunnel" sirve para pruebas, pero cambia de URL y no tiene garantía de uptime. El usuario confirma que tiene dominio; falta su nombre (fase 7). | Confirmada (dominio: sí) |
| D-11 | Panel de administración | Solo en localhost por defecto. Acceso remoto con contraseña en variable de entorno y sesión (`@fastify/session`). Recomendado Cloudflare Access encima. | Propuesta |
| D-12 | Estadísticas | Contadores agregados en un archivo JSON. No se guarda IP ni identificador de visitante; solo contadores por obra, por parada y por día. | Propuesta |
| D-13 | Copias de seguridad | Antes de cada escritura en `obras.json` o `recorrido.json`, copia con marca de tiempo en `server/data/backups/`. Se conservan las últimas 50. | Propuesta |
| D-14 | Multijugador | No implementado. Se deja un módulo de estado separado y el README describe lo que falta. | Confirmada (pedido del usuario) |
| D-15 | Calidad adaptativa | Tres perfiles (bajo, medio, alto). Selección automática por pixel ratio, memoria estimada y tipo de dispositivo; selector manual en el menú. | Propuesta |
| D-16 | Service worker | Caché con nombre versionado. Desactivado con `?debug=1`. Modo sin conexión solo para el visor y sus assets. | Propuesta |
| D-17 | Modo kiosco | Recorrido en bucle; vuelta al inicio tras **90 s** de inactividad (configurable en `recorrido.json` o en `kiosco.json`). | Propuesta |
| D-18 | Catálogo en VR | Versión simplificada con **6 obras por página**, navegación con el puntero. | Propuesta |
| D-19 | Idioma | Solo español ahora. Estructura lista para inglés (`es.json`, campos por idioma en los JSON). | Confirmada (pedido del usuario) |
| D-20 | Control de versiones | Repositorio **https://github.com/Deauveide/Arcinain**. Git inicializado en la carpeta, rama `main`, remoto `origin` configurado. **Sin commits** hasta que el usuario lo pida. | Confirmada (repositorio creado por el usuario) |
| D-21 | Tabla de datos de obras | Los datos de las obras se recogen en `docs/obras-tabla.csv`. Un script (`tools:obras`, fase 2) la convierte en `obras.json`. El formato de los originales sigue sin definir. | Propuesta |
| D-22 | Voz en off | Español. Audios de prueba hasta que el usuario entregue las grabaciones. | Confirmada (pedido del usuario) |
| D-23 | Modelo de Quest | Sin definir. Los perfiles de calidad se ajustarán cuando se conozca el modelo. | Pendiente |
| D-24 | Campo de visión en celular vertical | En pantallas estrechas (aspecto < 0,8) el FOV vertical sube de 70° a 80°, para no perder el campo lateral. | Propuesta, validada en prueba headless (Fase 1) |
| D-25 | Toques en celular | Un toque corto sin arrastre: si cae sobre una parada (`PARADA_xx`), el visitante va a esa parada; si cae sobre el piso (`PISO_*`), va al punto tocado. Joystick en la mitad izquierda inferior; arrastre en el resto para mirar. | Propuesta, validada en prueba headless (Fase 1) |

---

## Justificación: tone mapping (D-03)

Se comparan tres opciones para la sala:

| Opción | Efecto sobre color base | Riesgo para obras | Veredicto |
|---|---|---|---|
| Ninguno (`NoToneMapping`) | Sin cambios de tono, pero las luces intensas saturan a blanco y el color se corta | Bajo en obras (unlit) y alto en muros muy iluminados | Válido solo si la iluminación horneada no excede 1.0 |
| ACES Filmic (`ACESFilmicToneMapping`) | Cambia el contraste, desplaza matices y desatura colores intensos | Alto: altera el color de cualquier material que no sea unlit | Descartado para un museo donde el color importa |
| Neutral (`NeutralToneMapping`) | Mantiene el tono de los colores base hasta brillos altos; comprime solo las luces muy intensas | Bajo | **Elegido para la sala** |

La decisión final se confirma en la fase 2 con una carta de color (parches de referencia) renderizada en el visor: se mide la diferencia de color frente a la referencia con y sin tone mapping. Si Neutral altera un parche de forma visible, se cambia a *ninguno* y se ajusta la exposición de la sala. Las obras no dependen de esta decisión porque usan `toneMapped = false` (D-04).

## Preguntas abiertas para el usuario

1. **Dominio propio (D-10).** ¿Tienen un dominio que pueda gestionarse en Cloudflare? Sin dominio, el túnel de la muestra solo tendrá URL aleatoria y cambiará en cada arranque.
2. **Git y GitHub (D-20).** ¿Crear el repositorio en GitHub (público o privado) para la publicación en Pages? Lo necesito para la fase 1 y para la guía de despliegue.
3. **Originales de obras.** ¿Ya están digitalizados? ¿En qué formato y tamaño? Afecta a `tools/` en la fase 2 (no bloquea la fase 1).
4. **Medidas y datos de obras.** ¿Tienen título, artista, año, técnica y medidas reales de cada obra? Sin ellos se usan datos de ejemplo marcados como tales.
5. **Voz en off.** ¿Idioma y quién la graba? Hasta entonces se usan audios de prueba generados por script (D-09).
6. **Modelo del Quest.** ¿Quest 2, 3, 3S o Pro? Influye en los perfiles de calidad, no bloquea nada.
