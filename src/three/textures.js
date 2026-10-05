import * as THREE from 'three'

/**
 * Texturas generadas por código: el proyecto no descarga ningún asset externo.
 */

/** Degradado radial blanco -> transparente, ideal para glows y estrellas. */
export function createRadialTexture({ size = 128, falloff = 2.2, core = 0.06 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(size, size)
  const half = size / 2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - half) / half
      const dy = (y + 0.5 - half) / half
      const d = Math.sqrt(dx * dx + dy * dy)

      let alpha
      if (d <= core) {
        alpha = 1
      } else {
        alpha = Math.pow(Math.max(0, 1 - (d - core) / (1 - core)), falloff)
      }

      const i = (y * size + x) * 4
      img.data[i] = 255
      img.data[i + 1] = 255
      img.data[i + 2] = 255
      img.data[i + 3] = Math.round(alpha * 255)
    }
  }

  ctx.putImageData(img, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}