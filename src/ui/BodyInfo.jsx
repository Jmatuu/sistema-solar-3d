const fmt = (value, digits = 2) =>
  value.toLocaleString('es-ES', { maximumFractionDigits: digits })

const SUPERSCRIPT = {
  '-': '⁻',
  0: '⁰',
  1: '¹',
  2: '²',
  3: '³',
  4: '⁴',
  5: '⁵',
  6: '⁶',
  7: '⁷',
  8: '⁸',
  9: '⁹',
}

const toSuper = (n) =>
  String(n)
    .split('')
    .map((d) => SUPERSCRIPT[d] ?? d)
    .join('')

/** Notación científica legible: 5.972 × 10²⁴ kg */
function formatMass(kg) {
  const exponent = Math.floor(Math.log10(kg))
  const mantissa = kg / Math.pow(10, exponent)
  return `${fmt(mantissa, 3)} × 10${toSuper(exponent)} kg`
}

export function BodyInfo({ body }) {
  return (
    <aside className="body-info" aria-live="polite">
      <h2 className="body-info__name">
        <span
          className="body-info__dot"
          style={{ background: `#${body.color.toString(16).padStart(6, '0')}` }}
        />
        {body.name}
      </h2>

      <dl className="body-info__list">
        <div>
          <dt>Distancia al Sol</dt>
          <dd>{fmt(body.aAU, 4)} UA</dd>
        </div>
        <div>
          <dt>Radio medio</dt>
          <dd>{fmt(body.radiusKm, 0)} km</dd>
        </div>
        <div>
          <dt>Masa</dt>
          <dd>{formatMass(body.massKg)} kg</dd>
        </div>
        <div>
          <dt>Rotación</dt>
          <dd>
            {fmt(Math.abs(body.rotationHours), 2)} h
            {body.rotationHours < 0 ? ' (retrógrada)' : ''}
          </dd>
        </div>
        <div>
          <dt>Inclinación axial</dt>
          <dd>{fmt(body.axialTiltDeg, 2)}°</dd>
        </div>
      </dl>
    </aside>
  )
}