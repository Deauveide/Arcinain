// Navegación de escritorio y celular.
//   Escritorio: WASD o flechas para moverse; Q/E o flechas izquierda/derecha para girar;
//               ratón con puntero bloqueado para mirar.
//   Celular:    joystick virtual (izquierda) para moverse; arrastrar (derecha) para mirar;
//               tocar el piso o una parada para ir allí.
// El movimiento se comprueba contra las cajas de COL_* (colisiones) con deslizamiento por ejes.

import * as THREE from 'three';
import { guinadaDeDireccion, direccionDeMirada } from './scene.js';

const VELOCIDAD = 2.2;          // m/s al caminar
const VELOCIDAD_CORRER = 3.4;   // m/s con Mayús
const GIRO_TECLADO = 1.8;       // rad/s
const RADIO_CUERPO = 0.28;      // m: distancia mínima a una pared
const ALTURA_OJOS = 1.6;        // m sobre el piso
const ALTURA_CUERPO = 1.7;      // m: rango vertical que bloquea paredes
const SENSIBILIDAD_RATON = 0.0022;
const SENSIBILIDAD_TACTIL = 0.005;
const LIMITE_PITCH = 1.35;      // rad: no mirar del todo hacia arriba o abajo
const RADIO_JOYSTICK = 60;      // px

export class Navegacion {
  /**
   * @param {object} opciones
   * @param {THREE.PerspectiveCamera} opciones.camara
   * @param {HTMLElement} opciones.lienzo Elemento canvas donde se captura el puntero.
   * @param {object} opciones.datos Resultado de cargarSala() más marcadoresParada.
   * @param {boolean} opciones.movil Modo celular (joystick y toques).
   * @param {HTMLElement} [opciones.joystick] Base visual del joystick.
   * @param {HTMLElement} [opciones.palo] Palo visual del joystick.
   */
  constructor({ camara, lienzo, datos, movil, joystick, palo }) {
    this.camara = camara;
    this.lienzo = lienzo;
    this.datos = datos;
    this.movil = movil;
    this.joystickDom = joystick;
    this.paloDom = palo;

    this.posicion = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.suelo = 0;
    this.activo = false;

    this.teclas = new Set();
    this.joy = { x: 0, y: 0, id: null, origenX: 0, origenY: 0 };
    this.mirada = { id: null, ultimoX: 0, ultimoY: 0, desplazamiento: 0, inicio: 0 };

    this.rayo = new THREE.Raycaster();
    this._vincularEventos();
  }

  // ------------------------------------------------------------ API pública

  /** Coloca al visitante en una posición y orientación (horizontal). */
  colocar(x, z, yaw) {
    this.posicion.set(x, 0, z);
    this.yaw = yaw;
    this.pitch = 0;
    this.suelo = this._sueloEn(x, z);
    this.posicion.y = this.suelo;
    this._aplicarCamara();
  }

  /** Se va a un nodo PARADA_xx o SPAWN del GLB, mirando en su dirección. */
  irANodo(nodo) {
    const pos = nodo.getWorldPosition(new THREE.Vector3());
    const dir = direccionDeMirada(nodo);
    this.colocar(pos.x, pos.z, guinadaDeDireccion(dir.x, dir.z));
  }

  /** Se mueve cada fotograma. dt en segundos. */
  update(dt) {
    if (!this.activo) return;
    const paso = Math.min(dt, 0.05);   // evita saltos grandes si la pestaña se pausó

    // Giro por teclado
    if (this.teclas.has('KeyQ') || this.teclas.has('ArrowLeft')) this.yaw += GIRO_TECLADO * paso;
    if (this.teclas.has('KeyE') || this.teclas.has('ArrowRight')) this.yaw -= GIRO_TECLADO * paso;

    // Intención de movimiento: adelante/atrás (az) y lateral (ax)
    let az = 0;
    let ax = 0;
    if (this.teclas.has('KeyW') || this.teclas.has('ArrowUp')) az += 1;
    if (this.teclas.has('KeyS') || this.teclas.has('ArrowDown')) az -= 1;
    if (this.teclas.has('KeyD')) ax += 1;
    if (this.teclas.has('KeyA')) ax -= 1;
    // Joystick (celular): y hacia arriba es adelante
    az += -this.joy.y;
    ax += this.joy.x;

    const longitud = Math.hypot(ax, az);
    if (longitud > 1) {
      ax /= longitud;
      az /= longitud;
    }
    if (longitud > 0.001) {
      const velocidad = this.teclas.has('ShiftLeft') || this.teclas.has('ShiftRight') ? VELOCIDAD_CORRER : VELOCIDAD;
      // Ejes horizontales de la vista: adelante = (-sen yaw, -cos yaw), derecha = (cos yaw, -sen yaw)
      const seno = Math.sin(this.yaw);
      const coseno = Math.cos(this.yaw);
      const dx = (-seno * az + coseno * ax) * velocidad * paso;
      const dz = (-coseno * az - seno * ax) * velocidad * paso;

      // Deslizamiento: probar cada eje por separado para no quedarse pegado a una pared
      if (!this._colisiona(this.posicion.x + dx, this.posicion.z)) this.posicion.x += dx;
      if (!this._colisiona(this.posicion.x, this.posicion.z + dz)) this.posicion.z += dz;
    }

    this.suelo = this._sueloEn(this.posicion.x, this.posicion.z);
    this._aplicarCamara();
  }

  // ------------------------------------------------------------ internos

  _aplicarCamara() {
    this.pitch = THREE.MathUtils.clamp(this.pitch, -LIMITE_PITCH, LIMITE_PITCH);
    this.posicion.y = this.suelo;
    this.camara.position.set(this.posicion.x, this.suelo + ALTURA_OJOS, this.posicion.z);
    this.camara.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  /** ¿El cuerpo del visitante en (x, z) choca con alguna caja de colisión? */
  _colisiona(x, z) {
    const baseY = this.suelo + 0.1;
    const topeY = this.suelo + ALTURA_CUERPO;
    for (const caja of this.datos.cajasColision) {
      if (caja.max.y < baseY || caja.min.y > topeY) continue;
      if (x > caja.min.x - RADIO_CUERPO && x < caja.max.x + RADIO_CUERPO &&
          z > caja.min.z - RADIO_CUERPO && z < caja.max.z + RADIO_CUERPO) {
        return true;
      }
    }
    return false;
  }

  /** Altura del piso bajo (x, z), buscando hacia abajo entre las mallas PISO_*. */
  _sueloEn(x, z) {
    if (this.datos.pisos.length === 0) return this.suelo;
    this.rayo.set(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0));
    const impactos = this.rayo.intersectObjects(this.datos.pisos, false);
    return impactos.length > 0 ? impactos[0].point.y : this.suelo;
  }

  _vincularEventos() {
    window.addEventListener('keydown', (e) => {
      if (!this.activo) return;
      this.teclas.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.teclas.delete(e.code));
    window.addEventListener('blur', () => this.teclas.clear());

    if (this.movil) {
      this._vincularTactil();
    } else {
      this._vincularRaton();
    }
  }

  _vincularRaton() {
    // Clic en el lienzo bloquea el puntero para mirar libremente
    this.lienzo.addEventListener('click', () => {
      if (this.activo && document.pointerLockElement !== this.lienzo) {
        Promise.resolve(this.lienzo.requestPointerLock?.()).catch(() => {});
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.activo || document.pointerLockElement !== this.lienzo) return;
      this.yaw -= e.movementX * SENSIBILIDAD_RATON;
      this.pitch -= e.movementY * SENSIBILIDAD_RATON;
      this._aplicarCamara();
    });
  }

  _vincularTactil() {
    const L = this.lienzo;
    L.addEventListener('pointerdown', (e) => {
      if (!this.activo) return;
      const mitadX = window.innerWidth * 0.45;
      const enJoystick = e.clientX < mitadX && e.clientY > window.innerHeight * 0.35;
      if (enJoystick && this.joy.id === null) {
        this.joy.id = e.pointerId;
        this.joy.origenX = e.clientX;
        this.joy.origenY = e.clientY;
        this._mostrarJoystick(e.clientX, e.clientY);
      } else if (this.mirada.id === null) {
        this.mirada.id = e.pointerId;
        this.mirada.ultimoX = e.clientX;
        this.mirada.ultimoY = e.clientY;
        this.mirada.desplazamiento = 0;
        this.mirada.inicio = performance.now();
      }
      // Captura del puntero: evita perder el arrastre si el dedo sale del lienzo (si falla, no es grave)
      try { L.setPointerCapture(e.pointerId); } catch { /* puntero no válido, p. ej. evento sintético */ }
    });

    L.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.joy.id) {
        let dx = e.clientX - this.joy.origenX;
        let dy = e.clientY - this.joy.origenY;
        const distancia = Math.hypot(dx, dy);
        if (distancia > RADIO_JOYSTICK) {
          dx = (dx / distancia) * RADIO_JOYSTICK;
          dy = (dy / distancia) * RADIO_JOYSTICK;
        }
        this.joy.x = dx / RADIO_JOYSTICK;
        this.joy.y = dy / RADIO_JOYSTICK;
        if (this.paloDom) {
          this.paloDom.style.transform = `translate(${dx}px, ${dy}px)`;
        }
      } else if (e.pointerId === this.mirada.id && this.activo) {
        const dx = e.clientX - this.mirada.ultimoX;
        const dy = e.clientY - this.mirada.ultimoY;
        this.mirada.ultimoX = e.clientX;
        this.mirada.ultimoY = e.clientY;
        this.mirada.desplazamiento += Math.abs(dx) + Math.abs(dy);
        this.yaw -= dx * SENSIBILIDAD_TACTIL;
        this.pitch -= dy * SENSIBILIDAD_TACTIL;
        this._aplicarCamara();
      }
    });

    const soltar = (e) => {
      if (e.pointerId === this.joy.id) {
        this.joy.id = null;
        this.joy.x = 0;
        this.joy.y = 0;
        this._ocultarJoystick();
      } else if (e.pointerId === this.mirada.id) {
        const duracion = performance.now() - this.mirada.inicio;
        // Un toque corto y casi sin arrastre = ir a ese punto
        if (this.mirada.desplazamiento < 10 && duracion < 350 && e.type === 'pointerup') {
          this._tocar(e.clientX, e.clientY);
        }
        this.mirada.id = null;
      }
    };
    L.addEventListener('pointerup', soltar);
    L.addEventListener('pointercancel', soltar);
  }

  /** Toque en pantalla: si cae sobre una parada, va a esa parada; si cae sobre el piso, va ahí. */
  _tocar(clientX, clientY) {
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
    this.rayo.setFromCamera(ndc, this.camara);
    const objetivos = [...(this.datos.marcadoresParada ?? []), ...this.datos.pisos];
    const impactos = this.rayo.intersectObjects(objetivos, false);
    if (impactos.length === 0) return;

    const primero = impactos[0].object;
    if (primero.userData.parada) {
      this.irANodo(this.datos.paradas.get(primero.userData.parada));
    } else {
      // Piso: nos paramos en el punto tocado, conservando la mirada actual
      const p = impactos[0].point;
      this.colocar(p.x, p.z, this.yaw);
    }
  }

  _mostrarJoystick(x, y) {
    if (!this.joystickDom) return;
    this.joystickDom.hidden = false;
    this.joystickDom.style.left = `${x}px`;
    this.joystickDom.style.top = `${y}px`;
    if (this.paloDom) this.paloDom.style.transform = 'translate(0px, 0px)';
  }

  _ocultarJoystick() {
    if (this.joystickDom) this.joystickDom.hidden = true;
  }
}
