import * as THREE from 'three'
import { createControls } from './Controls.js'
import { createSun } from './Sun.js'
import { createStarfield } from './Starfield.js'
import { createPlanet, disposeSharedGeometry } from './Planet.js'
import { createOrbitLine } from './OrbitLine.js'
import { BODIES, SUN, SCENE, orbitUnits, sunRadiusUnits } from '../data/bodies.js'
import { heliocentricPosition, elementsAtDate } from '../lib/kepler.js'
import { daysSinceJ2000, jdFromDate, dateFromJd, J2000 } from '../lib/time.js'

const DEG_TO_RAD = Math.PI / 180

/**
 * Orquestador de la escena.
 *
 * La clase es dueña del renderer y del bucle de animación. React no re-renderiza
 * por frame: solo recibe una instantánea (`onTick`) unas pocas veces por
 * segundo para pintar el HUD.
 */
export class SolarSystemScene {
  constructor(canvas, { onTick = null } = {}) {
    this.canvas = canvas
    this.onTick = onTick

    // Simulación
    this.scaleMode = 'visual'
    this.paused = false
    /** Segundos simulados por segundo real. */
    this.speed = 86400
    this.simDays = daysSinceJ2000(jdFromDate(new Date()))

    this.planets = new Map()
    this.orbits = []
    this.disposables = []
    this._orbitGeometries = new Map()

    this._raf = 0
    this._lastTime = 0
    this._tickAccum = 0
    this._fpsAccum = 0
    this._fpsFrames = 0
    this._fps = 60

    this._initRenderer()
    this._initScene()
    this._buildSystem()
    this._initResize()
    this._start()
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      // Necesario: near 0.01 y far 5e6 en el mismo depth buffer.
      logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
  }

  _initScene() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x02030a)

    this.camera = new THREE.PerspectiveCamera(
      50,
      1,
      SCENE.near,
      SCENE.far,
    )
    // Vista inicial: Júpiter (radio 16) ocupa ~16/300 del alto, así que
    // a 210 unidades la imagen ya tiene planetas reconocibles.
    this.camera.position.set(0, 150, 165)

    this.controls = createControls(this.camera, this.canvas)
    this.controls.target.set(0, 0, 0)
  }

  _buildSystem() {
    this.starfield = createStarfield()
    this.scene.add(this.starfield.group)

    this.sun = createSun({
      radius: sunRadiusUnits(this.scaleMode),
      color: SUN.color,
    })
    this.scene.add(this.sun.group)

    for (const body of BODIES) {
      // Escala de la elipse según el semieje mayor. Es una medida característica,
      // no un radio fijo: la elipse real se genera aparte con Kepler.
      const orbitScale = orbitUnits(body.aAU, this.scaleMode)

      const orbit = createOrbitLine(orbitScale)
      this.scene.add(orbit.line)
      this.orbits.push(orbit)
      this.disposables.push(orbit)
      this._orbitGeometries.set(body.id, { geometry: orbit.geometry, body, scale: orbitScale })

      const planet = createPlanet(body, { scaleMode: this.scaleMode })
      const holder = new THREE.Group()
      holder.name = `${body.id}-holder`
      holder.add(planet.inclinationGroup)
      this.scene.add(holder)

      this.planets.set(body.id, { ...planet, holder, orbitScale, body })
    }

    this._updateOrbitLines()
    this._placePlanets()
  }

  /**
   * Reescribe las líneas de órbita como elipses reales.
   *
   * Se recorre la anomalía excéntrica E, no M: E es el parámetro uniforme en
   * el propio plano orbital, así que los puntos quedan espaciados como en la
   * elipse real y no como en un círculo.
   */
  _updateOrbitLines() {
    for (const { geometry, body, scale } of this._orbitGeometries.values()) {
      const attribute = geometry.getAttribute('position')
      const positions = attribute.array
      const el = elementsAtDate(body.elements, 0)

      const argPeri = el.peri * DEG_TO_RAD
      const node = el.node * DEG_TO_RAD
      const incl = el.i * DEG_TO_RAD

      for (let i = 0; i < attribute.count; i++) {
        const E = (i / (attribute.count - 1)) * Math.PI * 2
        const xOrb = el.a * (Math.cos(E) - el.e)
        const yOrb = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E)

        const step1X = xOrb * Math.cos(argPeri) - yOrb * Math.sin(argPeri)
        const step1Y = xOrb * Math.sin(argPeri) + yOrb * Math.cos(argPeri)
        const step2Y = step1Y * Math.cos(incl)
        const z = step1Y * Math.sin(incl)

        const x = step1X * Math.cos(node) - step2Y * Math.sin(node)
        const y = step1X * Math.sin(node) + step2Y * Math.cos(node)

        // Escala logarítmica comprimida, y el eje Z astronómico pasa a Y.
        positions[i * 3] = x * scale
        positions[i * 3 + 1] = z * scale
        positions[i * 3 + 2] = -y * scale
      }

      attribute.needsUpdate = true
    }
  }

  /** Posición de cada planeta en el instante actual, vía Kepler. */
  _placePlanets() {
    const T = this.simDays / 36525
    const jd = J2000 + this.simDays

    for (const entry of this.planets.values()) {
      const { holder, body } = entry
      const [x, y, z] = heliocentricPosition(body.elements, jd, T)

      holder.position.set(x, z, -y)

      entry.position = holder.position
    }
  }

  _initResize() {
    const resize = () => {
      const parent = this.canvas.parentElement
      const width = parent?.clientWidth || window.innerWidth
      const height = parent?.clientHeight || window.innerHeight
      if (width === 0 || height === 0) return

      this.renderer.setSize(width, height, false)
      this.camera.aspect = width / height
      this.camera.updateProjectionMatrix()
    }

    this._resizeHandler = resize
    window.addEventListener('resize', resize)
    resize()
  }

  _start() {
    this._lastTime = performance.now()
    const loop = (now) => {
      this._raf = requestAnimationFrame(loop)
      const realDelta = Math.min((now - this._lastTime) / 1000, 0.1)
      this._lastTime = now
      this.update(realDelta)
    }
    this._raf = requestAnimationFrame(loop)
  }

  update(realDelta) {
    if (!this.paused) {
      this.simDays += (realDelta * this.speed) / 86400
      this._placePlanets()
      this.sun.spin(this.simDays)
      for (const entry of this.planets.values()) entry.turnSpin(this.simDays)
    }

    this.controls.update()
    this.renderer.render(this.scene, this.camera)

    this._fpsAccum += realDelta
    this._fpsFrames += 1

    // HUD a ~4 Hz.
    this._tickAccum += realDelta
    if (this._tickAccum >= 0.25) {
      if (this._fpsAccum > 0) {
        this._fps = this._fpsFrames / this._fpsAccum
        this._fpsAccum = 0
        this._fpsFrames = 0
      }
      this._tickAccum = 0
      this.onTick?.(this.getSnapshot())
    }
  }

  // --- API pública -------------------------------------------------------

  getSnapshot() {
    return {
      date: this.getDate(),
      fps: this._fps,
      scaleMode: this.scaleMode,
      paused: this.paused,
    }
  }

  getDate() {
    const jd = J2000 + this.simDays
    return dateFromJd(jd)
  }

  setSpeed(secondsPerSecond) {
    this.speed = secondsPerSecond
  }

  setPaused(paused) {
    this.paused = paused
  }

  resetToNow() {
    this.simDays = daysSinceJ2000(jdFromDate(new Date()))
  }

  setDate(date) {
    this.simDays = daysSinceJ2000(jdFromDate(date))
  }

  dispose() {
    cancelAnimationFrame(this._raf)
    window.removeEventListener('resize', this._resizeHandler)
    this._orbitGeometries.clear()

    this.controls.dispose()
    this.starfield.dispose()
    this.sun.dispose()
    disposeSharedGeometry()

    for (const item of this.disposables) item.dispose()
    for (const entry of this.planets.values()) entry.dispose()

    this.renderer.dispose()
  }
}

