import { useEffect, useRef, useState } from 'react'
import { SolarSystemScene } from './three/Scene.js'
import { TimeControls } from './ui/TimeControls.jsx'
import { BodyInfo } from './ui/BodyInfo.jsx'
import { BODIES, findBody } from './data/bodies.js'

const formatDate = (date) =>
  date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

export default function App() {
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)

  const [snapshot, setSnapshot] = useState(null)
  const [selected, setSelected] = useState('earth')
  const [error, setError] = useState(null)

  useEffect(() => {
    try {
      const scene = new SolarSystemScene(canvasRef.current, {
        onTick: setSnapshot,
      })
      sceneRef.current = scene
    } catch (err) {
      console.error(err)
      setError(err?.message ?? 'No se pudo inicializar WebGL')
    }

    return () => {
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [])

  const body = findBody(selected)

  return (
    <div className="app">
      <canvas ref={canvasRef} className="canvas" />

      <header className="hud hud-top">
        <h1 className="title">Sistema Solar</h1>
        <p className="subtitle">
          Simulador 3D · posiciones calculadas
          {snapshot ? ` · ${Math.round(snapshot.fps)} fps` : ''}
        </p>
      </header>

      {body && <BodyInfo body={body} />}

      <footer className="hud hud-bottom">
        <TimeControls
          snapshot={snapshot}
          onSpeed={(s) => sceneRef.current?.setSpeed(s)}
          onPause={(p) => sceneRef.current?.setPaused(p)}
          onNow={() => sceneRef.current?.resetToNow()}
        />
      </footer>

      <nav className="body-nav" aria-label="Seleccionar cuerpo">
        {BODIES.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`body-nav__item${b.id === selected ? ' is-active' : ''}`}
            onClick={() => setSelected(b.id)}
          >
            <span
              className="body-nav__dot"
              style={{ background: `#${b.color.toString(16).padStart(6, '0')}` }}
            />
            {b.name}
          </button>
        ))}
      </nav>

      {error && (
        <div className="error" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {snapshot && (
        <div className="date-readout" aria-live="off">
          {formatDate(snapshot.date)}
        </div>
      )}
    </div>
  )
}