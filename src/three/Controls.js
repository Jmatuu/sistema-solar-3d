import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/**
 * OrbitControls con límites pensados para la escena astronómica:
 * zoom muy cercano (para inspeccionar un planeta) y muy lejano (sistema entero).
 */
export function createControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement)

  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.rotateSpeed = 0.6
  controls.zoomSpeed = 0.9
  controls.panSpeed = 0.6

  controls.minDistance = 0.05
  controls.maxDistance = 4000

  controls.screenSpacePanning = true

  controls.update()
  return controls
}