import * as THREE from 'three'

/**
 * Línea de órbita.
 *
 * La geometría nace como un círculo de radio `radius` y `Scene` la sobrescribe
 * con la elipse real (ver `_updateOrbitLines`). Se reservan `segments + 1`
 * vértices porque el barrido recorre E de 0 a 2π con ambos extremos
 * incluidos, de modo que la elipse cierra sin hueco.
 */
export function createOrbitLine(radius, { color = 0x27364d, opacity = 0.6, segments = 512 } = {}) {
  const vertexCount = segments + 1
  const positions = new Float32Array(vertexCount * 3)
  for (let i = 0; i < vertexCount; i++) {
    const angle = (i / segments) * Math.PI * 2
    positions[i * 3] = Math.cos(angle) * radius
    positions[i * 3 + 1] = 0
    positions[i * 3 + 2] = Math.sin(angle) * radius
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
  })

  // Line en vez de LineLoop: el barrido ya cierra la elipse con el primer y el
  // último vértice, y así se evita duplicar el punto de cierre.
  const line = new THREE.Line(geometry, material)
  line.name = 'orbit'
  line.userData.segments = segments

  return {
    line,
    geometry,
    material,
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}