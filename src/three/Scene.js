import * as THREE from 'three'
import { createControls } from './Controls.js'
import { createSun } from './Sun.js'
import { createStarfield } from './Starfield.js'
import { createPlanet, disposeSharedGeometry } from './Planet.js'
import { createOrbitLine } from './OrbitLine.js'
import { BODIES, SUN, SCENE, orbitUnits, sunRadiusUnits } from '../data/bodies.js'
import { scenePositionFor, sceneOrbitPointAt } from '../lib/orbits.js'
import { daysSinceJ2000, jdFromDate, dateFromJd, J2000 } from '../lib/time.js'

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
      // La elipse real la escribe `_updateOrbitLines` justo debajo, con
      // `sceneOrbitPointAt`. El radio que se pasa aquí solo rellena el círculo
      // inicial para que la geometría no nazca degenerada; no es el que acaba
      // viéndose.
      const orbit = createOrbitLine(orbitUnits(body.aAU, this.scaleMode))
      this.scene.add(orbit.line)
      this.orbits.push(orbit)
      this.disposables.push(orbit)
      this._orbitGeometries.set(body.id, { geometry: orbit.geometry, body })

      const planet = createPlanet(body, { scaleMode: this.scaleMode })
      const holder = new THREE.Group()
      holder.name = `${body.id}-holder`
      holder.add(planet.inclinationGroup)
      this.scene.add(holder)

      this.planets.set(body.id, { ...planet, holder, body })
    }

    this._updateOrbitLines()
    this._placePlanets()
  }

  /**
   * Reescribe las líneas de órbita como elipses reales.
   *
   * El barrido y el escalado los hace `sceneOrbitPointAt`, la misma función
   * pura que usan los tests. Aquí solo se copia el resultado al BufferAttribute.
   */
  _updateOrbitLines() {
    for (const { geometry, body } of this._orbitGeometries.values()) {
      const attribute = geometry.getAttribute('position')
      const positions = attribute.array
      const count = attribute.count

      for (let i = 0; i < count; i++) {
        const E = (i / (count - 1)) * Math.PI * 2
        const [x, y, z] = sceneOrbitPointAt(body, E, this.scaleMode)
        positions[i * 3] = x
        positions[i * 3 + 1] = y
        positions[i * 3 + 2] = z
      }

      attribute.needsUpdate = true
    }
  }

  /** Posición de cada planeta en el instante actual, vía Kepler. */
  _placePlanets() {
    for (const { holder, body } of this.planets.values()) {
      const [x, y, z] = scenePositionFor(body, this.simDays, this.scaleMode)
      holder.position.set(x, y, z)
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

