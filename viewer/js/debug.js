// Modo desarrollo (?debug=1): FPS, triángulos, draw calls, texturas en memoria y
// visualización de colisiones y marcadores. No afecta al recorrido normal.

import * as THREE from 'three';
import { t } from './i18n.js';

/**
 * Crea el panel de depuración y devuelve { actualizar(renderer), colisiones, marcadores }.
 * @param {object} opciones
 * @param {THREE.Scene} opciones.escena
 * @param {object} opciones.datos Resultado de cargarSala().
 * @param {HTMLElement} opciones.panel Contenedor del panel (#debug-panel).
 */
export function crearDebug({ escena, datos, panel }) {
  panel.hidden = false;
  panel.innerHTML = `
    <h2>${t('debug.titulo')}</h2>
    <div data-fps>${t('debug.fps')}: –</div>
    <div data-tris>${t('debug.triangulos')}: –</div>
    <div data-draws>${t('debug.draws')}: –</div>
    <div data-texturas>${t('debug.texturas')}: –</div>
    <label><input type="checkbox" data-colisiones> ${t('debug.colisiones')}</label>
    <label><input type="checkbox" data-marcadores> ${t('debug.marcadores')}</label>
  `;

  // Cajas de colisión en rojo (wireframe), ocultas al inicio
  const lineasColision = new THREE.Group();
  lineasColision.name = 'debug_colisiones';
  lineasColision.visible = false;
  for (const caja of datos.cajasColision) {
    lineasColision.add(new THREE.Box3Helper(caja, 0xff3355));
  }
  escena.add(lineasColision);

  // Ejes en SPAWN, paradas y obras para verificar orientación
  const marcadores = new THREE.Group();
  marcadores.name = 'debug_marcadores';
  marcadores.visible = false;
  const nodos = [datos.spawn, ...datos.paradas.values(), ...datos.obras.values()];
  for (const nodo of nodos) {
    const ejes = new THREE.AxesHelper(0.6);
    nodo.getWorldPosition(ejes.position);
    nodo.getWorldQuaternion(ejes.quaternion);
    marcadores.add(ejes);
  }
  escena.add(marcadores);

  // Los discos de parada se hacen visibles solo en depuración
  const discos = datos.marcadoresParada ?? [];

  const q = (sel) => panel.querySelector(sel);
  q('[data-colisiones]').addEventListener('change', (e) => { lineasColision.visible = e.target.checked; });
  q('[data-marcadores]').addEventListener('change', (e) => {
    marcadores.visible = e.target.checked;
    discos.forEach((d) => { d.material.opacity = e.target.checked ? 0.35 : 0.0; });
  });

  // FPS: contar fotogramas cada medio segundo
  let fotogramas = 0;
  let ultimo = performance.now();
  let fps = 0;

  return {
    /** Llamar una vez por fotograma tras render(). */
    actualizar(renderer) {
      fotogramas += 1;
      const ahora = performance.now();
      if (ahora - ultimo >= 500) {
        fps = Math.round((fotogramas * 1000) / (ahora - ultimo));
        fotogramas = 0;
        ultimo = ahora;
        const info = renderer.info;
        q('[data-fps]').textContent = `${t('debug.fps')}: ${fps}`;
        q('[data-tris]').textContent = `${t('debug.triangulos')}: ${info.render.triangles.toLocaleString('es-CO')}`;
        q('[data-draws]').textContent = `${t('debug.draws')}: ${info.render.calls}`;
        q('[data-texturas]').textContent = `${t('debug.texturas')}: ${info.memory.textures}`;
      }
    },
  };
}
