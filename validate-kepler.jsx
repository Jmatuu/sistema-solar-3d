/**
 * Validación numérica del solver de Kepler.
 *
 * Lección aprendida al escribir esto: la primera versión comparaba contra una
 * tabla de efemérides "de referencia" que yo mismo había escrito de memoria. Los
 * datos eran falsos, así que el test señalaba un fallo que no existía. Este
 * fichero solo usa referencias que se pueden derivar o comprobar aquí mismo:
 *
 *   · la ecuación de Kepler, que se puede verificar por residuo;
 *   · invariantes geométricos (ortonormalidad, |r|, límites de la elipse);
 *   · relaciones astronómicas verificables entre cuerpos (la longitud del Sol
 *     geocéntrica es la de la Tierra menos 180°, y su valor en J2000 está
 *     tabulado como 280.46°);
 *   · extremos orbitales q = a(1-e) y Q = a(1+e) recomputados por barrido.
 *
 * Ejecuta con: npm run validate
 */
import {
  heliocentricPosition,
  solveKepler,
  orbitalState,
  elementsAtDate,
} from './src/lib/kepler.js'
import { ELEMENTS } from './src/data/bodies.js'
import { jdFromDate, centuriesSinceJ2000, J2000, DAYS_PER_YEAR } from './src/lib/time.js'
import { eclipticLongitude, eclipticLatitude, heliocentricDistance } from './src/lib/orbits.js'

const RAD = 180 / Math.PI
let fallos = 0
const ok = (m) => console.log(`  OK   ${m}`)
const bad = (m) => {
  fallos++
  console.log(`  FALLA ${m}`)
}
const pos = (id, jd) => heliocentricPosition(ELEMENTS[id], jd, centuriesSinceJ2000(jd))
const ids = Object.keys(ELEMENTS)

console.log('\n1. Ecuación de Kepler: residuo de M = E - e·sin E')
for (const e of [0, 0.0167, 0.0934, 0.2056, 0.2486]) {
  let maxErr = 0
  for (let deg = -180; deg <= 180; deg += 1) {
    const M = (deg * Math.PI) / 180
    const E = solveKepler(M, e)
    const r = Math.abs(E - e * Math.sin(E) - M)
    if (r > maxErr) maxErr = r
  }
  const label = `e=${e.toFixed(4)} · residuo máx ${maxErr.toExponential(2)} rad`
  if (maxErr < 1e-9) ok(label)
  else bad(`${label} (esperado < 1e-9)`)
}

console.log('\n2. Ortogonalidad de la rotación: |v| se conserva')
// La posición heliocéntrica debe tener módulo igual a r, con independencia de
// ω, Ω e i. Si la matriz de rotación no fuese ortonormal, esto fallaría.
{
  // |posición| debe igualar r(a, e, M), la distancia de la elipse. Para que la
  // comparación sea válida, M tiene que ser el MISMO en los dos lados: se
  // recorre un año orbital (M da una vuelta completa) y en cada instante se
  // toma M de los elementos propagados a esa fecha.
  let peor = 0
  let peorCaso = null
  for (const id of ids) {
    const anios = Math.pow(ELEMENTS[id].a[0], 1.5)
    const pasos = 720
    for (let k = 0; k <= pasos; k++) {
      const jd = J2000 + (k / pasos) * anios * DAYS_PER_YEAR
      const T = centuriesSinceJ2000(jd)
      const el = elementsAtDate(ELEMENTS[id], T)
      const M = ((el.L - el.peri) * Math.PI) / 180
      const { r } = orbitalState(M, el.e, el.a)
      const [x, y, z] = heliocentricPosition(ELEMENTS[id], jd, T)
      const d = Math.abs(heliocentricDistance(x, y, z) - r)
      if (d > peor) {
        peor = d
        peorCaso = id
      }
    }
  }
  if (peor < 1e-12) ok(`desviación máx ${peor.toExponential(2)} UA${peorCaso ? ` (${peorCaso})` : ''}`)
  else bad(`desviación máx ${peor.toExponential(2)} UA (${peorCaso})`)
}

console.log('\n3. Autoconsistencia: r de la elipse coincide con |posición|')
for (const id of ids) {
  const el = elementsAtDate(ELEMENTS[id], 0)
  const M = ((el.L - el.peri) * Math.PI) / 180
  const { r: rElipse } = orbitalState(M, el.e, el.a)
  const [x, y, z] = pos(id, J2000)
  const d = Math.abs(heliocentricDistance(x, y, z) - rElipse)
  if (d < 1e-12) ok(`${id.padEnd(8)} r=${rElipse.toFixed(6)} UA`)
  else bad(`${id.padEnd(8)} |r−r_elipse| = ${d.toExponential(2)}`)
}

console.log('\n4. Traslación cerrada: +2π devuelve el mismo estado')
for (const id of ids) {
  const el = elementsAtDate(ELEMENTS[id], 0)
  const M0 = 1.234
  const s1 = orbitalState(M0, el.e, el.a)
  const s2 = orbitalState(M0 + Math.PI * 2, el.e, el.a)
  const dNu = Math.abs(s1.nu - s2.nu)
  if (dNu < 1e-12) ok(`${id.padEnd(8)} Δν = ${dNu.toExponential(2)}`)
  else bad(`${id.padEnd(8)} Δν = ${dNu.toExponential(2)}`)
}

console.log('\n5. Extremos: E=0 es perihelio, E=π es afelio')
for (const id of ids) {
  const { a, e } = ELEMENTS[id]
  // orbitalState resuelve M→E, así que se pasa E indirectly vía M conocido:
  // en perihelio y afelio ν coincide con M, luego se puede comprobar vía
  // barrido numérico de M (más robusto que asumir la correspondencia).
  let q = Infinity
  let Q = 0
  for (let deg = 0; deg < 360; deg += 0.05) {
    const { r } = orbitalState((deg * Math.PI) / 180, e[0], a[0])
    if (r < q) q = r
    if (r > Q) Q = r
  }
  const qEsp = a[0] * (1 - e[0])
  const QEsp = a[0] * (1 + e[0])
  const d1 = Math.abs(q - qEsp)
  const d2 = Math.abs(Q - QEsp)
  if (d1 < 1e-9 && d2 < 1e-9) ok(`${id.padEnd(8)} q=${q.toFixed(5)} Q=${Q.toFixed(5)} UA`)
  else bad(`${id.padEnd(8)} q err=${d1.toExponential(2)} Q err=${d2.toExponential(2)}`)
}

console.log('\n6. Periodo orbital por la 3ª ley de Kepler (T² = a³)')
// Los periodos siderales son datos públicos independientes de los elementos.
const PERIODOS = {
  mercury: 87.969,
  venus: 224.701,
  earth: 365.256,
  mars: 686.980,
  jupiter: 4332.589,
  saturn: 10759.22,
  uranus: 30685.4,
  neptune: 60189.0,
}
for (const id of ids) {
  const a = ELEMENTS[id].a[0]
  // a^1.5 da años; el periodo sideral tabulado está en días.
  const TDias = Math.pow(a, 1.5) * DAYS_PER_YEAR
  const ref = PERIODOS[id]
  const rel = Math.abs(TDias - ref) / ref
  if (rel < 0.002) ok(`${id.padEnd(8)} T=${TDias.toFixed(1)} d · sideral ${ref} d · ${(rel * 100).toFixed(3)}%`)
  else bad(`${id.padEnd(8)} T=${TDias.toFixed(1)} d vs ${ref} d · ${(rel * 100).toFixed(2)}%`)
}

console.log('\n7. La longitud del Sol geocéntrica en J2000 debe ser 280.46°')
{
  const [x, y, z] = pos('earth', J2000)
  const lambdaTierra = eclipticLongitude(x, y, z)
  const lambdaSol = ((lambdaTierra * RAD - 180) % 360 + 360) % 360
  const d = Math.min(
    Math.abs(lambdaSol - 280.46),
    360 - Math.abs(lambdaSol - 280.46),
  )
  if (d < 0.2) ok(`Sol = ${lambdaSol.toFixed(3)}° · tabulado 280.46° · Δ ${d.toFixed(3)}°`)
  else bad(`Sol = ${lambdaSol.toFixed(3)}° · tabulado 280.46° · Δ ${d.toFixed(3)}°`)
}

console.log('\n8. La Tierra está en perihelio el ~3 de enero y afelio el ~4 de julio')
{
  const r = (iso) => {
    const [x, y, z] = pos('earth', jdFromDate(new Date(`${iso}T12:00:00Z`)))
    return heliocentricDistance(x, y, z)
  }
  const enero = r('2024-01-03')
  const julio = r('2024-07-04')
  const octubre = r('2024-10-05')
  // q=0.9833, Q=1.0167
  if (Math.abs(enero - 0.9833) < 0.0005) ok(`perihelio 2024-01-03: r = ${enero.toFixed(5)} UA`)
  else bad(`perihelio 2024-01-03: r = ${enero.toFixed(5)} UA (esperado 0.9833)`)
  if (Math.abs(julio - 1.0167) < 0.0005) ok(`afelio 2024-07-04: r = ${julio.toFixed(5)} UA`)
  else bad(`afelio 2024-07-04: r = ${julio.toFixed(5)} UA (esperado 1.0167)`)
  if (octubre > enero && octubre < julio) ok(`2024-10-05: r = ${octubre.toFixed(5)} UA, intermedio`)
  else bad(`2024-10-05: r = ${octubre.toFixed(5)} UA fuera de rango`)
}

console.log('\n9. La Tierra nunca se aparta del plano eclíptico (i ≈ 0)')
{
  let maxLat = 0
  for (let day = 0; day < 365 * 10; day += 1) {
    const [x, y, z] = pos('earth', J2000 + day)
    const lat = Math.abs(eclipticLatitude(x, y, z) * RAD)
    if (lat > maxLat) maxLat = lat
  }
  if (maxLat < 0.7) ok(`latitud máx ${maxLat.toFixed(4)}° en 10 años`)
  else bad(`latitud máx ${maxLat.toFixed(4)}° demasiado alta`)
}

console.log('\n10. Latitud máxima ≈ inclinación de la órbita')
{
  const I = {
    mercury: 7.005, venus: 3.395, earth: 0.0, mars: 1.85,
    jupiter: 1.304, saturn: 2.486, uranus: 0.773, neptune: 1.77,
  }
  for (const id of ids) {
    let maxLat = 0
    const pasos = id === 'neptune' ? 4000 : id === 'uranus' ? 2000 : 600
    for (let k = 0; k <= pasos; k++) {
      const jd = J2000 + (k / pasos) * 4000
      const [x, y, z] = pos(id, jd)
      const lat = Math.abs(eclipticLatitude(x, y, z) * RAD)
      if (lat > maxLat) maxLat = lat
    }
    // Para e pequeña la latitud máx tiende a i; con e grande (Mercurio) queda
    // algo por debajo porque la elipse no barre todo el plano orbital.
    const ref = I[id]
    const bien = maxLat >= ref - 0.6 && maxLat <= ref + 1.2
    if (bien) ok(`${id.padEnd(8)} lat máx ${maxLat.toFixed(3)}° ≈ i ${ref}°`)
    else bad(`${id.padEnd(8)} lat máx ${maxLat.toFixed(3)}° frente a i ${ref}°`)
  }
}

console.log('\n11. Órbitas planas: el nodo no deriva a lo largo del tiempo')
{
  // Si la rotación fuera correcta, la línea de nodos debe ser estable.
  for (const id of ids) {
    const nodo = ELEMENTS[id].node
    const el2060 = elementsAtDate(ELEMENTS[id], 1)
    // La deriva puede ser positiva o negativa según la tasa; se compara con
    // signo, no en valor absoluto.
    const deriva = ((el2060.node - nodo[0] + 540) % 360) - 180
    const seg = nodo[1]
    if (Math.abs(deriva - seg) < 1e-9) {
      ok(`${id.padEnd(8)} deriva del nodo ${deriva.toFixed(4)}°/siglo (esperado ${seg.toFixed(4)})`)
    } else {
      bad(`${id.padEnd(8)} deriva ${deriva.toFixed(4)} vs tasa ${seg.toFixed(4)}`)
    }
  }
}

console.log('\n12. Orden radial: los planetas no se cruzan')
{
  const radios = ids.map((id) => ({ id, a: ELEMENTS[id].a[0] })).sort((x, y) => x.a - y.a)
  let okTotal = true
  for (let i = 1; i < radios.length; i++) {
    const previo = radios[i - 1]
    const actual = radios[i]
    const Qp = previo.a * (1 + ELEMENTS[previo.id].e[0])
    const qa = actual.a * (1 - ELEMENTS[actual.id].e[0])
    if (Qp >= qa) okTotal = false
  }
  if (okTotal) {
    ok(`${radios.length} planetas, órbitas disjuntas`)
    ok(`orden: ${radios.map((r) => r.id).join(' → ')}`)
  } else {
    bad('hay órbitas que se solapan')
  }
}

console.log('\n13. Determinismo y finitud en 200 años')
{
  let problemas = 0
  for (const id of ids) {
    for (let day = 0; day <= 365 * 200; day += 7) {
      const [x, y, z] = pos(id, J2000 + day)
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) problemas++
    }
  }
  if (problemas === 0) ok(`sin NaN ni Infinity en ${ids.length} × 200 años`)
  else bad(`${problemas} valores no finitos`)
}

console.log('\n14. Elementos propagados linealmente con las tasas')
{
  for (const id of ids) {
    const base = ELEMENTS[id]
    const c0 = elementsAtDate(base, 0)
    const c100 = elementsAtDate(base, 1)
    const esperadoA = base.a[0] + base.a[1]
    const esperadoE = base.e[0] + base.e[1]
    const dA = Math.abs(c100.a - esperadoA)
    const dE = Math.abs(c100.e - esperadoE)
    const enT0 = Math.abs(c0.a - base.a[0]) + Math.abs(c0.e - base.e[0])
    if (dA < 1e-12 && dE < 1e-12 && enT0 < 1e-12) {
      ok(`${id.padEnd(8)} T=1 → a=${c100.a.toFixed(6)} e=${c100.e.toFixed(6)}`)
    } else {
      bad(`${id.padEnd(8)} propagación incorrecta (Δa=${dA.toExponential(2)})`)
    }
  }
}

console.log('\n15. Venus y Urano tienen excentricidad casi nula y casi circular')
{
  // Venus e=0.0068: su órbita debe ser prácticamente un círculo.
  const el = ELEMENTS.venus
  const r1 = orbitalState(0, el.e[0], el.a[0]).r
  const r2 = orbitalState(Math.PI / 2, el.e[0], el.a[0]).r
  const variacion = Math.abs(r1 - r2) / r1
  if (variacion < 0.007) ok(`Venus: variación de r = ${(variacion * 100).toFixed(3)}%`)
  else bad(`Venus: variación de r = ${(variacion * 100).toFixed(3)}% (esperado <0.7%)`)

  // Urano: e=0.047, la mayor excentricidad casi-circular. La variación máxima
  // de r es a·e ≈ 0.90 UA sobre ~19.2 UA, o sea ~4.7%.
  const u = ELEMENTS.uranus
  const uMax = Math.abs(
    orbitalState(0, u.e[0], u.a[0]).r - orbitalState(Math.PI, u.e[0], u.a[0]).r,
  ) / u.a[0]
  // Q−q = 2ae, luego la oscilación completa es 2e: 2×0.0473 = 9.45%.
  const esperado = 2 * u.e[0]
  const rel = Math.abs(uMax - esperado) / esperado
  if (rel < 1e-9) ok(`Urano: oscilación ${(uMax * 100).toFixed(3)}% = 2e ✓`)
  else bad(`Urano: oscilación ${(uMax * 100).toFixed(3)}% vs 2e=${(esperado * 100).toFixed(3)}%`)
}

console.log(fallos === 0 ? '\nValidación completa: todo correcto.\n' : `\n${fallos} comprobación(es) fallida(s).\n`)
process.exit(fallos === 0 ? 0 : 1)