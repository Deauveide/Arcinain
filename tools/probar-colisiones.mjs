// Prueba de colisiones (D-34) sin navegador: carga sala.glb, toma los triángulos de COL_*
// con la misma lógica del visor (viewer/js/colisiones.js) y camina desde SPAWN en muchas
// direcciones, pegándose a las paredes. Falla si el visitante sale del recinto o atraviesa
// una colisión.
//
// Uso: node tools/probar-colisiones.mjs [ruta/a/sala.glb]
// El recinto se toma de PISO_*: el visitante no debe dejar de tener piso debajo.

import { NodeIO } from '@gltf-transform/core';
import { KHRMaterialsTransmission } from '@gltf-transform/extensions';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepararTriangulos, holgura, mover, distanciaTriangulo } from '../viewer/js/colisiones.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RUTA = process.argv[2] ?? resolve(RAIZ, 'viewer/assets/models/sala.glb');

// Mismos valores que viewer/js/navigation.js
const RADIO = 0.28;
const BASE = 0.1;
const TOPE = 1.7;
const VELOCIDAD = 3.4;   // corriendo, el peor caso
const DT = 1 / 60;

/** Vértices de mundo de todas las mallas cuyo nombre cumple el filtro, tres por triángulo. */
function posiciones(doc, filtro) {
  const salida = [];
  for (const nodo of doc.getRoot().listNodes()) {
    const malla = nodo.getMesh();
    if (!malla || !filtro(nodo.getName())) continue;
    const m = nodo.getWorldMatrix();
    for (const prim of malla.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const ind = prim.getIndices();
      const total = ind ? ind.getCount() : pos.getCount();
      const v = [0, 0, 0];
      for (let i = 0; i < total; i++) {
        pos.getElement(ind ? ind.getScalar(i) : i, v);
        salida.push(
          m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
          m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
          m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
        );
      }
    }
  }
  return salida;
}

const doc = await new NodeIO().registerExtensions([KHRMaterialsTransmission]).read(RUTA);
const colision = prepararTriangulos(posiciones(doc, (n) => n.startsWith('COL_')));
// Piso: todos sus triángulos (con cualquier altura) sirven para saber si hay piso debajo
const piso = prepararTriangulos(posiciones(doc, (n) => n.startsWith('PISO_')));
const hayPiso = (x, z) => piso.some((tri) => distanciaTriangulo(x, z, tri) === 0);

// Puntos de partida: SPAWN y todas las paradas (con varias cúpulas, SPAWN solo cubre la entrada)
const origenes = doc.getRoot().listNodes()
  .filter((n) => n.getName() === 'SPAWN' || n.getName().startsWith('PARADA_'))
  .map((n) => [n.getName(), n.getWorldTranslation()]);
console.log(`${RUTA}\n${colision.length} triángulos de colisión, ${piso.length} de piso, ${origenes.length} puntos de partida`);

let fallos = 0;
const DIRECCIONES = 72;
for (const [nombre, origen] of origenes) {
  if (!hayPiso(origen[0], origen[2]) || holgura(colision, origen[0], origen[2], RADIO, BASE, TOPE) < 0) {
    console.log(`FALLO ${nombre}: el punto de partida no tiene piso o está dentro de una colisión`);
    fallos++;
    continue;
  }
  for (let i = 0; i < DIRECCIONES; i++) {
    const angulo = (i / DIRECCIONES) * Math.PI * 2;
    let x = origen[0];
    let z = origen[2];
    // 8 s en línea recta: llega a la pared y sigue empujando (desliza a lo largo de ella)
    for (let paso = 0; paso < 8 / DT; paso++) {
      const dx = Math.cos(angulo) * VELOCIDAD * DT;
      const dz = Math.sin(angulo) * VELOCIDAD * DT;
      [x, z] = mover(colision, x, z, dx, dz, RADIO, BASE, TOPE);
      const h = holgura(colision, x, z, RADIO, BASE, TOPE);
      if (!hayPiso(x, z) || h < -1e-6) {
        console.log(`FALLO ${nombre}, dirección ${(angulo * 180 / Math.PI).toFixed(0)}°: (${x.toFixed(2)}, ${z.toFixed(2)}) ${hayPiso(x, z) ? '' : 'fuera del piso '}holgura ${h.toFixed(3)}`);
        fallos++;
        break;
      }
    }
  }
}

const total = origenes.length * DIRECCIONES;
console.log(fallos === 0 ? `OK: ${total} recorridos (${origenes.length} puntos × ${DIRECCIONES} direcciones), nunca sale del piso ni atraviesa colisiones.` : `${fallos} de ${total} recorridos fallan.`);
process.exit(fallos === 0 ? 0 : 1);
