// Optimiza la exportación de Blender para escritorio, celular y Quest, y escribe sala.glb.
//
// Entrada:  blender/sala-export.glb      (exportación directa de blender/Museo cupulas.blend)
// Salida:   viewer/assets/models/sala.glb
//
// Por qué: el museo tiene cientos de objetos (focos, rieles, paneles, muros…) y cada uno es
// una llamada de dibujo por cuadro. En el Quest eso es lo que más pesa, no los triángulos.
// Aquí se fusiona todo lo estático, respetando el contrato de nombres (README, sección 2):
//   - Los empties del contrato (SPAWN, OBRA_xx, PARADA_xx, ZONA_*, CURATORIAL_*) no se tocan.
//   - Todos los COL_* se fusionan en una sola malla cuyo nodo sigue empezando por COL_.
//   - Todos los PISO_* se fusionan en una malla por material, con nombre PISO_*.
//   - El resto de la arquitectura se fusiona en una malla por material.
// Además:
//   - KHR_materials_transmission (tragaluz) se cambia por transparencia simple: la transmisión
//     obliga a Three.js a renderizar la escena dos veces por cuadro.
//   - Materiales procedurales de Blender que el exportador no puede llevar (salen blancos)
//     reciben un color de respaldo (tabla COLOR_RESPALDO).
//
// Uso: npm run tools:optimizar [entrada.glb] [salida.glb]

import { NodeIO } from '@gltf-transform/core';
import { KHRMaterialsTransmission } from '@gltf-transform/extensions';
import { dedup, flatten, join, prune, weld } from '@gltf-transform/functions';
import { stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRADA = process.argv[2] ?? resolve(RAIZ, 'blender/sala-export.glb');
const SALIDA = process.argv[3] ?? resolve(RAIZ, 'viewer/assets/models/sala.glb');

// Color lineal [r, g, b] para materiales cuyo color en Blender sale de nodos procedurales.
const COLOR_RESPALDO = {
  Piso_baldosa_barro: [0.42, 0.17, 0.09],
};
const OPACIDAD_TRAGALUZ = 0.45;

/** Cuenta las llamadas de dibujo aproximadas: una por primitiva de cada nodo con malla. */
function llamadasDeDibujo(doc) {
  let n = 0;
  for (const nodo of doc.getRoot().listNodes()) n += nodo.getMesh()?.listPrimitives().length ?? 0;
  return n;
}

const io = new NodeIO().registerExtensions([KHRMaterialsTransmission]);
const doc = await io.read(ENTRADA);
const raiz = doc.getRoot();
const escena = raiz.getDefaultScene() ?? raiz.listScenes()[0];
const antes = { nodos: raiz.listNodes().length, llamadas: llamadasDeDibujo(doc) };

// 1) Materiales: transmisión → transparencia; colores de respaldo
for (const material of raiz.listMaterials()) {
  const transmision = material.getExtension('KHR_materials_transmission');
  if (transmision) {
    material.setExtension('KHR_materials_transmission', null);
    const [r, g, b] = material.getBaseColorFactor();
    material.setBaseColorFactor([r, g, b, OPACIDAD_TRAGALUZ]).setAlphaMode('BLEND');
  }
  const respaldo = COLOR_RESPALDO[material.getName()];
  if (respaldo && !material.getBaseColorTexture()) {
    material.setBaseColorFactor([...respaldo, material.getBaseColorFactor()[3]]);
  }
}
for (const ext of raiz.listExtensionsUsed()) {
  if (ext.extensionName === 'KHR_materials_transmission') ext.dispose();
}

// 2) Todo a la raíz de la escena con su transformación de mundo, y mallas compartidas unificadas
// cleanup: false en todo el archivo: la limpieza interna de flatten/join borra los nodos hoja
// sin malla, que son justamente los empties del contrato (SPAWN, OBRA_xx…).
await doc.transform(dedup(), flatten({ cleanup: false }));

// 3) Agrupar los nodos con malla bajo tres padres; join solo fusiona hermanos
const grupos = {
  COL: doc.createNode('grupo_colisiones'),
  PISO: doc.createNode('grupo_pisos'),
  ARQ: doc.createNode('grupo_arquitectura'),
};
for (const nodo of [...escena.listChildren()]) {
  if (!nodo.getMesh()) continue;   // empties del contrato: se quedan como están
  const nombre = nodo.getName();
  const grupo = nombre.startsWith('COL_') ? grupos.COL : nombre.startsWith('PISO_') ? grupos.PISO : grupos.ARQ;
  escena.removeChild(nodo);
  grupo.addChild(nodo);
}
for (const grupo of Object.values(grupos)) escena.addChild(grupo);

// Sin texturas en la sala, las UV solo impiden fusionar mallas del mismo material
// (unas las traen y otras no). Si algún material usa textura, se conservan.
if (raiz.listTextures().length === 0) {
  for (const malla of raiz.listMeshes()) {
    for (const prim of malla.listPrimitives()) {
      for (const semantica of prim.listSemantics()) {
        if (semantica.startsWith('TEXCOORD_')) prim.setAttribute(semantica, null);
      }
    }
  }
}

// cleanup: false → join no ejecuta su prune interno, que borraría los empties del contrato
// (nodos hoja sin malla). keepLeaves: true los conserva en el prune explícito.
await doc.transform(join({ keepNamed: false, cleanup: false }), weld(), prune({ keepLeaves: true }), dedup());

// 4) Quitar los nodos que quedaron vacíos dentro de los grupos tras fusionar, y dar nombres
//    claros a las mallas fusionadas (los prefijos COL_ y PISO_ se conservan)
for (const [prefijo, grupo] of Object.entries(grupos)) {
  for (const nodo of grupo.listChildren()) if (!nodo.getMesh()) nodo.dispose();
  grupo.listChildren().forEach((nodo, i) => {
    const material = nodo.getMesh()?.listPrimitives()[0]?.getMaterial()?.getName() ?? 'sin_material';
    const nombre = prefijo === 'ARQ' ? `ARQ_${material}` : `${prefijo}_museo_${i + 1}`;
    nodo.setName(nombre);
    nodo.getMesh()?.setName(nombre);
  });
}

await io.write(SALIDA, doc);

const despues = { nodos: raiz.listNodes().length, llamadas: llamadasDeDibujo(doc) };
const [tamEntrada, tamSalida] = await Promise.all([stat(ENTRADA), stat(SALIDA)]);
console.log(`Entrada: ${ENTRADA}`);
console.log(`Salida:  ${SALIDA}`);
console.log(`Nodos: ${antes.nodos} → ${despues.nodos} · Llamadas de dibujo: ${antes.llamadas} → ${despues.llamadas}`);
console.log(`Tamaño: ${(tamEntrada.size / 1024).toFixed(0)} KB → ${(tamSalida.size / 1024).toFixed(0)} KB`);
