/**
 * Conversiones de tiempo astronómico.
 * Toda la simulación trabaja en Día Juliano (JD,UT1 ~ UTC).
 */

export const J1970 = 2440587.5 // 1970-01-01T00:00:00Z
export const J2000 = 2451545.0 // 2000-01-01T12:00:00Z
export const DAY_MS = 86400000
export const DAYS_PER_YEAR = 365.25

/** Date (o epoch ms) -> Día Juliano */
export function jdFromDate(date) {
  const ms = date instanceof Date ? date.getTime() : date
  return ms / DAY_MS + J1970
}

/** Día Juliano -> Date */
export function dateFromJd(jd) {
  return new Date((jd - J1970) * DAY_MS)
}

/** Días transcurridos desde J2000 */
export function daysSinceJ2000(jd) {
  return jd - J2000
}

/** Siglos julianos desde J2000 (necesario para las efemérides) */
export function centuriesSinceJ2000(jd) {
  return (jd - J2000) / 36525
}

/**
 * Periodo orbital circular a partir del semieje mayor (3ª ley de Kepler).
 * Sirve como valor por defecto hasta que Phase 2 conecte los elementos
 * keplerianos reales de JPL.
 */
export function periodDaysFromSemiMajorAxis(aAU) {
  return DAYS_PER_YEAR * Math.pow(aAU, 1.5)
}