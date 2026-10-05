import * as THREE from 'three'
import { radiusUnits } from '../data/bodies.js'

/**
 * Planetas.
 *
 * Phase 1: esferas lisas con material estándar. Phase 3 sustituye el
 * material por texturas procedurales, añade lunas, anillos y la atmósfera
 * Fresnel; el grupo tilted/spin de aquí se mantiene como punto de anclaje.
 */

// Geometría compartida: todos los planetas escalan la misma esfera.
let sharedGeometry = null
function sphereGeometry() {
  if (!sharedGeometry) sharedGeometry = new THREE.SphereGeometry(1, 48, 32)
  return sharedGeometry
}

/** Libera la esfera compartida. Lo llama la escena al destruirse. */
export function disposeSharedGeometry() {
  if (sharedGeometry) {
    sharedGeometry.dispose()
    sharedGeometry = null
  }
}

export function createPlanet(body, { scaleMode = 'visual' } = {}) {
  // inclinationGroup: porta el eje inclinado del cuerpo.
  //   spinGroup: gira sobre su propio eje (no pisa la inclinación).
  const inclinationGroup = new THREE.Group()
  inclinationGroup.name = body.id

  inclinationGroup.rotation.z = THREE.MathUtils.degToRad(body.axialTiltDeg ?? 0)

  const spinGroup = new THREE.Group()
  inclinationGroup.add(spinGroup)

  const radius = radiusUnits(body.radiusKm, scaleMode)

  const material = new THREE.MeshStandardMaterial({
    color: body.color,
    roughness: 0.92,
    metalness: 0.0,
    flatShading: false,
  })

  const mesh = new THREE.Mesh(sphereGeometry(), material)
  mesh.scale.setScalar(radius)
  mesh.name = `${body.id}-mesh`
  spinGroup.add(mesh)

  // Rotation angular por día simulado. Negativo = retrógrado.
  const turnsPerSimDay = 1 / (body.rotationHours / 24)

  return {
    body,
    radius,
    mesh,
    spinGroup,
    inclinationGroup,
    turnSpin(simDays) {
      spinGroup.rotation.y = simDays * turnsPerSimDay * Math.PI * 2
    },
    setScaleMode(mode) {
      mesh.scale.setScalar(radiusUnits(body.radiusKm, mode))
    },
    dispose() {
      // La geometría es compartida: la libera la escena una sola vez
      // con disposeSharedGeometry().
      material.dispose()
    },
  }
}