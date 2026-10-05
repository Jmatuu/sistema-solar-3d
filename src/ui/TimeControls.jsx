import { useState } from 'react'

const SPEEDS = [
  { label: '1 min/s', seconds: 60 },
  { label: '1 h/s', seconds: 3600 },
  { label: '1 día/s', seconds: 86400 },
  { label: '10 días/s', seconds: 864000 },
  { label: '1 año/s', seconds: 31557600 },
]

export function TimeControls({ snapshot, onSpeed, onPause, onNow }) {
  const [speed, setSpeed] = useState(SPEEDS[2].seconds)
  const [paused, setPaused] = useState(false)

  const handleSpeed = (value) => {
    setSpeed(value)
    onSpeed?.(value)
  }

  const handlePause = () => {
    const next = !paused
    setPaused(next)
    onPause?.(next)
  }

  return (
    <div className="controls">
      <button
        type="button"
        className="btn btn--primary"
        onClick={handlePause}
        aria-pressed={paused}
      >
        {paused ? '▶ Reanudar' : '❚❚ Pausar'}
      </button>

      <div className="controls__group" role="group" aria-label="Velocidad">
        {SPEEDS.map((s) => (
          <button
            key={s.label}
            type="button"
            className={`btn${s.seconds === speed ? ' is-active' : ''}`}
            onClick={() => handleSpeed(s.seconds)}
            aria-pressed={s.seconds === speed}
          >
            {s.label}
          </button>
        ))}
      </div>

      <button type="button" className="btn" onClick={onNow}>
        Ahora
      </button>

      {snapshot?.paused !== undefined && (
        <span className="controls__status">
          {snapshot.paused ? 'En pausa' : 'En marcha'}
        </span>
      )}
    </div>
  )
}

export { SPEEDS }