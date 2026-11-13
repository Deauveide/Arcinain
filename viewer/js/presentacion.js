// Presentación de las obras y del texto curatorial (D-37, D-38, D-39).
//
// Todo se construye a partir de los nodos del contrato (OBRA_xx, CURATORIAL_moduloN): el GLB no
// necesita marcos, fichas ni lámparas, y cambiar el modelo no obliga a tocar este archivo (regla 11).
//
// Por obra:
//   - Imagen a su tamaño real (alto_m / ancho_m de obras.json; marcador genérico si aún no hay datos).
//   - Marco de madera y, en obras sobre papel, paspartú.
//   - Ficha técnica a la IZQUIERDA del marco, separada SEPARACION_FICHA (6 cm).
//   - Lámpara en el muro, sobre el marco, con la cabeza inclinada hacia la obra, y un halo de luz
//     cálida en el muro. Sin luces dinámicas ni sombras: el halo es una textura aditiva.
//
// Rendimiento: marcos, paspartús, lámparas y halos son InstancedMesh (una llamada de dibujo por tipo
// para todo el museo) y las fichas comparten un atlas (una llamada). Solo cada imagen de obra es una
// llamada propia, porque tiene su propia textura.

import * as THREE from 'three';
import { t, idioma } from './i18n.js';
import { direccionDeMirada } from './scene.js';

const RE_CURATORIAL = /^CURATORIAL_modulo(\d+)$/;

// ---------------------------------------------------------------- ajustes

export const AJUSTES = {
  // D-39: la luz cálida tiñe también la obra. Con false se vuelve a D-04 (color fiel de la digitalización).
  LUZ_CALIDA_SOBRE_OBRA: true,
  TINTE_CALIDO: new THREE.Color(1.0, 0.93, 0.8),   // multiplicador del color de la obra (lineal)
  COLOR_LUZ: new THREE.Color(1.0, 0.62, 0.22),     // ámbar: halo en el muro y lente de la lámpara
  INTENSIDAD_HALO: 0.4,

  TAMANO_POR_DEFECTO: { ancho: 1.0, alto: 0.7 },  // m, mientras la obra no tenga ficha
  MARCO_ANCHO: 0.05,        // m, ancho de la moldura vista de frente
  MARCO_FONDO: 0.035,       // m, cuánto sobresale del muro
  PASPARTU: 0.08,           // m, margen blanco alrededor de obras sobre papel
  SEPARACION_FICHA: 0.06,   // m, del borde del marco a la ficha (recomendación de los audios: 5–6 cm)
  FICHA: { ancho: 0.24, alto: 0.16 },
  PROCESO: { ancho: 0.24, alto: 0.3 },
  CURATORIAL: { ancho: 0.8, alto: 1.4 },
};

// ---------------------------------------------------------------- contenido

/** Texto en el idioma activo: acepta "texto" o { es: "texto", en: "…" }. */
function textoDe(valor) {
  if (valor == null) return '';
  if (typeof valor === 'object') return valor[idioma()] ?? valor.es ?? '';
  return String(valor);
}

async function leerJSON(url) {
  try {
    const respuesta = await fetch(url);
    return respuesta.ok ? await respuesta.json() : null;
  } catch {
    return null;
  }
}

/**
 * Lee obras.json y modulos.json (generados por tools:obras, fase 2). Si aún no existen, la sala
 * se monta igual con textos y medidas de ejemplo.
 */
export async function cargarContenido() {
  const [obras, modulos] = await Promise.all([leerJSON('./data/obras.json'), leerJSON('./data/modulos.json')]);
  const lista = (datos) => (Array.isArray(datos) ? datos : Object.values(datos ?? {}));

  const mapaObras = new Map();
  for (const o of lista(obras)) {
    const dim = o.dimensiones ?? o;
    mapaObras.set(o.nodo ?? o.id, {
      titulo: textoDe(o.titulo),
      artista: textoDe(o.artista),
      anio: o.anio ?? '',
      tecnica: textoDe(o.tecnica),
      proceso: textoDe(o.proceso),
      alto: Number(dim.alto_m) || null,
      ancho: Number(dim.ancho_m) || null,
      imagen: o.web ?? null,
    });
  }
  const mapaModulos = new Map();
  for (const m of lista(modulos)) {
    mapaModulos.set(m.id, { titulo: textoDe(m.titulo), texto: textoDe(m.texto_curatorial ?? m.introduccion) });
  }
  return { obras: mapaObras, modulos: mapaModulos };
}

// ---------------------------------------------------------------- dibujo en lienzo

/** Parte un texto en líneas que caben en `ancho` píxeles. */
function partirLineas(ctx, texto, ancho) {
  const lineas = [];
  for (const parrafo of String(texto).split(/\n+/)) {
    let linea = '';
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (ctx.measureText(prueba).width > ancho && linea) {
        lineas.push(linea);
        linea = palabra;
      } else {
        linea = prueba;
      }
    }
    lineas.push(linea);
  }
  return lineas;
}

const FUENTE_SERIF = 'Georgia, "Times New Roman", serif';
const FUENTE_SANS = 'system-ui, "Segoe UI", Roboto, sans-serif';

/** Ficha técnica en un rectángulo del atlas. */
function dibujarFicha(ctx, x, y, w, h, info) {
  ctx.fillStyle = '#efe9dc';
  ctx.fillRect(x, y, w, h);
  const margen = w * 0.07;
  const anchoTexto = w - margen * 2;
  let cursor = y + margen;

  ctx.fillStyle = '#1f1c18';
  ctx.textBaseline = 'top';
  ctx.font = `italic bold ${Math.round(h * 0.12)}px ${FUENTE_SERIF}`;
  for (const linea of partirLineas(ctx, info.titulo || t('ficha.titulo'), anchoTexto).slice(0, 2)) {
    ctx.fillText(linea, x + margen, cursor);
    cursor += h * 0.15;
  }
  cursor += h * 0.03;
  ctx.font = `${Math.round(h * 0.095)}px ${FUENTE_SANS}`;
  const filas = [
    info.artista || t('ficha.artista'),
    String(info.anio || t('ficha.anio')),
    info.tecnica || t('ficha.tecnica'),
  ];
  if (info.alto && info.ancho) {
    filas.push(t('ficha.medidas', { alto: Math.round(info.alto * 100), ancho: Math.round(info.ancho * 100) }));
  }
  for (const fila of filas) {
    if (cursor > y + h - margen - h * 0.1) break;
    ctx.fillText(partirLineas(ctx, fila, anchoTexto)[0], x + margen, cursor);
    cursor += h * 0.13;
  }
}

/** Lienzo con un bloque de texto largo (texto de proceso o curatorial). */
function lienzoDeTexto({ anchoPx, altoPx, titulo, texto, fondo, color, tamTitulo, tamTexto }) {
  const lienzo = document.createElement('canvas');
  lienzo.width = anchoPx;
  lienzo.height = altoPx;
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, anchoPx, altoPx);
  const margen = anchoPx * 0.08;
  let cursor = margen;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  if (titulo) {
    ctx.font = `bold ${tamTitulo}px ${FUENTE_SERIF}`;
    for (const linea of partirLineas(ctx, titulo, anchoPx - margen * 2)) {
      ctx.fillText(linea, margen, cursor);
      cursor += tamTitulo * 1.2;
    }
    cursor += tamTitulo * 0.6;
  }
  ctx.font = `${tamTexto}px ${FUENTE_SERIF}`;
  for (const linea of partirLineas(ctx, texto, anchoPx - margen * 2)) {
    if (cursor > altoPx - margen - tamTexto) break;
    ctx.fillText(linea, margen, cursor);
    cursor += tamTexto * 1.45;
  }
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  return textura;
}

/** Marcador genérico de la obra mientras no haya imagen (sin el código: D-26/commit 17372d0). */
function texturaMarcador() {
  const lienzo = document.createElement('canvas');
  lienzo.width = 512;
  lienzo.height = 360;
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#d9d4c7';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.fillStyle = '#2b2a27';
  ctx.font = `bold 64px ${FUENTE_SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t('obras.marcador'), lienzo.width / 2, lienzo.height / 2);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

/** Halo de luz: más intenso arriba (la lámpara está arriba) y suave hacia los bordes. */
function texturaHalo() {
  const lado = 256;
  const lienzo = document.createElement('canvas');
  lienzo.width = lado;
  lienzo.height = lado;
  const ctx = lienzo.getContext('2d');
  const gradiente = ctx.createRadialGradient(lado / 2, lado * 0.42, 0, lado / 2, lado * 0.5, lado / 2);
  gradiente.addColorStop(0, 'rgba(255,255,255,1)');
  gradiente.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  gradiente.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradiente;
  ctx.fillRect(0, 0, lado, lado);
  return new THREE.CanvasTexture(lienzo);
}

// ---------------------------------------------------------------- utilidades de geometría

/** Matriz de la obra: +X a la derecha del visitante, +Y arriba, +Z hacia la sala. */
function baseDeObra(nodo) {
  const z = direccionDeMirada(nodo).setY(0).normalize();
  const x = new THREE.Vector3(0, 1, 0).cross(z).normalize();
  const y = z.clone().cross(x);
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(nodo.getWorldPosition(new THREE.Vector3()));
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const EJE_Y = new THREE.Vector3(0, 1, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);

/** Matriz de mundo de un elemento dado en coordenadas de la obra. */
function enObra(base, posicion, escala, cuaternion = _q.identity()) {
  _p.set(...posicion);
  _s.set(...escala);
  return new THREE.Matrix4().multiplyMatrices(base, _m.compose(_p, cuaternion, _s));
}

/** Instanced mesh con capacidad fija; las matrices se escriben en componer(). */
function instanciado(geometria, material, capacidad, nombre) {
  const malla = new THREE.InstancedMesh(geometria, material, Math.max(capacidad, 1));
  malla.name = nombre;
  malla.count = 0;
  return malla;
}

// ---------------------------------------------------------------- presentación

/**
 * Monta marcos, fichas, lámparas, halos y textos curatoriales.
 * @returns {{ grupo: THREE.Group, aplicarImagen: (codigo: string, url: string) => Promise<void> }}
 */
export function crearPresentacion(datos, contenido) {
  const A = AJUSTES;
  const grupo = new THREE.Group();
  grupo.name = 'presentacion';

  const obras = [...datos.obras].map(([codigo, nodo]) => {
    const info = contenido.obras.get(codigo) ?? {};
    return {
      codigo,
      base: baseDeObra(nodo),
      info,
      ancho: info.ancho ?? A.TAMANO_POR_DEFECTO.ancho,
      alto: info.alto ?? A.TAMANO_POR_DEFECTO.alto,
      paspartu: /papel/i.test(info.tecnica ?? '') ? A.PASPARTU : 0,
      imagen: null,
    };
  });
  const n = obras.length;

  // Materiales compartidos
  const tinte = A.LUZ_CALIDA_SOBRE_OBRA ? A.TINTE_CALIDO : new THREE.Color(1, 1, 1);
  const matMarco = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.6 });
  const matPaspartu = new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.95 });
  // Latón: una lámpara negra desaparece contra el muro negro de las cúpulas
  const matMetal = new THREE.MeshStandardMaterial({ color: 0xa88a52, roughness: 0.4, metalness: 0.6 });
  const matLente = new THREE.MeshBasicMaterial({ color: A.COLOR_LUZ, toneMapped: false });
  const matHalo = new THREE.MeshBasicMaterial({
    map: texturaHalo(),
    color: A.COLOR_LUZ.clone().multiplyScalar(A.INTENSIDAD_HALO),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  // Geometrías unitarias (se escalan por instancia)
  const caja = new THREE.BoxGeometry(1, 1, 1);
  const plano = new THREE.PlaneGeometry(1, 1);
  const cuerpo = new THREE.CylinderGeometry(0.045, 0.06, 1, 16);
  const lente = new THREE.CircleGeometry(0.055, 16);

  const marcos = instanciado(caja, matMarco, n * 4, 'marcos');
  const paspartus = instanciado(plano, matPaspartu, n, 'paspartus');
  const brazos = instanciado(caja, matMetal, n * 2, 'lamparas_brazo');
  const cuerpos = instanciado(cuerpo, matMetal, n, 'lamparas_cuerpo');
  const lentes = instanciado(lente, matLente, n, 'lamparas_lente');
  const halos = instanciado(plano, matHalo, n, 'halos');
  halos.renderOrder = 1;   // después de lo opaco: el halo queda detrás de la obra (prueba de profundidad)
  grupo.add(marcos, paspartus, brazos, cuerpos, lentes, halos);

  // Imágenes: una malla por obra (cada una con su textura)
  const marcador = texturaMarcador();
  for (const obra of obras) {
    obra.imagen = new THREE.Mesh(plano, new THREE.MeshBasicMaterial({ map: marcador, color: tinte, toneMapped: false }));
    obra.imagen.name = `imagen_${obra.codigo}`;
    obra.imagen.matrixAutoUpdate = false;
    grupo.add(obra.imagen);
  }

  // Fichas: un atlas para todas
  const columnas = Math.ceil(Math.sqrt(n));
  const filas = Math.ceil(n / columnas);
  const celdaW = Math.floor(2048 / columnas);
  const celdaH = Math.round((celdaW * A.FICHA.alto) / A.FICHA.ancho);
  const atlas = document.createElement('canvas');
  atlas.width = celdaW * columnas;
  atlas.height = celdaH * filas;
  const ctxAtlas = atlas.getContext('2d');
  obras.forEach((obra, i) => {
    dibujarFicha(ctxAtlas, (i % columnas) * celdaW, Math.floor(i / columnas) * celdaH, celdaW, celdaH, {
      ...obra.info,
      alto: obra.info.alto,
      ancho: obra.info.ancho,
    });
  });
  const texturaAtlas = new THREE.CanvasTexture(atlas);
  texturaAtlas.colorSpace = THREE.SRGBColorSpace;
  texturaAtlas.anisotropy = 4;
  const fichas = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({ map: texturaAtlas, color: tinte, toneMapped: false }),
  );
  fichas.name = 'fichas';
  grupo.add(fichas);

  // Textos de proceso (opcionales, solo si la ficha los trae)
  for (const obra of obras) {
    if (!obra.info.proceso) continue;
    obra.proceso = new THREE.Mesh(plano, new THREE.MeshBasicMaterial({
      map: lienzoDeTexto({
        anchoPx: 512, altoPx: Math.round((512 * A.PROCESO.alto) / A.PROCESO.ancho),
        titulo: t('ficha.proceso'), texto: obra.info.proceso,
        fondo: '#efe9dc', color: '#1f1c18', tamTitulo: 30, tamTexto: 22,
      }),
      color: tinte,
      toneMapped: false,
    }));
    obra.proceso.matrixAutoUpdate = false;
    grupo.add(obra.proceso);
  }

  /** Coloca todos los elementos según el tamaño actual de cada obra. */
  function componer() {
    let iMarco = 0, iPaspartu = 0, iBrazo = 0;
    const posiciones = [];
    const uvs = [];
    const indices = [];

    obras.forEach((obra, i) => {
      const { base, ancho, alto, paspartu } = obra;
      const m = A.MARCO_ANCHO;
      const d = A.MARCO_FONDO;
      const W = ancho + 2 * paspartu + 2 * m;   // exterior del marco
      const H = alto + 2 * paspartu + 2 * m;

      // Imagen (ligeramente hundida dentro del marco)
      obra.imagen.matrix.copy(enObra(base, [0, 0, 0.02], [ancho, alto, 1]));

      // Marco: cuatro molduras
      const molduras = [
        [[0, H / 2 - m / 2, d / 2], [W, m, d]],
        [[0, -H / 2 + m / 2, d / 2], [W, m, d]],
        [[-W / 2 + m / 2, 0, d / 2], [m, H - 2 * m, d]],
        [[W / 2 - m / 2, 0, d / 2], [m, H - 2 * m, d]],
      ];
      for (const [pos, esc] of molduras) marcos.setMatrixAt(iMarco++, enObra(base, pos, esc));
      if (paspartu > 0) {
        paspartus.setMatrixAt(iPaspartu++, enObra(base, [0, 0, 0.018], [ancho + 2 * paspartu, alto + 2 * paspartu, 1]));
      }

      // Lámpara: placa en el muro, brazo hacia la sala y cuerpo inclinado hacia el centro de la obra
      const yLampara = H / 2 + 0.45;
      const zLampara = 0.55;
      brazos.setMatrixAt(iBrazo++, enObra(base, [0, yLampara + 0.07, 0.01], [0.08, 0.12, 0.02]));
      brazos.setMatrixAt(iBrazo++, enObra(base, [0, yLampara + 0.07, zLampara / 2], [0.025, 0.025, zLampara]));
      const haciaObra = new THREE.Vector3(0, 0.05 - yLampara, 0.02 - zLampara).normalize();
      const largoCuerpo = 0.16;
      cuerpos.setMatrixAt(i, enObra(base, [0, yLampara, zLampara], [1, largoCuerpo, 1],
        new THREE.Quaternion().setFromUnitVectors(EJE_Y.clone().negate(), haciaObra)));
      const punta = new THREE.Vector3(0, yLampara, zLampara).addScaledVector(haciaObra, largoCuerpo / 2 + 0.001);
      lentes.setMatrixAt(i, enObra(base, punta.toArray(), [1, 1, 1],
        new THREE.Quaternion().setFromUnitVectors(EJE_Z, haciaObra)));

      // Halo en el muro, detrás del marco
      halos.setMatrixAt(i, enObra(base, [0, 0.08, 0.003], [W + 0.8, H + 0.9, 1]));

      // Ficha: a la izquierda (−X), a SEPARACION_FICHA del marco, alineada con su borde inferior
      const fw = A.FICHA.ancho;
      const fh = A.FICHA.alto;
      const fx = -W / 2 - A.SEPARACION_FICHA - fw / 2;
      const fy = -H / 2 + fh / 2;
      const mFicha = enObra(base, [fx, fy, 0.004], [fw, fh, 1]);
      const v0 = posiciones.length / 3;
      for (const [cx, cy] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
        _p.set(cx, cy, 0).applyMatrix4(mFicha);
        posiciones.push(_p.x, _p.y, _p.z);
      }
      const u0 = (i % columnas) / columnas;
      const u1 = u0 + 1 / columnas;
      const vArriba = 1 - Math.floor(i / columnas) / filas;
      const vAbajo = vArriba - 1 / filas;
      uvs.push(u0, vAbajo, u1, vAbajo, u1, vArriba, u0, vArriba);
      indices.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);

      // Texto de proceso: sobre la ficha, en la misma columna
      if (obra.proceso) {
        obra.proceso.matrix.copy(enObra(base, [fx, fy + fh / 2 + 0.03 + A.PROCESO.alto / 2, 0.004],
          [A.PROCESO.ancho, A.PROCESO.alto, 1]));
      }
    });

    for (const [malla, cantidad] of [[marcos, iMarco], [paspartus, iPaspartu], [brazos, iBrazo],
      [cuerpos, n], [lentes, n], [halos, n]]) {
      malla.count = cantidad;
      malla.instanceMatrix.needsUpdate = true;
      malla.computeBoundingSphere();
    }

    fichas.geometry.dispose();
    fichas.geometry = new THREE.BufferGeometry();
    fichas.geometry.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
    fichas.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    fichas.geometry.setIndex(indices);
    fichas.geometry.computeBoundingSphere();
  }

  // Textos curatoriales en los tótems
  for (const nodo of datos.curatoriales.values()) {
    const numero = RE_CURATORIAL.exec(nodo.name)[1];
    const modulo = contenido.modulos.get(`modulo${numero}`) ?? {};
    const { ancho, alto } = A.CURATORIAL;
    const panel = new THREE.Mesh(plano, new THREE.MeshBasicMaterial({
      map: lienzoDeTexto({
        anchoPx: 1024, altoPx: Math.round((1024 * alto) / ancho),
        titulo: modulo.titulo || t('curatorial.titulo', { n: numero }),
        texto: modulo.texto || t('curatorial.texto'),
        fondo: '#141414', color: '#e9e2d2', tamTitulo: 64, tamTexto: 38,
      }),
      toneMapped: false,
    }));
    panel.name = `curatorial_modulo${numero}`;
    const dir = direccionDeMirada(nodo);
    panel.position.copy(nodo.getWorldPosition(new THREE.Vector3())).addScaledVector(dir, 0.003);
    panel.lookAt(panel.position.clone().add(dir));
    panel.scale.set(ancho, alto, 1);
    grupo.add(panel);
  }

  componer();
  datos.raiz.add(grupo);

  /** Pone la imagen real de una obra; si la ficha no da medidas, respeta la proporción de la imagen. */
  async function aplicarImagen(codigo, url) {
    const obra = obras.find((o) => o.codigo === codigo);
    if (!obra) throw new Error(`No existe la obra ${codigo}.`);
    const textura = await new THREE.TextureLoader().loadAsync(url);
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy = 4;
    obra.imagen.material.map = textura;
    obra.imagen.material.needsUpdate = true;
    if (!obra.info.ancho) {
      const { width, height } = textura.image;
      obra.ancho = obra.alto * (width / height);
      componer();
    }
  }

  // Imágenes que ya vienen en obras.json
  for (const obra of obras) {
    if (obra.info.imagen) {
      aplicarImagen(obra.codigo, obra.info.imagen).catch((error) => console.error(`[obras] ${obra.codigo}:`, error));
    }
  }

  return { grupo, aplicarImagen };
}
