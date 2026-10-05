/**
 * Orbital mechanics: elemental kepleriano.
 *
 * Para cada cuerpo se resuelve la ecuación de Kepler
 *
 *     M = E - e·sin E
 *
 * donde M es la anomalía media (ángulo que avanza uniformemente con el tiempo)
 * y E la anomalía excéntrica. Newton-Raphson converge en pocas iteraciones
 * para las excentricidades del sistema solar (la mayor es Plutón, e≈0.249,
 * aunque aquí solo hay planetas, e≤0.205).
 *
 * Fuentes de los elementos: JPL, "Approximate Positions of the Major Planets"
 * (Standish), elementos en J2000 con tasas por siglo.
 */

/** Ecuación de Kepler: resuelve E a partir de M y e. */
export function solveKepler(M, e, { tolerance = 1e-10, maxIterations = 30 } = {}) {
  // Normalizamos M a (-π, π]: improve la convergencia inicial.
  const twoPi = Math.PI * 2
  let m = M % twoPi
  if (m > Math.PI) m -= twoPi
  if (m < -Math.PI) m += twoPi

  if (e < 1e-12) return m // órbita circular: E = M

  // Semilla inicial. La eccentricidad del sistema solar hace que
  // e·sin E ≈ e·sin M sea un buen punto de partida (~1e-3 rad de error).
  let E = m + e * Math.sin(m)

  for (let i = 0; i < maxIterations; i++) {
    const sinE = Math.sin(E)
    const f = E - e * sinE - m // residuo
    if (Math.abs(f) < tolerance) return E

    const fp = 1 - e * Math.cos(E) // derivada
    const delta = f / fp
    E -= delta

    // Salvaguarda: evita bucles si la derivada se acerca a cero
    // (solo posible con e→1, imposible aquí, pero el guard no cuesta nada).
    if (!Number.isFinite(E)) break
  }

  return E
}

/** Anomalía excéntrica. Azúcar sintáctico sobre solveKepler. */
export function eccentricAnomaly(M, e, options) {
  return solveKepler(M, e, options)
}

/**
 * True anomaly and radius in the orbital plane (unidades de UA).
 *
 *   ν = atan2(√(1−e²)·sin E, cos E − e)
 *   r = a·(1 − e·cos E)
 */
export function orbitalState(M, e, aAU) {
  const E = solveKepler(M, e)
  const sinE = Math.sin(E)
  const cosE = Math.cos(E)

  const nu = Math.atan2(Math.sqrt(1 - e * e) * sinE, cosE - e)
  const r = aAU * (1 - e * cosE)

  return { E, nu, r }
}

/**
 * Posición heliocéntrica de un cuerpo en el plano orbital.
 * @returns {[number, number]} [x, y] en AU, con y hacia la anomalía verdadera.
 */
export function positionInOrbitalPlane(M, e, aAU) {
  const { nu, r } = orbitalState(M, e, aAU)
  return [r * Math.cos(nu), r * Math.sin(nu)]
}

/**
 * Elementos propagados a una fecha dada (rates por siglo, JPL).
 */
export function elementsAtDate(elements, centuriesSinceJ2000) {
  const { a, e, i, L, peri, node } = elements
  return {
    a: a[0] + a[1] * centuriesSinceJ2000,
    e: e[0] + e[1] * centuriesSinceJ2000,
    i: i[0] + i[1] * centuriesSinceJ2000,
    L: L[0] + L[1] * centuriesSinceJ2000,
    peri: peri[0] + peri[1] * centuriesSinceJ2000,
    node: node[0] + node[1] * centuriesSinceJ2000,
  }
}

/** Normaliza un ángulo a (-180°, 180°]. */
export function normalizeDegrees(deg) {
  let d = deg % 360
  if (d > 180) d -= 360
  if (d <= -180) d += 360
  return d
}

const DEG = Math.PI / 180

/**
 * Posición heliocéntrica 3D en UA, espacio eclíptico J2000.
 *
 * Rotación orbital en tres ejes, aplicada en orden inverso al de Standish:
 *   M  = L − ϖ  (anomalía media)
 *   x' = a(cos E − e),  y' = a√(1−e²)·sin E
 *   x  = ( cos ω cos Ω − sin ω sin Ω cos i)·x' + (−sin ω cos Ω − cos ω sin Ω cos i)·y'
 *   y  = ( cos ω sin Ω + sin ω cos Ω cos i)·x' + (−sin ω cos Ω + cos ω sin Ω cos i)·y'
 *   z  = ( sin ω sin i)·x' + ( cos ω sin i)·y'
 *
 * @param {object} elements elementos JPL (a, e, i, L, peri, node)
 * @param {number} jd Día Juliano
 * @returns {[number, number, number]} [x, y, z] en UA
 */
export function heliocentricPosition(elements, jd, centuriesSinceJ2000) {
  const el = elementsAtDate(elements, centuriesSinceJ2000)

  const argPeri = el.peri * DEG // ω
  const node = el.node * DEG // Ω
  const incl = el.i * DEG // i

  // Anomalía media en radianes, normalizada por el periodo.
  const M = (el.L - el.peri) * DEG
  const { E } = orbitalState(M, el.e, el.a)

  const xOrb = el.a * (Math.cos(E) - el.e)
  const yOrb = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E)

  // Rotación del plano orbital al plano eclíptico, R = Rz(Ω)·Rx(i)·Rz(ω).
  // Se compone explícitamente en tres pasos en vez de usar una fórmula
  // cerrada: así la ortonormalidad es estructural y no depende de acertar
  // los signos de nueve términos.
  //
  //   1. Rz(ω): del pericentro al eje de la órbita
  //   2. Rx(i): inclinación alrededor del nodo
  //   3. Rz(Ω): del nodo al equinoccio vernal
  const cosW = Math.cos(argPeri), sinW = Math.sin(argPeri)
  const cosO = Math.cos(node), sinO = Math.sin(node)
  const cosI = Math.cos(incl), sinI = Math.sin(incl)

  const step1X = xOrb * cosW - yOrb * sinW
  const step1Y = xOrb * sinW + yOrb * cosW

  const step2Y = step1Y * cosI
  const z = step1Y * sinI

  const x = step1X * cosO - step2Y * sinO
  const y = step1X * sinO + step2Y * cosO

  return [x, y, z]
}