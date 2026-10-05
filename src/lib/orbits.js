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
 * Traduce la posición eclíptica J2000 a coordenadas de escena (Y arriba).
 * @returns {[number, number, number]}
 */
export function toSceneSpace(x, y, z) {
  return [x, z, -y]
}