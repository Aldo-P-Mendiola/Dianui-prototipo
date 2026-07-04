# Checklist de pruebas y reporte de compatibilidad — DIANUI 911

Este documento cubre la Fase 7 del plan de trabajo validado: pruebas funcionales,
revisión de contenido y compatibilidad en dispositivos/navegadores reales.

## 1. Pruebas funcionales automatizadas

Se ejecutaron pruebas automatizadas (Node.js + jsdom) sobre `index.html` y `app.js`
tal como quedaron en la última versión. Resultado:

| Prueba | Resultado |
|---|---|
| La app carga sin errores de JavaScript | OK |
| El recetario muestra las 8 recetas reales | OK |
| Una receta se expande y muestra sus pasos con checklist | OK |
| El FAQ muestra las 12 preguntas reales | OK |
| El buscador de FAQ tiene nombre accesible (`aria-label`) | OK |
| El directorio de nutriólogos muestra el mensaje "muy pronto" cuando está vacío | OK |
| El flujo rápido responde correctamente a las 5 opciones (contacto, recetas, descanso, actividad, hábitos) | OK |

Adicionalmente, en una prueba anterior de esta misma fase se verificó, dentro de una
misma sesión de navegador simulada, que el progreso de una receta (pasos marcados
como "listo") se guarda en `localStorage` y se mantiene después de recargar la vista.

## 2. Revisión final de contenido

Se revisó todo el texto visible en `index.html` y `app.js`:

- Sin errores ortográficos encontrados.
- Se corrigieron comillas rectas (`"..."`) por comillas tipográficas (`“...”`) en
  3 lugares, para que coincidan con el estilo del prototipo original.
- Las fuentes de cada bloque de contenido (recetario, hábitos/descanso/actividad)
  están citadas explícitamente en la interfaz y en el código.

## 3. Auditoría de accesibilidad y contraste

Se calculó el contraste (fórmula de luminancia relativa WCAG) de todas las
combinaciones de texto/fondo usadas en `styles.css`, en tema oscuro y tema claro.

- Resultado: todas las combinaciones pasan WCAG AA para texto normal (mínimo
  4.5:1). El rango obtenido fue de 6.15:1 a 18.72:1.
- Se añadió `aria-label` al buscador de preguntas frecuentes.
- Botones y campos cumplen un alto mínimo de 44px para uso táctil.
- Existen estilos de `focus-visible` para navegación por teclado.

## 4. Reporte de compatibilidad (pendiente de verificación manual)

Las pruebas anteriores se hicieron con un navegador simulado (no un navegador ni
celular real), porque el entorno donde se ejecuta este asistente no tiene acceso a
dispositivos físicos. Falta que el alumno confirme visualmente lo siguiente una vez
que el sitio esté publicado:

- [ ] Abrir el sitio en un celular Android (Chrome).
- [ ] Abrir el sitio en un iPhone (Safari).
- [ ] Abrir el sitio en una computadora (Chrome, Firefox o Edge).
- [ ] Verificar que el menú, el recetario y el FAQ se vean bien en pantallas
      pequeñas (sin textos cortados ni botones encimados).
- [ ] Marcar pasos de una receta como "listo", cerrar el navegador y volver a
      abrir el sitio para confirmar que el progreso se mantiene.
- [ ] Cambiar entre tema claro y oscuro y verificar que el texto se siga leyendo
      bien en ambos.
- [ ] Probar el buscador de preguntas frecuentes escribiendo una palabra (por
      ejemplo "receta" o "nutriólogo").

## Conclusión

El contenido y la lógica de la app fueron verificados de forma automatizada y no
presentan errores. La verificación en dispositivos físicos queda como checklist
manual para completar una vez publicado el sitio, ya que requiere acceso directo a
los dispositivos.
