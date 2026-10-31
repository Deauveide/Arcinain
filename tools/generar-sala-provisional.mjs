// Genera viewer/assets/models/sala.glb: una sala provisional con la MISMA convención
// de nombres que el contrato del README. Cuando llegue el modelo real de Blender,
// basta con reemplazar ese archivo; el código del visor no cambia.
//
// Convención de ejes (glTF): Y arriba; el visor "avanza" hacia -Z.
// Los empties SPAWN, PARADA_xx y OBRA_xx usan su eje -Z local como dirección:
//   - SPAWN y PARADA_xx: hacia donde mira el visitante.
//   - OBRA_xx: hacia el interior de la sala (hacia donde se pone el visitante).
//
// Uso: npm run tools:sala

import { Document, NodeIO } from '@gltf-transform/core';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = resolve(RAIZ, 'viewer/assets/models/sala.glb');

// ---------------------------------------------------------------- geometría

/** Caja alineada a ejes, centrada en (cx, cy, cz) con tamaño (sx, sy, sz). */
function geometriaCaja(doc, buffer, sx, sy, sz) {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  // 6 caras x 4 vértices. Cada cara: normal + 4 esquinas en orden antihorario visto desde fuera.
  const caras = [
    { n: [0, 0, 1],  v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
    { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
    { n: [1, 0, 0],  v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
    { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
    { n: [0, 1, 0],  v: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
    { n: [0, -1, 0], v: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] },
  ];
  const posiciones = [];
  const normales = [];
  const indices = [];
  caras.forEach((cara, i) => {
    cara.v.forEach((p) => {
      posiciones.push(...p);
      normales.push(...cara.n);
    });
    const b = i * 4;
    indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const accPos = doc.createAccessor().setType('VEC3').setArray(new Float32Array(posiciones)).setBuffer(buffer);
  const accNor = doc.createAccessor().setType('VEC3').setArray(new Float32Array(normales)).setBuffer(buffer);
  const accIdx = doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(indices)).setBuffer(buffer);
  return { accPos, accNor, accIdx };
}

/** Crea una malla con una caja y la asigna a un material. */
function mallaCaja(doc, buffer, nombre, material, sx, sy, sz) {
  const { accPos, accNor, accIdx } = geometriaCaja(doc, buffer, sx, sy, sz);
  const primitiva = doc
    .createPrimitive()
    .setAttribute('POSITION', accPos)
    .setAttribute('NORMAL', accNor)
    .setIndices(accIdx)
    .setMaterial(material);
  return doc.createMesh(nombre).addPrimitive(primitiva);
}

// ---------------------------------------------------------------- orientación

/**
 * Cuaternión [x, y, z, w] que gira el eje -Z local hacia la dirección (dx, dz) en el plano horizontal.
 * Con rotación Y de ángulo t, el -Z local pasa a (-sen t, 0, -cos t).
 */
function orientarHacia(dx, dz) {
  const t = Math.atan2(-dx, -dz);
  return [0, Math.sin(t / 2), 0, Math.cos(t / 2)];
}

// ---------------------------------------------------------------- escena

/** Dimensiones de la sala provisional (metros). */
const SALA = {
  anchoX: 10,       // de -5 a 5
  fondoZ: 8,        // de -4 a 4
  alto: 3.2,
  grosor: 0.2,
};

// Caras interiores (para colocar obras y paradas sobre ellas)
const INT = {
  xMin: -SALA.anchoX / 2 + SALA.grosor / 2,   // -4.9
  xMax: SALA.anchoX / 2 - SALA.grosor / 2,    //  4.9
  zMin: -SALA.fondoZ / 2 + SALA.grosor / 2,   // -3.9
  zMax: SALA.fondoZ / 2 - SALA.grosor / 2,    //  3.9
};

const ALTURA_OBRA = 1.5;   // centro de la obra, metros sobre el suelo

const OBRAS = [
  { id: 'OBRA_01', pos: [-2.5, ALTURA_OBRA, INT.zMin], dentro: [0, 0, 1] },
  { id: 'OBRA_02', pos: [2.5, ALTURA_OBRA, INT.zMin], dentro: [0, 0, 1] },
  { id: 'OBRA_03', pos: [INT.xMax, ALTURA_OBRA, 0], dentro: [-1, 0, 0] },
  { id: 'OBRA_04', pos: [-2.5, ALTURA_OBRA, INT.zMax], dentro: [0, 0, -1] },
  { id: 'OBRA_05', pos: [INT.xMin, ALTURA_OBRA, 0], dentro: [1, 0, 0] },
];

// Paradas: posición del visitante y hacia dónde mira (dirección horizontal).
const PARADAS = [
  { id: 'PARADA_01', pos: [-2.5, 0, 1.0], mira: [0, 0, -1] },   // hacia OBRA_01
  { id: 'PARADA_02', pos: [3.0, 0, 0], mira: [1, 0, 0] },       // hacia OBRA_03
  { id: 'PARADA_03', pos: [-3.0, 0, 0], mira: [-1, 0, 0] },     // hacia OBRA_05
];

const SPAWN = { id: 'SPAWN', pos: [0, 0, 2.0], mira: [0, 0, -1] };

// ---------------------------------------------------------------- construcción

async function construir() {
  const doc = new Document();
  const buffer = doc.createBuffer();

  const matPiso = doc.createMaterial('MAT_piso').setBaseColorFactor([0.42, 0.36, 0.30, 1]).setRoughnessFactor(0.85).setMetallicFactor(0);
  const matMuro = doc.createMaterial('MAT_muro').setBaseColorFactor([0.90, 0.88, 0.84, 1]).setRoughnessFactor(0.95).setMetallicFactor(0);
  const matTecho = doc.createMaterial('MAT_techo').setBaseColorFactor([0.97, 0.97, 0.96, 1]).setRoughnessFactor(0.95).setMetallicFactor(0);

  const escena = doc.createScene('sala_provisional').setExtras({
    provisional: true,
    version: 1,
    nota: 'Sala provisional generada por tools/generar-sala-provisional.mjs. Reemplazar por sala.glb real.',
  });

  // Nodo contenedor de zona (ZONA_01) con toda la arquitectura provisional.
  const zona = doc.createNode('ZONA_01');
  escena.addChild(zona);

  // Suelo: su cara superior queda en y = 0. Walkable.
  const mPiso = mallaCaja(doc, buffer, 'PISO_sala1', matPiso, SALA.anchoX, SALA.grosor, SALA.fondoZ);
  zona.addChild(doc.createNode('PISO_sala1').setMesh(mPiso).setTranslation([0, -SALA.grosor / 2, 0]));

  // Techo visual, sin colisión.
  const mTecho = mallaCaja(doc, buffer, 'TECHO_sala1', matTecho, SALA.anchoX, SALA.grosor, SALA.fondoZ);
  zona.addChild(doc.createNode('TECHO_sala1').setMesh(mTecho).setTranslation([0, SALA.alto + SALA.grosor / 2, 0]));

  // Muros: visuales (MURO_*) y colisiones (COL_*) con la misma geometría compartida.
  // Los muros cubren las esquinas (se solapan 0.2 m) para que no queden huecos.
  const muros = [
    { sufijo: 'norte', sx: SALA.anchoX + SALA.grosor, sz: SALA.grosor, cx: 0, cz: -SALA.fondoZ / 2 },
    { sufijo: 'sur',   sx: SALA.anchoX + SALA.grosor, sz: SALA.grosor, cx: 0, cz: SALA.fondoZ / 2 },
    { sufijo: 'este',  sx: SALA.grosor, sz: SALA.fondoZ, cx: SALA.anchoX / 2, cz: 0 },
    { sufijo: 'oeste', sx: SALA.grosor, sz: SALA.fondoZ, cx: -SALA.anchoX / 2, cz: 0 },
  ];
  for (const m of muros) {
    const malla = mallaCaja(doc, buffer, `MURO_${m.sufijo}`, matMuro, m.sx, SALA.alto, m.sz);
    const posicion = [m.cx, SALA.alto / 2, m.cz];
    zona.addChild(doc.createNode(`MURO_${m.sufijo}`).setMesh(malla).setTranslation(posicion));
    zona.addChild(doc.createNode(`COL_muro_${m.sufijo}`).setMesh(malla).setTranslation(posicion));
  }

  // Obras: empties con posición y orientación. El tamaño NO va aquí (sale de obras.json).
  for (const o of OBRAS) {
    zona.addChild(
      doc.createNode(o.id).setTranslation(o.pos).setRotation(orientarHacia(o.dentro[0], o.dentro[2]))
    );
  }

  // Paradas y spawn: empties con la dirección de vista en su eje -Z.
  for (const p of PARADAS) {
    zona.addChild(
      doc.createNode(p.id).setTranslation(p.pos).setRotation(orientarHacia(p.mira[0], p.mira[2]))
    );
  }
  zona.addChild(
    doc.createNode(SPAWN.id).setTranslation(SPAWN.pos).setRotation(orientarHacia(SPAWN.mira[0], SPAWN.mira[2]))
  );

  return doc;
}

async function main() {
  const doc = await construir();
  const io = new NodeIO();
  const glb = await io.writeBinary(doc);
  await mkdir(dirname(SALIDA), { recursive: true });
  await writeFile(SALIDA, glb);
  console.log(`Sala provisional escrita en: ${SALIDA} (${glb.byteLength} bytes)`);
}

main().catch((err) => {
  console.error('Error generando la sala provisional:', err);
  process.exit(1);
});
