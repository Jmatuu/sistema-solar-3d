/**
 * Datos de los cuerpos del sistema solar.
 *
 * Fuentes: elementos orbitales y datos físicos J2000 (NASA/JPL, Standish).
 * Los radios medios son los valores publicados en el planetary fact sheet.
 *
 * Phase 2: `aAU` pasa a derivarse de `elements.a[0]` y las órbitas ya no son
 * círculos: `elements` alimenta el solver de Kepler. `phaseDeg` queda sin uso
 * y se conserva solo como documentación del layout de la fase 1.
 */

export const AU_KM = 149597870.7

/** Configuración de la escala de la escena. */
export const SCENE = {
  // Escala real: 1 UA -> 30 unidades.
  unitsPerAU: 30,
  // Escala visual: compresión logarítmica de las distancias.
  orbitVisual: { min: 8, max: 320 },
  // Escala visual: compresión logarítmica de los radios.
  radiusVisual: { min: 0.9, max: 16 },
  // El Sol queda fuera del dominio logarítmico de los planetas (69911 km),
  // así que su radio visual se fija aparte. Se mantiene por debajo de Júpiter
  // (16) y por encima de la órbita de Mercurio no debe invadir el espacio
  // planetario: 4.5 unidades deja la corona dentro de la órbita más interior.
  sunRadiusVisual: 4.5,
  near: 0.01,
  far: 5e6,
}

const ORBIT_DOMAIN = { min: 0.38709927, max: 30.06992276 } // Mercurio .. Neptuno
const RADIUS_DOMAIN = { min: 2439.7, max: 69911 } // Mercurio .. Júpiter

/** Interpolación logarítmica: reparte bien valores muy dispares. */
function logMap(value, domain, range) {
  const { min: dMin, max: dMax } = domain
  const { min: rMin, max: rMax } = range
  const t = (Math.log(value) - Math.log(dMin)) / (Math.log(dMax) - Math.log(dMin))
  const clamped = Math.min(1, Math.max(0, t))
  return rMin + clamped * (rMax - rMin)
}

/**
 * Distancia orbital característica en unidades de escena.
 *
 * Con órbitas elípticas ya no hay un radio único: este valor usa el semieje
 * mayor y solo sirve para dimensionar la cámara y las líneas guía, no para
 * colocar los cuerpos (eso lo hace el solver de Kepler).
 *
 * @param {number} aAU semieje mayor en UA
 * @param {'visual'|'real'} mode
 */
export function orbitUnits(aAU, mode = 'visual') {
  if (mode === 'real') return aAU * SCENE.unitsPerAU
  return logMap(aAU, ORBIT_DOMAIN, SCENE.orbitVisual)
}

/**
 * Radio del cuerpo en unidades de escena.
 * @param {number} radiusKm radio medio en km
 * @param {'visual'|'real'} mode
 */
export function radiusUnits(radiusKm, mode = 'visual') {
  if (mode === 'real') return (radiusKm / AU_KM) * SCENE.unitsPerAU
  return logMap(radiusKm, RADIUS_DOMAIN, SCENE.radiusVisual)
}

/** Radio visual del Sol (fuera del dominio logarítmico de los planetas). */
export function sunRadiusUnits(mode = 'visual') {
  if (mode === 'real') return (SUN.radiusKm / AU_KM) * SCENE.unitsPerAU
  return SCENE.sunRadiusVisual
}

/**
 * Factor de conversión de UA a unidades de escena, para un semieje mayor dado.
 *
 * `orbitUnits` devuelve una DISTANCIA en unidades de escena. Esto es el FACTOR
 * que hay que multiplicar por una posición expresada en UA. No son lo mismo, y
 * confundirlos causó dos bugs en la fase 2: los planetas se colocaban en
 * unidades de UA (todos apilados en el centro, embarridos por la corona solar) y
 * las líneas de órbita salían multiplicadas por el semieje mayor.
 *
 * Se define como `distancia(a) / a` para que en r = a el cuerpo caiga
 * exactamente en la distancia característica, igual que en la fase 1.
 *
 * @param {number} aAU semieje mayor en UA
 * @param {'visual'|'real'} mode
 * @returns {number} unidades de escena por UA
 */
export function unitsPerAUFor(aAU, mode = 'visual') {
  if (mode === 'real') return SCENE.unitsPerAU
  return orbitUnits(aAU, mode) / aAU
}

/**
 * Elementos keplerianos J2000 de JPL (Standish, "Approximate Positions of the
 * Major Planets"), con las tasas de variación por siglo.
 *
 * Cada entrada es [valor en J2000, tasa por siglo]:
 *   a    semieje mayor            AU
 *   e    excentricidad            —
 *   i    inclinación              grados
 *   L    longitud media           grados
 *   peri longitud del perihelio  grados
 *   node longitud del nodo       grados
 *
 * Válidos para 1800-2050, que es lo que importa aquí. Para fechas fuera de ese
 * rango la posición se degradaría; el error sigue siendo pequeño hasta 3000.
 *
 * Los valores de la Tierra son los del baricentro Tierra-Luna.
 */
export const ELEMENTS = {
  mercury: {
    a: [0.38709927, 0.00000037],
    e: [0.20563593, 0.00001906],
    i: [7.00497902, -0.00594749],
    L: [252.2503235, 149472.67411175],
    peri: [77.45779628, 0.16047689],
    node: [48.33076593, -0.12534081],
  },
  venus: {
    a: [0.72333566, 0.0000039],
    e: [0.00677672, -0.00004107],
    i: [3.39467605, -0.0007889],
    L: [181.9790995, 58517.81538729],
    peri: [131.60246718, 0.00268329],
    node: [76.67984255, -0.27769418],
  },
  earth: {
    a: [1.00000261, 0.00000562],
    e: [0.01671123, -0.00004392],
    i: [-0.00001531, -0.01294668],
    L: [100.46457166, 35999.37244981],
    peri: [102.93768193, 0.32327364],
    node: [0.0, 0.0],
  },
  mars: {
    a: [1.52371034, 0.00001847],
    e: [0.0933941, 0.00007882],
    i: [1.84969142, -0.00813131],
    L: [-4.55343205, 19140.30268499],
    peri: [-23.94362959, 0.44441088],
    node: [49.55953891, -0.29257343],
  },
  jupiter: {
    a: [5.202887, -0.00011607],
    e: [0.04838624, -0.00013253],
    i: [1.30439695, -0.00183714],
    L: [34.39644051, 3034.74612775],
    peri: [14.72847983, 0.21252668],
    node: [100.47390909, 0.20469106],
  },
  saturn: {
    a: [9.53667594, -0.0012506],
    e: [0.05386179, -0.00050991],
    i: [2.48599187, 0.00193609],
    L: [49.95424423, 1222.49362201],
    peri: [92.59887831, -0.41897216],
    node: [113.66242448, -0.28867794],
  },
  uranus: {
    a: [19.18916464, -0.00196176],
    e: [0.04725744, -0.00004397],
    i: [0.77263783, -0.00242939],
    L: [313.23810451, 428.48202785],
    peri: [170.9542763, 0.40805281],
    node: [74.01692503, 0.04240589],
  },
  neptune: {
    a: [30.06992276, 0.00026291],
    e: [0.00859048, 0.00005105],
    i: [1.77004347, 0.00035372],
    L: [-55.12002969, 218.45945325],
    peri: [44.96476227, -0.32241464],
    node: [131.78422574, -0.00508664],
  },
}

export const SUN = {
  id: 'sun',
  name: 'Sol',
  kind: 'star',
  radiusKm: 696340,
  color: 0xfff2cf,
  rotationHours: 609.12, // 25.38 días en el ecuador solar
}

export const BODIES = [
  {
    id: 'mercury',
    name: 'Mercurio',
    kind: 'planet',
    elements: ELEMENTS.mercury,
    aAU: ELEMENTS.mercury.a[0],
    radiusKm: 2439.7,
    rotationHours: 1407.6,
    axialTiltDeg: 0.034,
    color: 0xa8a29b,
    massKg: 3.3011e23,
  },
  {
    id: 'venus',
    name: 'Venus',
    kind: 'planet',
    elements: ELEMENTS.venus,
    aAU: ELEMENTS.venus.a[0],
    radiusKm: 6051.8,
    rotationHours: -5832.5, // retrógrado
    axialTiltDeg: 177.36,
    color: 0xe6c88f,
    massKg: 4.8675e24,
  },
  {
    id: 'earth',
    name: 'Tierra',
    kind: 'planet',
    elements: ELEMENTS.earth,
    aAU: ELEMENTS.earth.a[0],
    radiusKm: 6371.0,
    rotationHours: 23.9345,
    axialTiltDeg: 23.44,
    color: 0x3b7dd8,
    massKg: 5.97237e24,
  },
  {
    id: 'mars',
    name: 'Marte',
    kind: 'planet',
    elements: ELEMENTS.mars,
    aAU: ELEMENTS.mars.a[0],
    radiusKm: 3389.5,
    rotationHours: 24.6229,
    axialTiltDeg: 25.19,
    color: 0xc1543a,
    massKg: 6.4171e23,
  },
  {
    id: 'jupiter',
    name: 'Júpiter',
    kind: 'planet',
    elements: ELEMENTS.jupiter,
    aAU: ELEMENTS.jupiter.a[0],
    radiusKm: 69911,
    rotationHours: 9.925,
    axialTiltDeg: 3.13,
    color: 0xd8a878,
    massKg: 1.8982e27,
    hasRings: true,
  },
  {
    id: 'saturn',
    name: 'Saturno',
    kind: 'planet',
    elements: ELEMENTS.saturn,
    aAU: ELEMENTS.saturn.a[0],
    radiusKm: 58232,
    rotationHours: 10.656,
    axialTiltDeg: 26.73,
    color: 0xe0c48f,
    massKg: 5.6834e26,
    hasRings: true,
  },
  {
    id: 'uranus',
    name: 'Urano',
    kind: 'planet',
    elements: ELEMENTS.uranus,
    aAU: ELEMENTS.uranus.a[0],
    radiusKm: 25362,
    rotationHours: -17.24, // retrógrado
    axialTiltDeg: 97.77,
    color: 0x9fdce0,
    massKg: 8.681e25,
    hasRings: true,
  },
  {
    id: 'neptune',
    name: 'Neptuno',
    kind: 'planet',
    elements: ELEMENTS.neptune,
    aAU: ELEMENTS.neptune.a[0],
    radiusKm: 24622,
    rotationHours: 16.11,
    axialTiltDeg: 28.32,
    color: 0x4a6fd4,
    massKg: 1.02413e26,
  },
]

export const ALL_BODIES = [SUN, ...BODIES]

export function findBody(id) {
  return ALL_BODIES.find((b) => b.id === id) ?? null
}