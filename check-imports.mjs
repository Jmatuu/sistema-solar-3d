/**
 * Comprobación estática de imports.
 *
 * Existe por un fallo concreto: en la fase 2 se quitó `SUN` del import de
 * `three/Scene.js` al limpiar símbolos aparentemente sin usar, pero la línea
 * `color: SUN.color` seguía ahí. El build pasaba con código 0 y `npm run check`
 * también, porque ninguno de los dos ejecuta `_buildSystem()` (necesita WebGL).
 * La web quedaba rota en blanco.
 *
 * Este script resuelve de forma estática cada `import { a, b } from './x.js'`
 * contra los `export` reales del módulo destino, sin cargar three ni abrir un
 * navegador. Así un símbolo usado pero no importado falla aquí.
 *
 * Ejecuta con: npm run check:imports
 */
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve('src')
let fallos = 0
const ok = (m) => console.log(`  OK   ${m}`)
const bad = (m) => {
  fallos++
  console.log(`  FALLA ${m}`)
}

/** Todos los ficheros .js/.jsx bajo src. */
function collect(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collect(full))
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full)
  }
  return out
}

const files = collect(SRC)

/** Nombres exportados por un módulo: export const/let/function/class y export { a, b }. */
function exportsOf(code) {
  const names = new Set()

  // export const X = / export let / export function X / export class X
  for (const m of code.matchAll(/^export\s+(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    names.add(m[1])
  }

  // export { a, b as c }
  for (const m of code.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const parte of m[1].split(',')) {
      const t = parte.trim()
      if (!t) continue
      const as = t.match(/\bas\s+([A-Za-z_$][\w$]*)$/)
      names.add(as ? as[1] : t)
    }
  }

  if (/^export\s+default\b/m.test(code)) names.add('default')

  return names
}

/** Imports de un módulo: { ... } from 'ruta' y los nombresiplUGV. */
function importsOf(code) {
  const out = []
  const re = /import\s+(?:([\w$]+)\s*,\s*)?(?:\{([^}]*)\}|\*\s+as\s+([\w$]+)|([\w$]+))?\s*(?:from\s*)?['"]([^'"]+)['"]/g
  for (const m of code.matchAll(re)) {
    const [, , llaves, ns, def, spec] = m
    const nombres = []
    if (llaves) {
      for (const parte of llaves.split(',')) {
        const t = parte.trim()
        if (!t) continue
        // "a as b" en un import se importa b
        const as = t.match(/\bas\s+([A-Za-z_$][\w$]*)$/)
        nombres.push(as ? as[1] : t)
      }
    }
    out.push({ spec, nombres, tieneNamespace: Boolean(ns), default: def ?? null })
  }
  return out
}

/**
 * Elimina comentarios y literales de cadena. Sin esto, los nombres propios que
 * aparecen en la prosa ("Three.js", "JPL", "el Sol") se_falsearían como
 * identificadores sin declarar.
 */
function stripCommentsAndStrings(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // comentarios de bloque
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ') // comentarios de línea
    .replace(/`(?:\\.|[^`\\])*`/g, '``') // plantillas
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''") // cadenas simples
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""') // cadenas dobles
}

/** Identificadores en mayúscula inicial usados como `NOMBRE.prop`. */
function dottedNames(code) {
  const out = new Set()
  for (const m of code.matchAll(/(?<![.\w$])([A-Z][A-Za-z0-9_$]*)\s*\./g)) out.add(m[1])
  return out
}

console.log('\n1. Resolución de imports locales')

const cache = new Map()
const exportCache = new Map()

function leerModulo(spec, desde) {
  const resuelto = path.resolve(path.dirname(desde), spec)
  // Node resuelve './x.js' y './x' igual.
  const candidatos = [resuelto, resuelto.replace(/\.js$/, '.jsx'), `${resuelto}.js`, `${resuelto}.jsx`]
  for (const c of candidatos) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
  }
  return null
}

let totalImports = 0
for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8')
  // Los imports se leen del original: ahí las rutas de los módulos son
  // cadenas reales y quitar los literales rompería el spec.
  for (const imp of importsOf(raw)) {
    if (!imp.spec.startsWith('.')) continue // paquetes externos: no se comprueba
    totalImports++

    const destino = leerModulo(imp.spec, file)
    if (!destino) {
      bad(`${path.relative(SRC, file)} → no existe el módulo '${imp.spec}'`)
      continue
    }
    if (!exportCache.has(destino)) exportCache.set(destino, exportsOf(fs.readFileSync(destino, 'utf8')))

    const disponibles = exportCache.get(destino)
    const faltan = imp.nombres.filter((n) => !disponibles.has(n))

    if (faltan.length > 0) {
      const rel = path.relative(SRC, file)
      const dest = path.relative(SRC, destino)
      bad(`${rel} importa { ${faltan.join(', ')} } de '${dest}', pero no está exportado`)
    }
  }
}
if (fallos === 0) {
  ok(`${totalImports} imports locales resuelven en ${files.length} ficheros`)
}

console.log('\n2. Identificadores usados y no declarados (los casos más comunes)')

// No comprobamos todo el fichero: sería demasiado ruidoso con los parámetros y
// las propiedades. Nos limitamos a los símbolos que aparecen en la línea del
// error del caso real: uso de un identificador que no es importado ni local.
const builtins = new Set(['console', 'Math', 'JSON', 'Object', 'Array', 'Number', 'String', 'Boolean', 'window', 'document', 'globalThis', 'performance', 'Infinity', 'NaN', 'undefined', 'true', 'false', 'null', 'process'])

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8')
  // Los comentarios no cuentan: aquí solo miramos código ejecutable.
  const code = stripCommentsAndStrings(raw)
  const declarados = new Set()

  // const/let/var/function/class, incluidos los multilínea
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) declarados.add(m[1])
  for (const m of code.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g)) {
    for (const p of m[1].split(',')) {
      const t = p.trim().split(':').pop()?.trim()
      if (t) declarados.add(t)
    }
  }
  for (const m of code.matchAll(/\b(?:function\*?|class)\s+([A-Za-z_$][\w$]*)/g)) declarados.add(m[1])

  // parámetros de función
  for (const m of code.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g)) {
    for (const p of m[1].split(',')) {
      const t = p.trim().replace(/[=:].*$/, '').trim()
      if (/^[A-Za-z_$][\w$]*$/.test(t)) declarados.add(t)
    }
  }

  // nombres importados (leídos del original, ver nota arriba)
  for (const imp of importsOf(raw)) {
    for (const n of imp.nombres) declarados.add(n)
    if (imp.default) declarados.add(imp.default)
  }

  // propiedades de clase (this.x = ) y métodos
  for (const m of code.matchAll(/this\.([A-Za-z_$][\w$]*)/g)) declarados.add(m[1])

  // destructuring en cualquier sitio: const { a, b } = ...
  for (const m of code.matchAll(/\{([^}]*)\}\s*=/g)) {
    for (const p of m[1].split(',')) {
      const t = p.trim().replace(/[=:].*$/, '').trim()
      if (/^[A-Za-z_$][\w$]*$/.test(t)) declarados.add(t)
    }
  }

  const candidatos = dottedNames(code)

  const faltan = [...candidatos].filter((n) => !declarados.has(n) && !builtins.has(n))
  if (faltan.length > 0) {
    const rel = path.relative(SRC, file)
    for (const n of faltan) {
      // Se deja pasar si parece una constante externa conocida.
      if (/^(THREE|React|Promise|Symbol|BigInt|Date|Map|Set|WeakMap|WeakSet|RegExp|Error|TypeError|Float32Array|Float64Array|Uint8Array|Uint16Array|Uint32Array|Int32Array|ArrayBuffer|DataView|Reflect|Proxy|URL|URLSearchParams|TextEncoder|TextDecoder|AbortController|Request|Response|Headers|FormData|Blob|File|Image|CustomEvent|EventTarget|Event|WebGL|ImageData|ImageBitmap|OffscreenCanvas|Path2D|CSS|MathJax)$/.test(n)) continue
      bad(`${rel} usa '${n}' pero no lo declara ni lo importa`)
    }
  }
}
if (fallos === 0) ok('ningún identificador sin declarar')

console.log(fallos === 0 ? '\nImports correctos.\n' : `\n${fallos} problema(s) de imports.\n`)
process.exit(fallos === 0 ? 0 : 1)