import * as THREE from 'three'
import { createRadialTexture } from './textures.js'

/**
 * El Sol: núcleo emisivo, dos capas de glow aditivo y la luz puntual que
 * ilumina el resto del sistema.
 *
 * La luz usa decay = 0 para que el brillo no caiga con la distancia: en un
 * modelo astronómico importa la posición, no la potencia relativa.
 */
export function createSun({ radius, color }) {
  const group = new THREE.Group()
  group.name = 'sun'

  const coreGeometry = new THREE.SphereGeometry(radius, 64, 48)
  const coreMaterial = new THREE.MeshBasicMaterial({ color })
  const core = new THREE.Mesh(coreGeometry, coreMaterial)
  group.add(core)

  const glowTexture = createRadialTexture({ falloff: 3.4, core: 0.02 })

  const coronaMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color,
    transparent: true,
    opacity: 0.30,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  // El halo se limita a ~2.6x el radio: la órbita de Mercurio está a 8
  // unidades y una corona mayor se la tragaría.
  const corona = new THREE.Sprite(coronaMaterial)
  corona.scale.setScalar(radius * 2.6)
  group.add(corona)

  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const glow = new THREE.Sprite(glowMaterial)
  glow.scale.setScalar(radius * 1.5)
  group.add(glow)

  const light = new THREE.PointLight(0xfff4dd, 3.2, 0, 0)
  group.add(light)

  return {
    group,
    core,
    corona,
    glow,
    light,
    /** Gira el Sol y devuelve el ángulo de rotación (rad). */
    spin(simDays) {
      const days = 25.38
      core.rotation.y = (simDays / days) * Math.PI * 2
    },
    dispose() {
      coreGeometry.dispose()
      coreMaterial.dispose()
      glowTexture.dispose()
      coronaMaterial.dispose()
      glowMaterial.dispose()
    },
  }
}