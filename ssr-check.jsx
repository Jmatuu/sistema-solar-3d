// Prueba temporal: monta TimeControls y BodyInfo de verdad para detectar
// errores de ejecución (hooks sin importar, props inexistentes, etc.).
// Se ejecuta con: vite build --ssr ssr-check.jsx && node dist-ssr/ssr-check.js
import { renderToString } from 'react-dom/server'
import { TimeControls } from './src/ui/TimeControls.jsx'
import { BodyInfo } from './src/ui/BodyInfo.jsx'
import { BODIES, SUN, findBody, ALL_BODIES } from './src/data/bodies.js'
import { radiusUnits, orbitUnits, sunRadiusUnits } from './src/data/bodies.js'

let fallos = 0
function check(nombre, fn) {
  try {
    const out = fn()
    console.log(`  OK   ${nombre}${out ? ` -> ${out}` : ''}`)
  } catch (err) {
    fallos++
    console.log(`  FALLA ${nombre}: ${err.message}`)
  }
}

console.log('\nMontaje de componentes (react-dom/server):')
check('TimeControls sin props', () => {
  const html = renderToString(<TimeControls />)
  return `${html.length} chars, ${(html.match(/<button/g) || []).length} botones`
})
check('TimeControls con snapshot', () => {
  const snapshot = { date: new Date(), fps: 60, scaleMode: 'visual', paused: false }
  const html = renderToString(<TimeControls snapshot={snapshot} onSpeed={() => {}} onPause={() => {}} onNow={() => {}} />)
  if (!html.includes('En marcha')) throw new Error('no refleja el estado')
  return 'muestra "En marcha"'
})
check('TimeControls en pausa', () => {
  const snapshot = { date: new Date(), fps: 60, scaleMode: 'visual', paused: true }
  const html = renderToString(<TimeControls snapshot={snapshot} />)
  if (!html.includes('En pausa')) throw new Error('no refleja el estado')
  return 'muestra "En pausa"'
})

for (const body of ALL_BODIES.filter((b) => b.kind === 'planet')) {
  check(`BodyInfo ${body.id}`, () => {
    const html = renderToString(<BodyInfo body={body} />)
    if (!html.includes(body.name)) throw new Error('no muestra el nombre')
    return `${html.length} chars`
  })
}

console.log('\nIntegridad de datos:')
check('formatMass sin NaN en todos los planetas', () => {
  const html = BODIES.map((b) => renderToString(<BodyInfo body={b} />)).join('')
  if (html.includes('NaN')) throw new Error('aparece NaN en el panel')
  if (html.includes('undefined')) throw new Error('aparece undefined en el panel')
  return 'sin NaN ni undefined'
})
check('findBody resuelve y devuelve null si no existe', () => {
  const e = findBody('earth')
  const n = findBody('inexistente')
  if (!e || e.id !== 'earth') throw new Error('no encuentra earth')
  if (n !== null) throw new Error('debería devolver null')
  return 'ok'
})
check('colores en formato hex de 6 dígitos', () => {
  for (const b of ALL_BODIES) {
    const hex = b.color.toString(16).padStart(6, '0')
    if (!/^[0-9a-f]{6}$/.test(hex)) throw new Error(`color inválido en ${b.id}: ${hex}`)
  }
  return 'todos válidos'
})
check('radios y órbitas positivos y finitos', () => {
  for (const b of BODIES) {
    const r = radiusUnits(b.radiusKm)
    const o = orbitUnits(b.aAU)
    if (!Number.isFinite(r) || r <= 0) throw new Error(`radio inválido en ${b.id}: ${r}`)
    if (!Number.isFinite(o) || o <= 0) throw new Error(`órbita inválida en ${b.id}: ${o}`)
  }
  if (!Number.isFinite(sunRadiusUnits())) throw new Error('radio solar inválido')
  return 'ok'
})
check('cada planeta cabe en su órbita (r < o/2)', () => {
  const malos = BODIES.filter((b) => radiusUnits(b.radiusKm) > orbitUnits(b.aAU) / 2)
  if (malos.length) throw new Error(`solapan: ${malos.map((m) => m.id).join(', ')}`)
  return 'ninguno solapa'
})
check('corona del Sol no invade la órbita de Mercurio', () => {
  // `scale` de un Sprite es el ancho total: el radio visual es la mitad.
  const coronaRadio = (sunRadiusUnits() * 2.6) / 2
  const mercurio = orbitUnits(BODIES[0].aAU)
  if (coronaRadio >= mercurio) throw new Error(`corona ${coronaRadio.toFixed(1)} >= Mercurio ${mercurio.toFixed(1)}`)
  return `radio corona ${coronaRadio.toFixed(2)} < Mercurio ${mercurio.toFixed(1)}`
})
check('órbitas estrictamente crecientes por orden de distancia', () => {
  const orden = [...BODIES].sort((a, b) => a.aAU - b.aAU)
  for (let i = 1; i < orden.length; i++) {
    if (orbitUnits(orden[i].aAU) <= orbitUnits(orden[i - 1].aAU)) {
      throw new Error(`no crece en ${orden[i].id}`)
    }
  }
  return `${orden.length} planetas ordenados`
})
check('la elipse dibujada contiene al planeta', () => {
  // La elipse se dibuja multiplicando la posición en AU por orbitUnits(a)/a.
  // El logMap es monotono pero no lineal, así que el perihelio y el afelio se
  // comprimen distinto: hay que comprobar que ambos siguen siendo mayores que
  // el radio del planeta, o el planeta quedaría fuera de su propia órbita.
  for (const b of BODIES) {
    const a = b.elements.a[0]
    const e = b.elements.e[0]
    const escala = orbitUnits(a) / a
    const q = a * (1 - e) * escala
    const Q = a * (1 + e) * escala
    const r = radiusUnits(b.radiusKm)
    if (Q <= q) throw new Error(`${b.id}: elipse al revés Q=${Q.toFixed(2)} <= q=${q.toFixed(2)}`)
    if (q <= r) throw new Error(`${b.id}: perihelio ${q.toFixed(2)} <= radio ${r.toFixed(2)}`)
  }
  return 'perihelio > radio en los 8 planetas'
})
check('las elipses no invaden la corona del Sol', () => {
  const corona = (sunRadiusUnits() * 2.6) / 2
  for (const b of BODIES) {
    const a = b.elements.a[0]
    const e = b.elements.e[0]
    const q = a * (1 - e) * (orbitUnits(a) / a)
    if (q <= corona) {
      throw new Error(`${b.id}: perihelio ${q.toFixed(2)} dentro de la corona ${corona.toFixed(2)}`)
    }
  }
  return `perihelio mínimo ${(0.3075 * (orbitUnits(0.3871) / 0.3871)).toFixed(2)} > corona ${corona.toFixed(2)}`
})
check('todos los planetas tienen los campos que pide el panel', () => {
  const campos = ['id', 'name', 'aAU', 'radiusKm', 'massKg', 'rotationHours', 'axialTiltDeg', 'color', 'elements']
  for (const b of BODIES) {
    for (const c of campos) {
      if (b[c] === undefined) throw new Error(`falta ${c} en ${b.id}`)
    }
  }
  return 'campos completos'
})
check('el Sol expone name, radiusKm y color', () => {
  if (!SUN.name || !SUN.radiusKm || !SUN.color) throw new Error('datos del Sol incompletos')
  return 'ok'
})
check('cada planeta trae los 6 elementos keplerianos con tasa', () => {
  for (const b of BODIES) {
    for (const k of ['a', 'e', 'i', 'L', 'peri', 'node']) {
      const v = b.elements?.[k]
      if (!Array.isArray(v) || v.length !== 2) throw new Error(`elements.${k} inválido en ${b.id}`)
      if (!v.every(Number.isFinite)) throw new Error(`elements.${k} con NaN en ${b.id}`)
    }
  }
  return 'a, e, i, L, peri, node presentes en los 8'
})

console.log(fallos === 0 ? '\nTodo correcto.\n' : `\n${fallos} comprobación(es) fallida(s).\n`)
process.exit(fallos === 0 ? 0 : 1)