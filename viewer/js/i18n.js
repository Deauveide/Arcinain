// Textos de la interfaz. Se cargan una vez desde data/i18n/es.json.
// Si el archivo no carga, la interfaz muestra la clave en lugar de romperse.

let diccionario = {};

/** Carga el idioma indicado. Devuelve true si cargó bien. */
export async function cargarIdioma(ruta = './data/i18n/es.json') {
  try {
    const respuesta = await fetch(ruta, { cache: 'no-cache' });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    diccionario = await respuesta.json();
    return true;
  } catch (error) {
    console.warn('[i18n] No se pudo cargar el idioma:', error);
    diccionario = {};
    return false;
  }
}

/**
 * Devuelve el texto para una clave con puntos ("inicio.entrar").
 * Acepta variables con llaves: t('carga.progreso', { pct: 40 }) → "Cargando la sala: 40 %".
 */
export function t(clave, variables = {}) {
  const texto = clave.split('.').reduce((nodo, parte) => (nodo && nodo[parte] !== undefined ? nodo[parte] : undefined), diccionario);
  if (typeof texto !== 'string') return clave;
  return texto.replace(/\{(\w+)\}/g, (_, nombre) => (variables[nombre] ?? `{${nombre}}`));
}

/** Rellena los elementos con data-i18n="clave" del documento. */
export function aplicarTraducciones(raiz = document) {
  raiz.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
}
