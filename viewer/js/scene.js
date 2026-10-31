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
import { t } from './i18n.js';

const RE_OBRA = /^OBRA_\d+$/;
const RE_PARADA = /^PARADA_\d+$/;

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
    colisiones: [],            // malla COL_* (oculta)
    cajasColision: [],         // Box3 en coordenadas de mundo, para el movimiento
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

  datos.cajasColision = datos.colisiones.map((malla) => new THREE.Box3().setFromObject(malla));

  return datos;
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
 * Crea un marcador provisional para cada obra: un plano con su código, orientado
 * hacia el interior de la sala. Sirve para verificar posición y orientación.
 * Se reemplaza por la imagen real en la fase 2.
 */
export function crearMarcadoresObra(datos, anchoM = 1.0, altoM = 0.7) {
  const grupo = new THREE.Group();
  grupo.name = 'marcadores_obra';

  for (const [codigo, nodo] of datos.obras) {
    const posicion = nodo.getWorldPosition(new THREE.Vector3());
    const dir = direccionDeMirada(nodo);

    const lienzo = document.createElement('canvas');
    lienzo.width = 512;
    lienzo.height = 360;
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#d9d4c7';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.strokeStyle = '#8a6d2f';
    ctx.lineWidth = 14;
    ctx.strokeRect(14, 14, lienzo.width - 28, lienzo.height - 28);
    ctx.fillStyle = '#2b2a27';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Texto genérico ("Obra"), sin el código: el código sigue en el nombre del nodo (contrato).
    ctx.fillText(t('obras.marcador'), lienzo.width / 2, lienzo.height / 2);

    const textura = new THREE.CanvasTexture(lienzo);
    textura.colorSpace = THREE.SRGBColorSpace;

    // Las obras no reciben luz ni tone mapping: su color no cambia con la sala (decisión D-04).
    const material = new THREE.MeshBasicMaterial({ map: textura, toneMapped: false, side: THREE.FrontSide });
    const plano = new THREE.Mesh(new THREE.PlaneGeometry(anchoM, altoM), material);
    plano.name = `marcador_${codigo}`;

    // Un poco delante de la pared para evitar parpadeo (z-fighting).
    plano.position.copy(posicion).addScaledVector(dir, 0.02);
    // El +Z local del plano apunta a la sala (hacia dir): así se ve desde el interior.
    plano.lookAt(plano.position.clone().add(dir));
    grupo.add(plano);
  }

  datos.raiz.add(grupo);
  return grupo;
}

/**
 * Pone una imagen real en el marcador de una obra (prueba de exposición).
 * Conserva la altura del marcador y ajusta el ancho a la proporción de la imagen,
 * para no estirarla. No toca obras.json ni recorrido.json.
 * @returns {Promise<void>} Resuelve cuando la imagen ya está aplicada.
 */
export async function aplicarImagenObra(datos, codigo, url, altoM = 0.7) {
  const plano = datos.raiz.getObjectByName(`marcador_${codigo}`);
  if (!plano) throw new Error(`No existe el marcador de ${codigo}.`);

  const textura = await new THREE.TextureLoader().loadAsync(url);
  textura.colorSpace = THREE.SRGBColorSpace;

  const { width, height } = textura.image;
  plano.material.map = textura;
  plano.material.needsUpdate = true;
  // La geometría base mide 1 m de ancho; se escala en X para la proporción real.
  plano.scale.x = (altoM * (width / height)) / 1.0;
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
