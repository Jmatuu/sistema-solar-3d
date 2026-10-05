# Sistema Solar · Simulador 3D

Simulador del sistema solar en React + Three.js. Sin APIs externas: los datos
astronómicos van embebidos en el código.

## Estado

- [x] **Fase 1** — Base del proyecto, escena, cámara, controles, Sol y planetas
      como esferas lisas con órbitas circulares.
- [x] **Fase 2** — Elementos keplerianos de JPL, solver de Kepler y órbitas
      elípticas reales. Las posiciones ya son correctas para cualquier fecha.
- [ ] Fase 3 — Texturas procedurales, lunas, anillos y atmósferas.
- [ ] Fase 4 — Vía Láctea y scintilación.
- [ ] Fase 5 — Foco de cámara con click y panel de datos completo.
- [ ] Fase 6 — Conmutador de escala real / visual.

Las posiciones orbitales son reales: se calculan con los elementos keplerianos
de JPL (Standish), no con círculos ni periodos aproximados. Los planetas siguen
siendo esferas lisas y aún no hay lunas ni anillos, eso llega en la fase 3.

## Requisitos

- Node.js 20.19+ o 22.12+ (Vite 6 pide eso; con 20.15 avisa pero funciona)
- npm 10+

## Uso

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # genera dist/
npm run preview  # sirve dist/
npm run check       # imports + montaje de componentes + integridad de datos
npm run validate    # valida el solver de Kepler contra invariantes y efemérides
npm run test        # todo lo anterior más el build. Ejecuta esto antes de cerrar una fase.
```

## Estructura

```
src/
├─ main.jsx
├─ App.jsx              # canvas + HUD; estado de React
├─ styles.css
├─ data/
│  └─ bodies.js         # datos JPL J2000 + elementos keplerianos + escala
├─ lib/
│  ├─ time.js           # Día Juliano, periodos orbitales
│  ├─ kepler.js         # solver de Kepler y posición heliocéntrica
│  └─ orbits.js         # conversión a coordenadas de escena
├─ three/
│  ├─ Scene.js          # renderer, bucle, posiciones
│  ├─ Controls.js       # OrbitControls
│  ├─ Sun.js            # núcleo, glow, luz puntual
│  ├─ Planet.js         # esferas con eje inclinado
│  ├─ OrbitLine.js      # elipses orbitales
│  ├─ Starfield.js      # fondo de 3 capas de puntos
│  └─ textures.js       # texturas por canvas
└─ ui/
   ├─ TimeControls.jsx
   └─ BodyInfo.jsx
```

## Decisiones de diseño

**El bucle no pasa por React.** `SolarSystemScene` es dueña del
`requestAnimationFrame` y del renderer. React recibe una instantánea a 4 Hz
para el HUD (`onTick`), así que mover la cámara o el tiempo no dispara renders
de React.

**Escala visual comprimida.** Distancias y radios usan compresión logarítmica
(`logMap` en `data/bodies.js`): sin ella Mercurio sería invisible y Neptuno
estaría a 3 millones de píxeles. El rango va de 8 a 320 unidades para las
órbitas y de 0.9 a 16 para los radios. Cada planeta queda con su radio menor
que la mitad de su órbita.

**El Sol tiene radio propio.** Sus 696 000 km quedan fuera del dominio
logarítmico que calibra los planetas, así que `sunRadiusUnits` lo fija en 4.5
unidades: por debajo de Júpiter, y con la corona a 2.6x para no invadir la
órbita de Mercurio (8 unidades).

**Sin assets externos.** Las texturas de glow se generan con canvas
(`textures.js`). Nada que descargar, y el glow escala sin pérdida.

**Rotación orbital compuesta, no en forma cerrada.** La matriz que lleva el
plano orbital al plano eclíptico se construye como `Rz(Ω)·Rx(i)·Rz(ω)`, en tres
pasos explícitos. La versión de una sola línea con nueve términos tenía errores
de signo: no era ortonormal, y el fallo crecía con el ángulo de nodo (Mercurio
se desviaba 122°, la Tierra solo 0.7°). Componer las rotaciones hace que la
correctitud sea estructural.

**El eje Z astronómico se pasa a Y.** `heliocentricPosition` devuelve el espacio
eclíptico J2000 con Z al norte; Three.js usa Y-up, así que la escena intercambia
los ejes. Por eso en `Scene.js` se escribe `holder.position.set(x, z, -y)`.

**`logarithmicDepthBuffer`.** Necesario porque el rango de profundidad va de
0.01 a 5e6; con el buffer estándar se produce z-fighting al hacer zoom.

**Luz con `decay = 0`.** En un modelo astronómico importa la posición del
cuerpo, no su distancia al Sol, así que la intensidad no cae con el cuadrado
de la distancia.

## Verificación

### `npm run test`

Ejecuta las tres comprobaciones y el build. Es lo que hay que pasar antes de
cerrar una fase. Sale distinto de 0 si algo falla.

### `npm run check`

Hace dos cosas distintas:

1. **Comprobación estática de imports** (`check-imports.mjs`). Resuelve cada
   `import { a, b } from './x.js'` contra los `export` reales del módulo destino,
   y detecta identificadores usados pero no declarados ni importados. Es
   estático: no necesita navegador ni cargar three.

   Existe por dos fallos reales. El primero fue un `useState` usado sin
   importar en `TimeControls`. El segundo, quitar `SUN` del import de
   `Scene.js` al limpiar símbolos aparentemente sin usar mientras la línea
   `color: SUN.color` seguía ahí. EseBuilding dio la web en blanco con el build
   en verde, porque `vite build` no ejecuta código y ningún test instanciaba la
   escena (necesita WebGL). La comprobación estática sí lo ve.

2. **Montaje y datos** (`ssr-check.jsx`). Renderiza los componentes con
   `react-dom/server` y valida que los formatos no produzcan `NaN`, que los
   colores sean hex válidos, que ningún planeta tenga su radio por encima de la
   mitad de su órbita, y que la corona del Sol no invada la órbita de Mercurio.

Lo que sigue **sin** cubrir: nada ejecuta `_buildSystem()`, así que un fallo en
la construcción de la escena 3D solo se ve abriendo el navegador. El import
incorrecto se detecta, un error de lógica dentro del bucle no.

### `npm run validate`

Comprueba el solver de Kepler con 15 grupos de pruebas: residuo de la ecuación
de Kepler, ortonormalidad de la rotación, extremos orbitales contra
q = a(1−e) y Q = a(1+e), periodos contra la tercera ley, la longitud del Sol
geocéntrica en J2000, los perihelios y afelios reales de la Tierra, e
inclinaciones orbitales.

**Aviso sobre las referencias.** La primera versión de este fichero comparaba
las posiciones contra una tabla de efemérides que había escrito de memoria, y la
tabla era falsa: señalaba un fallo que no existía en el código. El fichero ya
no usa ninguna referencia inventada, solo invariantes que se pueden derivar aquí
mismo o relaciones astronómicas verificables entre cuerpos. Si añades
referencias externas, comprueba que son correctas antes de confiar en ellas.

### Lo verificado en fase 2

- `npm run test` pasa: imports, 22 comprobaciones de datos, 15 grupos del solver
  y build limpio.
- Órbitas elípticas reales: Mercurio va de 0.3075 a 0.4667 UA, la Tierra de
  0.9833 a 1.0167 UA.
- El Sol en J2000 cae en 280.38° contra 280.46° tabulado.
- La Tierra está en perihelio el 3 de enero de 2024 y en afelio el 4 de julio.

Lo que **no** está verificado: el render visual en pantalla. Conviene abrirlo y
comprobar que las elipses se ven inclinadas y que los planetas no se salen de
su órbita.