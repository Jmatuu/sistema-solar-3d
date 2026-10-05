/**
 * Rotación de la elipse al plano de la escena.
 *
 * `heliocentricPosition` devuelve coordenadas en el espacio eclíptico J2000
 * (Z hacia el norte eclíptico). Three.js trabaja en Y-up, así que el eje Z
 * astronómico se pasa a Y. El plano de la eclíptica queda en XZ.
 *
 * Se mantiene el sentido de órbita directo (antihorario visto desde el norte
 * eclíptico), que es el real.
 */

import { heliocentricPosition, elementsAtDate } from './kepler.js'
import { J2000 } from './time.js'
import { unitsPerAUFor } from '../data/bodies.js'

const DEG = Math.PI / 180

/** Longitud de arco geocéntrica, en radianes. */
export function eclipticLongitude(x, y, z) {
  return Math.atan2(y, x)
}

/** Latitud geocéntrica, en radianes. */
export function eclipticLatitude(x, y, z) {
  const r = Math.hypot(x, y, z)
  if (r === 0) return 0
  return Math.asin(z / r)
}

/** Distancia heliocéntrica en UA. */
export function heliocentricDistance(x, y, z) {
  return Math.hypot(x, y, z)
}

/**
 * Posición de un cuerpo en unidades de escena, lista para Three.js.
 *
 * El cambio de ejes va aquí dentro a propósito: antes vivía suelto en
 * `three/Scene.js` y también existía como `toSceneSpace` en este módulo, sin
 * que nadie usara la segunda. Dos caminos al mismo cálculo es el tipo de
 * duplicado que se desincroniza en silencio.
 *
 * Es además el único punto donde se convierte de UA a unidades de escena.
 * Vive aquí, y no dentro de `three/Scene.js`, por un motivo concreto: en la
 * fase 2 los tests reimplementaron el escalado a mano en lugar de llamar al
 * código de producción, y dieron verde con la escena rota. Al ser pura y no
 * depender de WebGL, los tests pueden ejercer el mismo camino que el render.
 *
 * @param {object} body entrada de BODIES
 * @param {number} simDays días desde J2000
 * @param {'visual'|'real'} mode
 * @returns {[number, number, number]} [x, y, z] en unidades de escena, Y arriba
 */
export function scenePositionFor(body, simDays, mode = 'visual') {
  const T = simDays / 36525
  const jd = J2000 + simDays
  const [x, y, z] = heliocentricPosition(body.elements, jd, T)
  const f = unitsPerAUFor(body.aAU, mode)
  return [x * f, z * f, -y * f]
}

/**
 * Punto de la elipse orbital en unidades de escena, para la anomalía
 * excéntrica E.
 *
 * Se recorre E y no M a propósito: E es el parámetro uniforme dentro del
 * propio plano orbital, así que los puntos se reparten como en la elipse real y
 * no como en un círculo. Devuelve un array para poder escribirlo directo en el
 * BufferAttribute de la línea de órbita.
 *
 * @param {object} body entrada de BODIES
 * @param {number} E anomalía excéntrica en radianes
 * @param {'visual'|'real'} mode
 * @returns {number[]} [x, y, z] en unidades de escena
 */
export function sceneOrbitPointAt(body, E, mode = 'visual') {
  const el = elementsAtDate(body.elements, 0)
  const argPeri = el.peri * DEG
  const node = el.node * DEG
  const incl = el.i * DEG

  const xOrb = el.a * (Math.cos(E) - el.e)
  const yOrb = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E)

  const step1X = xOrb * Math.cos(argPeri) - yOrb * Math.sin(argPeri)
  const step1Y = xOrb * Math.sin(argPeri) + yOrb * Math.cos(argPeri)
  const step2Y = step1Y * Math.cos(incl)
  const z = step1Y * Math.sin(incl)

  const x = step1X * Math.cos(node) - step2Y * Math.sin(node)
  const y = step1X * Math.sin(node) + step2Y * Math.cos(node)

  const f = unitsPerAUFor(body.aAU, mode)
  return [x * f, z * f, -y * f]
}