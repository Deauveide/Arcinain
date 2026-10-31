// Arranque del visor: detección de dispositivo, modo y calidad, carga de la sala,
// pantalla de inicio y bucle de render.
// Fase 1: escritorio y celular. VR, audio, catálogo y calidad manual llegan en fases posteriores.

import * as THREE from 'three';
import { cargarIdioma, t, aplicarTraducciones } from './i18n.js';
import { cargarSala, crearMarcadoresObra, crearMarcadoresParada } from './scene.js';
import { Navegacion } from './navigation.js';
import { crearDebug } from './debug.js';

const parametros = new URLSearchParams(location.search);
const ES_DEBUG = parametros.get('debug') === '1';

// GLB de la sala: por defecto sala.glb; ?sala=nombre.glb elige otro de viewer/assets/models/
const SALA_SOLICITADA = parametros.get('sala') ?? 'sala.glb';
const NOMBRE_SALA = /^[\w.-]+\.glb$/.test(SALA_SOLICITADA) ? SALA_SOLICITADA : 'sala.glb';

// Perfiles de calidad: tope de pixel ratio y distancia de dibujado (metros)
const PERFILES = {
  bajo: { pixelRatio: 1.0, lejos: 60 },
  medio: { pixelRatio: 1.5, lejos: 100 },
  alto: { pixelRatio: 2.0, lejos: 150 },
};

const $ = (id) => document.getElementById(id);

// Detección de dispositivo: un puntero "grueso" o pantalla táctil = celular
const ES_MOVIL = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
document.body.dataset.modo = ES_MOVIL ? 'movil' : 'escritorio';

/** Elige perfil: parámetro ?calidad= o automático según el dispositivo. */
function elegirPerfil() {
  const manual = parametros.get('calidad');
  if (manual && PERFILES[manual]) return manual;
  return ES_MOVIL ? 'medio' : 'alto';
}

function mostrarEstado(texto, esError = false) {
  const estado = $('estado');
  estado.textContent = texto;
  estado.classList.toggle('error', esError);
}

function hayWebGL() {
  try {
    const prueba = document.createElement('canvas');
    return !!(prueba.getContext('webgl2') || prueba.getContext('webgl'));
  } catch {
    return false;
  }
}

async function iniciar() {
  await cargarIdioma();
  aplicarTraducciones();
  document.querySelector('[data-instrucciones]').textContent =
    ES_MOVIL ? t('inicio.instrucciones_movil') : t('inicio.instrucciones_escritorio');
  document.querySelector('[data-ayuda]').textContent =
    ES_MOVIL ? t('hud.ayuda_movil') : t('hud.ayuda_escritorio');

  // Avisos previos a la carga
  if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    mostrarEstado(t('errores.sin_https'));
  }
  if (!hayWebGL()) {
    mostrarEstado(t('errores.sin_webgl'), true);
    return;
  }

  // Renderer: sRGB de salida y tone mapping neutro (decisión D-03)
  const perfil = PERFILES[elegirPerfil()];
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, perfil.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = false;   // sin sombras en tiempo real (especificación)
  $('vista').appendChild(renderer.domElement);

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0x16171a);

  const camara = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, perfil.lejos);

  // Luces mínimas y sin sombras: la arquitectura provisional lo necesita para verse; el modelo real usará luz horneada.
  escena.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.6));
  const sol = new THREE.DirectionalLight(0xffffff, 1.0);
  sol.position.set(3, 6, 2);
  escena.add(sol);

  // Carga de la sala con progreso
  $('btn-entrar').disabled = true;
  mostrarEstado(t('carga.cargando'));
  let datos;
  try {
    datos = await cargarSala(`./assets/models/${NOMBRE_SALA}`, (fraccion) => {
      const pct = Math.round(fraccion * 100);
      $('barra-progreso').style.width = `${pct}%`;
      mostrarEstado(t('carga.progreso', { pct }));
    });
  } catch (error) {
    console.error('[sala] Error al cargar:', error);
    mostrarEstado(t('errores.carga_sala'), true);
    return;
  }
  escena.add(datos.raiz);
  crearMarcadoresObra(datos);
  crearMarcadoresParada(datos);
  $('barra-progreso').style.width = '100%';
  mostrarEstado(t('carga.lista'));
  $('btn-entrar').disabled = false;

  // Navegación (se activa al pulsar Entrar)
  const nav = new Navegacion({
    camara,
    lienzo: renderer.domElement,
    datos,
    movil: ES_MOVIL,
    joystick: $('joystick'),
    palo: $('joystick-palo'),
  });
  nav.irANodo(datos.spawn);

  // Depuración opcional
  const debug = ES_DEBUG ? crearDebug({ escena, datos, panel: $('debug-panel') }) : null;
  // Solo en depuración: deja inspeccionar al visitante desde la consola (window.__visor)
  if (ES_DEBUG) window.__visor = { nav, camara, datos };

  // Ajuste al cambiar el tamaño de la ventana (también al girar el celular).
  // En vertical el FOV (vertical en Three.js) se amplía para no perder el campo lateral.
  const ajustarCamara = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    const aspecto = window.innerWidth / window.innerHeight;
    camara.aspect = aspecto;
    camara.fov = aspecto < 0.8 ? 80 : 70;
    camara.updateProjectionMatrix();
  };
  ajustarCamara();
  window.addEventListener('resize', ajustarCamara);

  // Entrar: oculta la pantalla de inicio y activa la navegación
  $('btn-entrar').addEventListener('click', () => {
    $('pantalla-inicio').hidden = true;
    $('hud').hidden = false;
    nav.activo = true;
    if (!ES_MOVIL) {
      // El navegador puede rechazar el bloqueo del puntero (p. ej. sin gesto válido): la visita sigue con teclado
      Promise.resolve(renderer.domElement.requestPointerLock?.()).catch(() => {});
    }
    renderer.domElement.focus?.();
  });

  // Bucle de render (renderer.setAnimationLoop se usará también para WebXR en la fase 3)
  // Tiempo entre fotogramas calculado a mano (THREE.Clock está obsoleto en esta versión)
  let ultimoInstante = performance.now();
  renderer.setAnimationLoop(() => {
    const ahora = performance.now();
    const dt = (ahora - ultimoInstante) / 1000;
    ultimoInstante = ahora;
    nav.update(dt);
    renderer.render(escena, camara);
    debug?.actualizar(renderer);
  });
}

iniciar().catch((error) => {
  console.error('[visor] Error inesperado:', error);
  mostrarEstado(t('errores.carga_sala'), true);
});
