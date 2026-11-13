// Colisiones del visitante contra las mallas COL_* (D-34).
//
// Se usan los triángulos reales de cada malla, no su caja alineada a los ejes: así un muro
// diagonal (sala octogonal) o una pieza girada bloquea solo donde está. El visitante es un
// cilindro vertical (radio y altura); se proyecta cada triángulo que cruza su rango de altura
// sobre el plano del piso (XZ) y se mide la distancia en 2D. Módulo sin dependencias para
// poder probarlo con Node (tools/probar-colisiones.mjs).

/**
 * Prepara los triángulos de colisión a partir de posiciones de mundo.
 * @param {Float32Array|number[]} posiciones Vértices x, y, z en coordenadas de mundo, tres por triángulo.
 * @returns {Float64Array[]} Un arreglo por triángulo: [ax, az, bx, bz, cx, cz, minY, maxY].
 */
export function prepararTriangulos(posiciones) {
  const triangulos = [];
  for (let i = 0; i + 8 < posiciones.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = Array.from(posiciones.slice(i, i + 9));
    triangulos.push(Float64Array.of(ax, az, bx, bz, cx, cz, Math.min(ay, by, cy), Math.max(ay, by, cy)));
  }
  return triangulos;
}

/** Distancia al cuadrado de (px, pz) al segmento (ax, az)–(bx, bz). */
function distancia2Segmento(px, pz, ax, az, bx, bz) {
  const ux = bx - ax;
  const uz = bz - az;
  const largo2 = ux * ux + uz * uz;
  let t = largo2 > 0 ? ((px - ax) * ux + (pz - az) * uz) / largo2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (ax + ux * t);
  const dz = pz - (az + uz * t);
  return dx * dx + dz * dz;
}

/** Distancia en el plano XZ de un punto a un triángulo proyectado (0 si está dentro). */
export function distanciaTriangulo(px, pz, tri) {
  const [ax, az, bx, bz, cx, cz] = tri;
  // Dentro del triángulo (solo si no es degenerado: las caras verticales se proyectan como segmentos)
  const area = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
  if (Math.abs(area) > 1e-9) {
    const s1 = (bx - ax) * (pz - az) - (bz - az) * (px - ax);
    const s2 = (cx - bx) * (pz - bz) - (cz - bz) * (px - bx);
    const s3 = (ax - cx) * (pz - cz) - (az - cz) * (px - cx);
    if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) return 0;
  }
  return Math.sqrt(Math.min(
    distancia2Segmento(px, pz, ax, az, bx, bz),
    distancia2Segmento(px, pz, bx, bz, cx, cz),
    distancia2Segmento(px, pz, cx, cz, ax, az),
  ));
}

/**
 * Holgura del cuerpo en (x, z): distancia al obstáculo más cercano menos el radio.
 * Negativa = el cuerpo se mete en un obstáculo. Solo cuentan los triángulos que cruzan
 * el rango de altura [baseY, topeY] del cuerpo (el piso y lo que pasa por encima no bloquean).
 */
export function holgura(triangulos, x, z, radio, baseY, topeY) {
  let minima = Infinity;
  for (const tri of triangulos) {
    if (tri[7] < baseY || tri[6] > topeY) continue;
    const d = distanciaTriangulo(x, z, tri);
    if (d < minima) minima = d;
  }
  return minima - radio;
}

/**
 * Mueve el cuerpo de (x, z) con el desplazamiento (dx, dz) respetando las colisiones.
 * Prueba el movimiento completo; si choca, desliza por cada eje por separado (así se avanza
 * pegado a una pared, también diagonal). Un movimiento que aleja de un obstáculo siempre se
 * permite, para no quedar atrapado si el visitante aparece ya dentro del radio.
 * @returns {[number, number]} Nueva posición.
 */
export function mover(triangulos, x, z, dx, dz, radio, baseY, topeY) {
  const h = (px, pz) => holgura(triangulos, px, pz, radio, baseY, topeY);
  const actual = h(x, z);
  const permitido = (px, pz) => {
    const nueva = h(px, pz);
    return nueva >= 0 || nueva > actual;
  };
  if (permitido(x + dx, z + dz)) return [x + dx, z + dz];
  let nx = x;
  let nz = z;
  if (dx !== 0 && permitido(nx + dx, nz)) nx += dx;
  if (dz !== 0 && permitido(nx, nz + dz)) nz += dz;
  return [nx, nz];
}
