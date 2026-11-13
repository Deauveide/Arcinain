// Carga del GLB de la sala, clasificación de nodos según el contrato y obras de marcador.
//
// Contrato (ver README, sección 2):
//   SPAWN, OBRA_xx, PARADA_xx  → empties: posición y orientación.
//   COL_*                      → colisiones: se ocultan en el visor.
//   PISO_*                     → superficies caminables (teletransporte).
//   MURO_*, TECHO_*, ZONA_*    → arquitectura visible.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { prepararTriangulos } from './colisiones.js';

const RE_OBRA = /^OBRA_\d+$/;
const RE_PARADA = /^PARADA_\d+$/;
const RE_CURATORIAL = /^CURATORIAL_modulo\d+$/;

/**
 * Carga el GLB y devuelve los datos ya clasificados.
 * @param {string} url Ruta al GLB (relativa al index.html).
 * @param {(fraccion: number) => void} [alProgreso] Progreso de descarga entre 0 y 1.
 */
export async function cargarSala(url, alProgreso) {
  const cargador = new GLTFLoader();

  // Decodificadores locales (sin CDN). KTX2 se añade en la fase 6.
  const draco = new DRACOLoader();
  draco.setDecoderPath('./vendor/three/examples/jsm/libs/draco/');
  cargador.setDRACOLoader(draco);
  cargador.setMeshoptDecoder(MeshoptDecoder);

  const gltf = await cargador.loadAsync(url, (evento) => {
    if (alProgreso && evento.lengthComputable) alProgreso(evento.loaded / evento.total);
  });
  draco.dispose();

  const raiz = gltf.scene;
  raiz.updateMatrixWorld(true);

  const datos = {
    raiz,
    spawn: null,               // Object3D de SPAWN
    obras: new Map(),          // "OBRA_01" → Object3D
    paradas: new Map(),        // "PARADA_01" → Object3D
    curatoriales: new Map(),   // "CURATORIAL_modulo1" → Object3D (texto del tótem, D-37)
    colisiones: [],            // malla COL_* (oculta)
    triangulosColision: [],    // triángulos de COL_* en mundo, para el movimiento (colisiones.js)
    pisos: [],                 // mallas PISO_* (caminables)
  };

  raiz.traverse((objeto) => {
    const nombre = objeto.name;
    if (!nombre) return;

    if (nombre === 'SPAWN') {
      datos.spawn = objeto;
    } else if (RE_OBRA.test(nombre)) {
      datos.obras.set(nombre, objeto);
    } else if (RE_PARADA.test(nombre)) {
      datos.paradas.set(nombre, objeto);
    } else if (RE_CURATORIAL.test(nombre)) {
      datos.curatoriales.set(nombre, objeto);
    } else if (nombre.startsWith('COL_') && objeto.isMesh) {
      objeto.visible = false;  // invisible en el visor; sirve solo para colisiones
      datos.colisiones.push(objeto);
    } else if (nombre.startsWith('PISO_') && objeto.isMesh) {
      datos.pisos.push(objeto);
    }
  });

  if (!datos.spawn) {
    throw new Error('El GLB no tiene el nodo SPAWN (contrato del README, sección 2).');
  }

  datos.triangulosColision = prepararTriangulos(posicionesDeMundo(datos.colisiones));

  return datos;
}

/**
 * Vértices de todos los triángulos de las mallas, en coordenadas de mundo (x, y, z por vértice).
 * Respeta la rotación y la escala de cada nodo: un muro girado en Blender colisiona girado.
 */
function posicionesDeMundo(mallas) {
  const salida = [];
  const v = new THREE.Vector3();
  for (const malla of mallas) {
    const geometria = malla.geometry;
    const pos = geometria.getAttribute('position');
    const indice = geometria.getIndex();
    const total = indice ? indice.count : pos.count;
    for (let i = 0; i < total; i++) {
      v.fromBufferAttribute(pos, indice ? indice.getX(i) : i).applyMatrix4(malla.matrixWorld);
      salida.push(v.x, v.y, v.z);
    }
  }
  return salida;
}

/** Dirección de mundo del eje -Z local de un objeto (hacia donde "mira" el empty). */
export function direccionDeMirada(objeto) {
  const cuaternion = objeto.getWorldQuaternion(new THREE.Quaternion());
  return new THREE.Vector3(0, 0, -1).applyQuaternion(cuaternion).normalize();
}

/** Ángulo de guiñada (yaw) que hace mirar hacia la dirección (dx, dz). Misma convención que el exportador. */
export function guinadaDeDireccion(dx, dz) {
  return Math.atan2(-dx, -dz);
}

/**
 * Crea marcadores de parada: discos casi transparentes que se pueden tocar para ir allí.
 * Son visibles solo en modo depuración (opacidad controlada desde debug.js).
 */
export function crearMarcadoresParada(datos) {
  const grupo = new THREE.Group();
  grupo.name = 'marcadores_parada';
  const geometria = new THREE.CylinderGeometry(0.35, 0.35, 0.02, 32);

  for (const [codigo, nodo] of datos.paradas) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xe0b04a,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    const disco = new THREE.Mesh(geometria, material);
    disco.name = `marcador_${codigo}`;
    disco.position.copy(nodo.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, 0.01, 0));
    disco.userData.parada = codigo;
    grupo.add(disco);
  }

  datos.raiz.add(grupo);
  datos.marcadoresParada = [...grupo.children];
  return grupo;
}
