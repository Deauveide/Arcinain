// Servidor estático mínimo para el visor (sin dependencias). Solo para pruebas locales.
// No sustituye al backend de la fase 7 (que añade rangos HTTP, compresión y cabeceras de seguridad).
//
// Uso: npm run viewer [puerto]   → http://localhost:8080
// Para probar desde el celular en la misma red, usa la IP local que muestra la consola.
// Recuerda: sin HTTPS, la VR (WebXR) no funciona; ver README.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'viewer');
const PUERTO = Number(process.argv[2]) || 8080;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.wasm': 'application/wasm',
  '.ktx2': 'image/ktx2',
  '.bin': 'application/octet-stream',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
};

const servidor = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let ruta = decodeURIComponent(url.pathname);
    if (ruta.endsWith('/')) ruta += 'index.html';

    // Evita salir de viewer/ con "..": la ruta normalizada debe seguir dentro de RAIZ
    const archivo = normalize(join(RAIZ, ruta));
    if (!archivo.startsWith(RAIZ)) {
      res.writeHead(403).end('Prohibido');
      return;
    }

    const info = await stat(archivo);
    if (!info.isFile()) {
      res.writeHead(404).end('No encontrado');
      return;
    }

    const datos = await readFile(archivo);
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(archivo).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': datos.length,
      'Cache-Control': 'no-cache',
    });
    res.end(datos);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado');
  }
});

servidor.listen(PUERTO, '0.0.0.0', () => {
  console.log(`Visor en http://localhost:${PUERTO}`);
  for (const interfaz of Object.values(networkInterfaces()).flat()) {
    if (interfaz && interfaz.family === 'IPv4' && !interfaz.internal) {
      console.log(`En la red local (celular): http://${interfaz.address}:${PUERTO}  (sin HTTPS: sin VR)`);
    }
  }
});
