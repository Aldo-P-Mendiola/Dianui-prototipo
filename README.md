# DIANUI 911 — Prototipo web

Programa digital de orientación y educación nutricional de la Fundación DIANUI A.C.,
dirigido a mamás que buscan información nutricional gratuita, segura y confiable para
sus familias, pensado para usarse fácilmente desde el celular.

> "Nutrición confiable + acompañamiento digital + acceso fácil desde el celular".

## Estructura del proyecto

Sitio estático, sin dependencias externas ni build step:

- `index.html` — estructura y contenido de todas las secciones.
- `app.js` — lógica de la app: tema, flujo rápido, módulo de contenido guiado,
  directorio de nutriólogos y FAQ.
- `styles.css` — estilos (tema claro/oscuro, componentes, responsive).

Para verlo localmente, solo abre `index.html` en el navegador (no requiere servidor).

## Qué hace hoy

- **Navegación por pantallas** (`showScreen` en `app.js`): la app funciona como un
  home con un menú de tarjetas grandes; solo una sección está visible a la vez
  (divulgación progresiva) y cada sección tiene un botón para volver al menú.
  Soporta enlaces directos por URL (`#recetario`, `#lactancia`, etc.).
- **Módulo de contenido guiado**: convierte recetas y listas de tips en tarjetas de
  pasos que el usuario va marcando como "listo". El progreso se guarda en el
  navegador (`localStorage`), así que si cierra la pestaña y regresa, sigue donde
  se quedó. El mismo componente (`buildGuidedCard` en `app.js`) sirve para recetas,
  hábitos, descanso, actividad física y lactancia — y está listo para reutilizarse
  en salud emocional cuando llegue el contenido. Las recetas se muestran en modo
  "carrusel" (un paso a la vez, con flechas y swipe); el resto se muestra como
  checklist.
- **Recetario guiado** (`#recetario`): 20 recetas reales. 8 vienen del *Manual de
  Recetas Nutritivas con Ingredientes de Huerto* (material de apoyo de la
  Fundación DIANUI A.C.). Las otras 12 se agregaron a partir de las fichas de
  receta reales de la comunidad de Dianui (`4.0 Red Aliados/Nuevo contenido`,
  varias de la nutrióloga Ximena Hernández y de @valeriaalanisv), cada una con
  su foto recortada de la ficha original (`assets/recetas/`). Cada receta se
  abre en un popup/modal que primero muestra los ingredientes que se
  necesitan (con un tip general de dónde conseguirlos más frescos y
  baratos) y, al presionar "Comenzar receta", pasa al carrusel de pasos.
- **Hábitos, descanso y actividad física**: tips reales basados en las *Guías
  Alimentarias saludables y sostenibles para la población mexicana 2025*
  (SSA, INSP, UNICEF), Recomendaciones 6, 7, 9 y 10.
- **Lactancia materna** (`#lactancia`): 6 lecciones cortas con información real
  sobre lactancia materna exclusiva (qué es, composición de la leche, técnica y
  agarre, alimentación de la mamá, beneficios, y cuándo consultar a un
  profesional), presentadas como una ruta de lecciones estilo Duolingo/Sololearn
  (`renderLactanciaPath` en `app.js`): cada tema es un nodo circular que cambia
  de color según el avance guardado (sin empezar / en progreso / completo), con
  una barra de progreso general arriba. Cada lección se muestra en formato de
  slides (un paso a la vez, igual que las recetas), así la lección se va
  completando conforme avanzas. Contenido generado únicamente a partir
  de dos documentos proporcionados en `4.0 Red Aliados/Nuevo contenido`:
  *"Lactancia materna exclusiva"* (Fundación DIANUI A.C.) y *"Recomendaciones
  sobre lactancia materna"* del Comité de Lactancia Materna de la Asociación
  Española de Pediatría (2012). No se agregó ningún dato que no viniera de esos
  documentos.
- **Directorio de nutriólogos** (`#nutriologos`): componente flexible, listo para
  mostrar uno o varios nutriólogos con su contacto en cuanto la Fundación DIANUI
  A.C. los proporcione. Mientras tanto, muestra un mensaje honesto de "muy
  pronto".
- **Flujo rápido** (`#como-funciona`): el selector original del prototipo, ahora
  conectado al contenido real y al módulo guiado.
- **FAQ real** con 13 preguntas y respuestas verificadas.

## Cómo agregar contenido nuevo

Todo el contenido vive en el objeto `CONTENT` dentro de `app.js`:

```js
const CONTENT = {
  recetas: [ ... ],
  habitos: [ ... ],
  descanso: [ ... ],
  actividad: [ ... ],
  saludEmocional: [], // vacío a propósito: se llena cuando llegue material real
};
```

Cada elemento tiene esta forma:

```js
{
  id: "identificador-unico",
  titulo: "Título visible",
  resumen: "Texto corto opcional",
  pasos: ["Paso 1", "Paso 2", "..."],
  extra: "HTML opcional (por ejemplo, porciones sugeridas)",
  fuente: "De dónde salió esta información",
}
```

Para activar **salud emocional** en el menú: llenar `CONTENT.saludEmocional`, agregar
una entrada a `ROUTES` en `app.js` (copiando el patrón de `descanso`/`actividad`), y
agregar la opción correspondiente en el `<select id="goalSelect">` de `index.html`.

## Cómo agregar nutriólogos reales

Editar el arreglo `NUTRIOLOGOS` en `app.js`:

```js
const NUTRIOLOGOS = [
  { nombre: "Dra. Ejemplo Pérez", especialidad: "Nutrición infantil", contacto: "https://wa.me/52..." },
];
```

Funciona igual con un solo nutriólogo o con varios; no requiere cambios de diseño.

### Qué necesita proporcionar la Fundación DIANUI A.C. para activar esta sección

Nota dirigida a la organización, no solo al equipo técnico: para pasar de "Muy pronto" a
un directorio activo, se necesita que Dianui confirme:

1. **Quiénes** van a aparecer (nombre y, si aplica, cédula o especialidad).
2. **Cómo quieren que las mamás los contacten** (WhatsApp directo, formulario, correo,
   u otro medio) — el componente ya está preparado para cualquiera de esas opciones.
3. **Si será uno o varios nutriólogos/pasantes**, para decidir si se muestra como un
   solo botón de contacto o como un directorio con varias tarjetas.
4. **Autorización de que el contenido y el contacto ya fueron revisados** por alguien
   con criterio profesional de la fundación, antes de publicarlo.

En cuanto se tenga esa información, activar la sección es solo cuestión de llenar el
arreglo `NUTRIOLOGOS` — no requiere rediseñar nada.

## Pendiente (no incluido en esta entrega)

- **Publicación en línea (GitHub Pages u otro hosting)**: pendiente de conectar
  este repositorio a la cuenta de GitHub del alumno y configurar el despliegue.
- **Validación de contenido de salud** por parte de un nutriólogo de la Fundación
  DIANUI A.C. antes de considerar el contenido como definitivo.

> Nota: se decidió no construir un chatbot con IA. La app se enfoca por completo
> en el contenido guiado real y en el futuro directorio de nutriólogos.

## Aviso

Este contenido es educativo e informativo y no sustituye la atención de un
profesional de la salud.
