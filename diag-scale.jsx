/**
 * Diagnóstico de escala: imprime, por planeta, la distancia mínima y máxima
 * medida con la función de producción (`scenePositionFor`), más el radio visual.
 * Sirve para contrastar a ojo lo que se ve en el render.
 *
 *   vite build --ssr diag-scale.jsx --outDir dist-diag --logLevel error
 *   node dist-diag/diag-scale.js
 */
import { BODIES, SUN, radiusUnits, sunRadiusUnits } from './src/data/bodies.js'
import { scenePositionFor } from './src/lib/orbits.js'

console.log(`Sol: radio ${sunRadiusUnits().toFixed(2)}, corona ${(sunRadiusUnits() * 2.6 / 2).toFixed(2)}`)
console.log('')
console.log('cuerpo      q(unidades)   Q(unidades)   radio   Q/radio')
for (const b of BODIES) {
  const periodo = Math.pow(b.elements.a[0], 1.5) * 365.25
  let min = Infinity
  let max = 0
  for (let k = 0; k <= 720; k++) {
    const p = scenePositionFor(b, (k / 720) * periodo)
    const d = Math.hypot(p[0], p[1], p[2])
    if (d < min) min = d
    if (d > max) max = d
  }
  const r = radiusUnits(b.radiusKm)
  console.log(
    `${b.id.padEnd(10)}  ${min.toFixed(2).padStart(9)}   ${max.toFixed(2).padStart(9)}   ` +
    `${r.toFixed(2).padStart(5)}   ${(max / r).toFixed(1).padStart(6)}`,
  )
}
