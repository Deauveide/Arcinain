// Adapta el módulo de Blender al contrato del visor y escribe viewer/assets/models/sala.glb.
//
// Entrada:  blender/Modulo museo.glb   (exportación del módulo; NO se modifica)
// Salida:   viewer/assets/models/sala.glb
//
// PROVISIONAL: el módulo aún no trae los nodos del contrato (SPAWN, OBRA_xx, PARADA_xx,
// COL_*, PISO_*). Este script los añade a partir de los paneles y del piso del módulo.
// Cuando el módulo se exporte desde Blender con esos nombres, este paso deja de ser necesario.
//
// Decisiones (ver docs/decisiones.md, D-26):
//   - OBRA_01…OBRA_08 = los 8 paneles grandes Panel_N.001 (1,3 m), uno por cara de la sala.
//   - Cada OBRA copia la posición y la orientación del panel; su -Z apunta a la sala.
//   - PARADA_0N está a 2,5 m delante de OBRA_0N, mirando hacia la obra.
//   - COL_*: cuatro muros interiores (espesor 0,2 m, dentro del revestimiento) y la banca.
//
// Uso: npm run tools:modulo

import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMaterialsTransmission } from '@gltf-transform/extensions';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRADA = resolve(RAIZ, 'blender/Modulo museo.glb');
const SALIDA = resolve(RAIZ, 'viewer/assets/models/sala.glb');

const DISTANCIA_PARADA = 2.5;      // m, desde la obra hasta la parada
const SEPARACION_OBRA = 0.021;     // m, para que la obra quede justo delante del panel (grosor 0,04)
const ALTURA_MURO = 4.2;           // m, altura del revestimiento interior
const ESPESOR_MURO = 0.2;          // m
const BORDE_INTERIOR = 5.4;        // m, centro del muro de colisión (la cara interior queda en 5.3)

// ---------------------------------------------------------------- cuaterniones [x, y, z, w]

/** Rota un vector v por el cuaternión q. */
function rotar(q, v) {
  const [x, y, z, w] = q;
  const [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [
    vx + w * tx + (y * tz - z * ty),
    vy + w * ty + (z * tx - x * tz),
    vz + w * tz + (x * ty - y * tx),
  ];
}

/** Producto de cuaterniones a * b. */
function multiplicar(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

const GIRO_180_Y = [0, 1, 0, 0];

// ---------------------------------------------------------------- geometría de colisión

/** Malla de caja invisible para colisiones (el visor la oculta). */
function mallaCaja(doc, buffer, nombre, material, sx, sy, sz) {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const caras = [
    { n: [0, 0, 1],  v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
    { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
    { n: [1, 0, 0],  v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
    { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
    { n: [0, 1, 0],  v: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
    { n: [0, -1, 0], v: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] },
  ];
  const posiciones = [], normales = [], indices = [];
  caras.forEach((cara, i) => {
    cara.v.forEach((p) => { posiciones.push(...p); normales.push(...cara.n); });
    const b = i * 4;
    indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const primitiva = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(posiciones)).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(normales)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(indices)).setBuffer(buffer))
    .setMaterial(material);
  return doc.createMesh(nombre).addPrimitive(primitiva);
}

// ---------------------------------------------------------------- adaptación

async function main() {
  const io = new NodeIO().registerExtensions([KHRMaterialsTransmission]);
  const doc = await io.read(ENTRADA);
  const raiz = doc.getRoot();
  const escena = raiz.getDefaultScene() ?? raiz.listScenes()[0];
  const nodos = new Map(raiz.listNodes().map((n) => [n.getName(), n]));

  const falta = (nombre) => { throw new Error(`El módulo no tiene el nodo "${nombre}"; revisa el archivo de entrada.`); };

  // 1) Piso interior → PISO_sala1 (caminable, cara superior en y = 0)
  const piso = nodos.get('Piso_interior') ?? falta('Piso_interior');
  piso.setName('PISO_sala1');

  // 2) Obras y paradas a partir de los 8 paneles grandes
  const resumen = [];
  for (let n = 1; n <= 8; n++) {
    const panel = nodos.get(`Panel_${n}.001`) ?? falta(`Panel_${n}.001`);
    const t = panel.getTranslation();
    const q = panel.getRotation();
    // Hacia la sala = eje -Z local del panel (comprobado en la escena de prueba visual)
    const dentro = rotar(q, [0, 0, -1]);

    const posicionObra = [t[0] + dentro[0] * SEPARACION_OBRA, t[1], t[2] + dentro[2] * SEPARACION_OBRA];
    const obra = doc.createNode(`OBRA_0${n}`).setTranslation(posicionObra).setRotation(q);
    escena.addChild(obra);

    // Parada: delante de la obra, mirando hacia ella (su -Z va hacia la pared)
    const posicionParada = [
      posicionObra[0] + dentro[0] * DISTANCIA_PARADA,
      0,
      posicionObra[2] + dentro[2] * DISTANCIA_PARADA,
    ];
    const rotacionParada = multiplicar(q, GIRO_180_Y);
    const parada = doc.createNode(`PARADA_0${n}`).setTranslation(posicionParada).setRotation(rotacionParada);
    escena.addChild(parada);
    resumen.push(`OBRA_0${n} ← Panel_${n}.001 · PARADA_0${n} en (${posicionParada[0].toFixed(2)}, ${posicionParada[2].toFixed(2)})`);
  }

  // 3) Punto de inicio: centro-sur de la sala, mirando hacia la sala (-Z)
  escena.addChild(doc.createNode('SPAWN').setTranslation([0, 0, 3.0]).setRotation([0, 0, 0, 1]));

  // 4) Colisiones: cuatro muros interiores y la banca
  // Un GLB admite un único buffer: reutilizamos el del módulo
  const buffer = raiz.listBuffers()[0] ?? doc.createBuffer();
  const material = doc.createMaterial('MAT_colision_invisible').setBaseColorFactor([1, 0, 0, 0.2]);
  const muros = [
    { nombre: 'COL_muro_norte', c: [0, ALTURA_MURO / 2, -BORDE_INTERIOR], s: [11.0, ALTURA_MURO, ESPESOR_MURO] },
    { nombre: 'COL_muro_sur', c: [0, ALTURA_MURO / 2, BORDE_INTERIOR], s: [11.0, ALTURA_MURO, ESPESOR_MURO] },
    { nombre: 'COL_muro_este', c: [BORDE_INTERIOR, ALTURA_MURO / 2, 0], s: [ESPESOR_MURO, ALTURA_MURO, 11.0] },
    { nombre: 'COL_muro_oeste', c: [-BORDE_INTERIOR, ALTURA_MURO / 2, 0], s: [ESPESOR_MURO, ALTURA_MURO, 11.0] },
  ];
  for (const m of muros) {
    escena.addChild(doc.createNode(m.nombre).setMesh(mallaCaja(doc, buffer, m.nombre, material, ...m.s)).setTranslation(m.c));
  }

  // La banca del módulo es una caja de escala (1,8 × 0,44 × 0,45) con origen en su centro, a y = 0,22
  const banca = nodos.get('Banca') ?? falta('Banca');
  const [bx, by, bz] = banca.getTranslation();
  const [ex, ey, ez] = banca.getScale();
  escena.addChild(
    doc.createNode('COL_banca')
      .setMesh(mallaCaja(doc, buffer, 'COL_banca', material, ex, ey, ez))
      .setTranslation([bx, by, bz]),
  );

  await io.write(SALIDA, doc);

  console.log(`Módulo adaptado → ${SALIDA}`);
  console.log(resumen.join('\n'));
  console.log('Nodos del contrato: SPAWN, OBRA_01…08, PARADA_01…08, COL_muro_* (4), COL_banca, PISO_sala1');
}

main().catch((error) => {
  console.error('Error al adaptar el módulo:', error.message);
  process.exit(1);
});
