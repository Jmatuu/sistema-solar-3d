import * as THREE from 'three'
import { createRadialTexture } from './textures.js'

/**
 * Fondo estelar.
 *
 * Phase 1: tres capas de puntos con tamaño en píxeles constante
 * (`sizeAttenuation: false`), que es lo correcto para un fondo lejano: las
 * estrellas no deben crecer al acercarse la cámara.
 *
 * Phase 4 añade la banda de la Vía Láctea y la scintilación por shader.
 */

const LAYERS = [
  { count: 3200, size: 1.1, color: 0xbfd4ff, opacity: 0.75 },
  { count: 700, size: 2.1, color: 0xffffff, opacity: 0.9 },
  { count: 140, size: 3.6, color: 0xffe6c0, opacity: 1.0 },
]

/** Punto uniforme sobre la esfera de radio `radius`. */
function randomDirection(target, rng) {
  const u = rng() * 2 - 1
  const theta = rng() * Math.PI * 2
  const s = Math.sqrt(1 - u * u)
  target.set(s * Math.cos(theta), u, s * Math.sin(theta))
  return target
}

export function createStarfield({ radius = 3e5, seed = 20241014 } = {}) {
  const group = new THREE.Group()
  group.name = 'starfield'

  // PRNG determinista (mulberry32) para que el cielo sea siempre el mismo.
  let state = seed >>> 0
  const rng = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const texture = createRadialTexture({ size: 64, falloff: 2.6, core: 0.12 })
  const disposables = [texture]
  const scratch = new THREE.Vector3()

  LAYERS.forEach((layer, index) => {
    const positions = new Float32Array(layer.count * 3)
    for (let i = 0; i < layer.count; i++) {
      randomDirection(scratch, rng)
      // Cada capa en una cáscara distinta para que no se solapen.
      const r = radius * (0.8 + index * 0.15)
      positions[i * 3] = scratch.x * r
      positions[i * 3 + 1] = scratch.y * r
      positions[i * 3 + 2] = scratch.z * r
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const material = new THREE.PointsMaterial({
      size: layer.size,
      sizeAttenuation: false,
      color: layer.color,
      map: texture,
      transparent: true,
      opacity: layer.opacity,
      depthWrite: false,
      blending: index === LAYERS.length - 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
    })

    group.add(new THREE.Points(geometry, material))
    disposables.push(geometry, material)
  })

  return {
    group,
    dispose() {
      for (const item of disposables) item.dispose()
    },
  }
}