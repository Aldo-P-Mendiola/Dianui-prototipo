/* =========================================================
   DIANUI 911 — app.js
   Programa digital de orientación nutricional.
   El chatbot (si se agrega) es un apoyo secundario: el
   corazón de esta app es el contenido guiado y el futuro
   contacto con nutriólogos reales.
   ========================================================= */

/* =========================
   Config rápida (edítame)
   ========================= */

const CONFIG = {
  // Mensaje de bienvenida al abrir el chat de apoyo (si se activa más adelante).
  appName: "DIANUI 911",
};

/* =========================
   Helpers generales
   ========================= */

function $(sel, scope) {
  return (scope || document).querySelector(sel);
}
function $all(sel, scope) {
  return Array.from((scope || document).querySelectorAll(sel));
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}
function el(tag, attrs, html) {
  const node = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach((k) => node.setAttribute(k, attrs[k]));
  }
  if (html !== undefined) node.innerHTML = html;
  return node;
}

/* =========================
   Progreso guardado (localStorage)
   Se usa tanto para recetas como para los tips de
   hábitos / descanso / actividad física: el mismo
   mecanismo sirve para cualquier tipo de contenido
   guiado, para no rehacerlo cuando llegue contenido nuevo.
   ========================= */

const PROGRESS_PREFIX = "dianui:progreso:";

function getProgress(key, totalSteps) {
  try {
    const raw = localStorage.getItem(PROGRESS_PREFIX + key);
    if (!raw) return new Array(totalSteps).fill(false);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === totalSteps) return parsed;
    // Si cambió el número de pasos, reiniciamos sin tronar la app.
    return new Array(totalSteps).fill(false);
  } catch (e) {
    return new Array(totalSteps).fill(false);
  }
}
function saveProgress(key, stepsDone) {
  try {
    localStorage.setItem(PROGRESS_PREFIX + key, JSON.stringify(stepsDone));
  } catch (e) {
    /* si localStorage no está disponible, la app sigue funcionando,
       solo no recuerda el progreso entre visitas */
  }
}
function resetProgress(key, totalSteps) {
  saveProgress(key, new Array(totalSteps).fill(false));
}

/* =========================
   Módulo de contenido guiado
   (paso a paso, con checklist y progreso guardado)

   Sirve para: recetas (ingredientes + preparación) y para
   listas de tips de hábitos / descanso / actividad física.
   Es el mismo componente para todo: solo cambian los datos.
   ========================= */

/**
 * Crea la tarjeta guiada de un elemento de contenido.
 * @param {Object} item - { id, categoria, titulo, resumen, pasos: [texto,...], extra: html opcional, fuente, icono }
 * @param {Object} [opts] - { modo: "lista" (por defecto) | "carrusel" }
 *   "carrusel": muestra los pasos de uno en uno, como slides, con flechas,
 *   puntos y swipe. Se usa para las recetas, donde ver todo el texto junto
 *   se siente pesado en un celular. "lista": muestra todos los pasos como
 *   checklist (se sigue usando para hábitos, descanso y actividad, que son
 *   tips cortos, no una secuencia de cocina).
 */
function buildGuidedCard(item, opts) {
  opts = opts || {};
  const modo = opts.modo === "carrusel" ? "carrusel" : "lista";
  // Cuando la tarjeta se muestra dentro de un popup que ya trae su propio
  // título e ícono (como el modal de recetas), no repetimos el encabezado aquí.
  const mostrarHeader = opts.mostrarHeader !== false;
  const key = `${item.categoria}:${item.id}`;
  const total = item.pasos.length;
  let done = getProgress(key, total);

  const card = el("article", { class: `guiado__card guiado__card--${modo}`, "data-key": key });

  if (mostrarHeader) {
    const header = el("div", { class: "guiado__header" });
    if (item.icono) {
      header.appendChild(el("div", { class: "guiado__icon", "aria-hidden": "true" }, item.icono));
    }
    const headerText = el("div", { class: "guiado__headerText" });
    headerText.appendChild(el("h4", { class: "h5" }, escapeHtml(item.titulo)));
    if (item.resumen) {
      headerText.appendChild(el("p", { class: "muted tiny" }, escapeHtml(item.resumen)));
    }
    header.appendChild(headerText);
    card.appendChild(header);
  }

  if (item.extra) {
    const extraBox = el("div", { class: "guiado__extra tiny muted" }, item.extra);
    card.appendChild(extraBox);
  }

  const progressWrap = el("div", { class: "progressBar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(total) });
  const progressFill = el("div", { class: "progressBar__fill" });
  progressWrap.appendChild(progressFill);
  const progressLabel = el("p", { class: "tiny muted progressBar__label" });
  card.appendChild(progressWrap);
  card.appendChild(progressLabel);

  function refreshProgressUI() {
    const n = done.filter(Boolean).length;
    const pct = total ? Math.round((n / total) * 100) : 0;
    progressFill.style.width = pct + "%";
    progressWrap.setAttribute("aria-valuenow", String(n));
    progressLabel.textContent =
      n === 0 ? `0 de ${total} pasos listos` :
      n === total ? `¡Listo! Completaste los ${total} pasos.` :
      `${n} de ${total} pasos listos`;
  }

  // Se define según el modo (lista o carrusel); la usa el botón "Reiniciar".
  let syncStepsView = () => {};

  if (modo === "carrusel") {
    const carrusel = el("div", { class: "carrusel" });

    if (item.foto && !opts.ocultarFoto) {
      const photoWrap = el("div", { class: "carrusel__photoWrap" });
      photoWrap.appendChild(el("img", {
        src: `assets/recetas/${item.foto}`,
        alt: `Foto de ${item.titulo}`,
        class: "carrusel__photo",
        loading: "lazy",
      }));
      carrusel.appendChild(photoWrap);
    }

    carrusel.appendChild(el("p", { class: "tiny muted carrusel__hint" }, "Desliza hacia los lados o usa las flechas para avanzar."));

    const navRow = el("div", { class: "carrusel__nav" });
    const prevBtn = el("button", { type: "button", class: "btn btn--ghost carrusel__arrow", "aria-label": "Paso anterior" }, "‹");
    const counter = el("p", { class: "tiny muted carrusel__counter" });
    const nextBtn = el("button", { type: "button", class: "btn btn--primary carrusel__arrow", "aria-label": "Paso siguiente" }, "›");
    navRow.appendChild(prevBtn);
    navRow.appendChild(counter);
    navRow.appendChild(nextBtn);
    carrusel.appendChild(navRow);

    const slide = el("div", { class: "carrusel__slide" });
    const stepText = el("p", { class: "carrusel__stepText" });
    const doneLabel = el("label", { class: "carrusel__doneLabel" });
    const doneCheckbox = el("input", { type: "checkbox", class: "carrusel__checkbox" });
    doneLabel.appendChild(doneCheckbox);
    doneLabel.appendChild(el("span", {}, "Marcar este paso como listo"));
    slide.appendChild(stepText);
    slide.appendChild(doneLabel);
    carrusel.appendChild(slide);

    const dotsRow = el("div", { class: "carrusel__dots", role: "tablist", "aria-label": "Ir a un paso de la receta" });
    const dots = item.pasos.map((_, idx) => {
      const dot = el("button", { type: "button", class: "carrusel__dot", "aria-label": `Ir al paso ${idx + 1}` });
      dot.addEventListener("click", () => goTo(idx));
      dotsRow.appendChild(dot);
      return dot;
    });
    carrusel.appendChild(dotsRow);

    card.appendChild(carrusel);

    let current = done.findIndex((d) => !d);
    if (current === -1) current = 0;

    function render() {
      stepText.innerHTML = `<span class="kbd">${current + 1}</span> ${escapeHtml(item.pasos[current])}`;
      counter.textContent = `Paso ${current + 1} de ${total}`;
      doneCheckbox.checked = !!done[current];
      prevBtn.disabled = current === 0;
      nextBtn.disabled = current === total - 1;
      dots.forEach((dot, idx) => {
        dot.classList.toggle("carrusel__dot--active", idx === current);
        dot.classList.toggle("carrusel__dot--done", !!done[idx]);
      });
    }

    function goTo(idx) {
      current = Math.max(0, Math.min(total - 1, idx));
      render();
    }

    prevBtn.addEventListener("click", () => goTo(current - 1));
    nextBtn.addEventListener("click", () => goTo(current + 1));

    doneCheckbox.addEventListener("change", () => {
      done[current] = doneCheckbox.checked;
      saveProgress(key, done);
      refreshProgressUI();
      render();
      if (doneCheckbox.checked && current < total - 1) {
        setTimeout(() => goTo(current + 1), 300);
      }
    });

    let touchStartX = null;
    slide.addEventListener("touchstart", (e) => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    slide.addEventListener("touchend", (e) => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) {
        goTo(dx < 0 ? current + 1 : current - 1);
      }
      touchStartX = null;
    });

    syncStepsView = () => {
      current = 0;
      render();
    };

    render();
  } else {
    const list = el("ul", { class: "guiado__steps" });

    item.pasos.forEach((pasoTexto, idx) => {
      const li = el("li", { class: "guiado__step" });
      const checkboxId = `chk-${key.replace(/[^a-z0-9]/gi, "-")}-${idx}`;
      const label = el("label", { class: "guiado__stepLabel", for: checkboxId });

      const input = el("input", {
        type: "checkbox",
        id: checkboxId,
        class: "guiado__checkbox",
      });
      input.checked = !!done[idx];

      const span = el("span", { class: "guiado__stepText" }, `<span class="kbd">${idx + 1}</span> ${escapeHtml(pasoTexto)}`);

      label.appendChild(input);
      label.appendChild(span);
      li.appendChild(label);
      list.appendChild(li);

      input.addEventListener("change", () => {
        done[idx] = input.checked;
        saveProgress(key, done);
        li.classList.toggle("guiado__step--done", input.checked);
        refreshProgressUI();
      });

      if (done[idx]) li.classList.add("guiado__step--done");
    });

    card.appendChild(list);

    syncStepsView = () => {
      $all(".guiado__checkbox", list).forEach((cb) => (cb.checked = false));
      $all(".guiado__step", list).forEach((li) => li.classList.remove("guiado__step--done"));
    };
  }

  refreshProgressUI();

  const actions = el("div", { class: "guiado__actions" });
  const resetBtn = el("button", { type: "button", class: "btn btn--ghost btn--sm" }, "Reiniciar");
  resetBtn.addEventListener("click", () => {
    done = new Array(total).fill(false);
    resetProgress(key, total);
    refreshProgressUI();
    syncStepsView();
  });
  actions.appendChild(resetBtn);
  card.appendChild(actions);

  if (item.fuente) {
    card.appendChild(el("p", { class: "tiny muted" }, `Fuente: ${escapeHtml(item.fuente)}`));
  }

  return card;
}

/* =========================
   Contenido real (Fase 3)
   Fuente citada en cada elemento. Estructura pensada
   para poder agregar más categorías (como salud emocional)
   sin rediseñar nada, solo agregando datos aquí.
   ========================= */

const FUENTE_GUIA = "Guías Alimentarias saludables y sostenibles para la población mexicana 2025 (SSA, INSP, UNICEF)";
const FUENTE_RECETAS = "Manual de Recetas Nutritivas con Ingredientes de Huerto — Tecnológico de Monterrey, material de apoyo de Fundación DIANUI A.C.";
const FUENTE_LACTANCIA = "\"Lactancia materna exclusiva\" (Fundación DIANUI A.C., con base en la NOM-007-SSA2-2016) y \"Recomendaciones sobre lactancia materna\", Comité de Lactancia Materna de la Asociación Española de Pediatría (Martín Morales, 2012).";
const FUENTE_COMUNIDAD = "Contenido compartido en la comunidad de Dianui (Red Aliados).";
const FUENTE_XIMENA = "Nutrióloga Ximena Hernández, contenido de la comunidad de Dianui (Red Aliados).";
const FUENTE_VALERIA = "Receta compartida por @valeriaalanisv en la comunidad de Dianui (Red Aliados).";

const CONTENT = {
  recetas: [
    {
      id: "crema-zanahoria-calabaza",
      icono: "🥕",
      titulo: "Crema de zanahoria y calabaza",
      resumen: "120 kcal por porción · 2 g de proteína",
      ingredientes: [
        "2 zanahorias medianas",
        "1 taza de calabaza",
        "1 papa pequeña",
        "2 tazas de agua o caldo",
        "1 cucharadita de aceite de oliva",
      ],
      pasos: [
        "Lava y corta 2 zanahorias medianas, 1 taza de calabaza y 1 papa pequeña.",
        "Cuece las verduras en 2 tazas de agua o caldo con 1 cucharadita de aceite de oliva hasta que estén suaves.",
        "Licúa todo y sirve tibio.",
      ],
      extra: "Porción sugerida: 1/2 taza (0-2 años), 3/4 taza (3-5 años), 1 taza (6-12 años).",
      fuente: FUENTE_RECETAS,
    },
    {
      id: "ensalada-pepino-tomate",
      icono: "🥗",
      titulo: "Ensalada de pepino y tomate",
      resumen: "80 kcal por porción · 2 g de proteína",
      ingredientes: [
        "1 pepino",
        "2 tomates",
        "Jugo de limón",
        "1 cucharadita de aceite de oliva",
        "Orégano al gusto",
      ],
      pasos: [
        "Corta 1 pepino y 2 tomates en cubos.",
        "Mezcla con jugo de limón, 1 cucharadita de aceite de oliva y orégano al gusto.",
        "Sirve fresca.",
      ],
      extra: "Porción sugerida: 1/4 taza (0-2 años), 1/2 taza (3-5 años), 3/4 taza (6-12 años).",
      fuente: FUENTE_RECETAS,
    },
    {
      id: "tortitas-espinaca",
      icono: "🥬",
      titulo: "Tortitas de espinaca",
      resumen: "150 kcal por porción · 8 g de proteína",
      ingredientes: [
        "1 taza de espinaca picada",
        "1 huevo",
        "2 cucharadas de avena",
        "30 g de queso fresco",
      ],
      pasos: [
        "Mezcla 1 taza de espinaca picada, 1 huevo, 2 cucharadas de avena y 30 g de queso fresco.",
        "Forma pequeñas tortitas con la mezcla.",
        "Cocina en un sartén antiadherente hasta que doren por ambos lados.",
      ],
      extra: "Porción sugerida: 1 tortita (0-2 años), 2 tortitas (3-5 años), 3 tortitas (6-12 años).",
      fuente: FUENTE_RECETAS,
    },
    {
      id: "arroz-con-verduras",
      icono: "🍚",
      titulo: "Arroz con verduras",
      resumen: "190 kcal por porción · 5 g de proteína",
      ingredientes: [
        "1/2 taza de zanahoria",
        "1/2 taza de chícharos",
        "1/2 taza de elote",
        "1 taza de arroz ya cocido",
        "1 cucharadita de aceite",
      ],
      pasos: [
        "Cocina 1/2 taza de zanahoria, 1/2 taza de chícharos y 1/2 taza de elote.",
        "Mezcla las verduras con 1 taza de arroz ya cocido.",
        "Saltea todo junto con 1 cucharadita de aceite por un par de minutos.",
      ],
      extra: "Porción sugerida: 1/3 taza (0-2 años), 1/2 taza (3-5 años), 1 taza (6-12 años).",
      fuente: FUENTE_RECETAS,
    },
    {
      id: "omelette-espinaca-tomate",
      icono: "🍳",
      titulo: "Omelette de espinaca y tomate",
      resumen: "170 kcal por porción · 11 g de proteína",
      ingredientes: [
        "2 huevos",
        "1/2 taza de espinaca",
        "1 tomate pequeño",
        "1 cucharadita de aceite",
      ],
      pasos: [
        "Bate 2 huevos.",
        "Agrega 1/2 taza de espinaca y 1 tomate pequeño picado.",
        "Cocina todo en un sartén con 1 cucharadita de aceite.",
      ],
      extra: "Porción sugerida: 1/2 omelette (0-2 años), 3/4 (3-5 años), 1 completo (6-12 años).",
      fuente: FUENTE_RECETAS,
    },
    {
      id: "sopa-de-verduras",
      icono: "🍲",
      titulo: "Sopa de verduras",
      resumen: "100 kcal por porción · 3 g de proteína",
      ingredientes: [
        "1 zanahoria",
        "1 calabacita",
        "1 papa pequeña",
        "1 tomate",
        "3 tazas de agua",
      ],
      pasos: [
        "Corta 1 zanahoria, 1 calabacita, 1 papa pequeña y 1 tomate.",
        "Hierve todo en 3 tazas de agua hasta que las verduras estén suaves.",
        "Sirve caliente.",
      ],
      extra: "Porción sugerida: 1/2 taza (0-2 años), 3/4 taza (3-5 años), 1 taza (6-12 años).",
      fuente: FUENTE_RECETAS,
    },
    {
      id: "tacos-lechuga-pollo",
      icono: "🌮",
      titulo: "Tacos de lechuga con pollo",
      resumen: "200 kcal por porción · 15 g de proteína",
      ingredientes: [
        "Hojas de lechuga",
        "100 g de pollo deshebrado",
        "Tomate picado",
        "Aguacate al gusto",
      ],
      pasos: [
        "Lava bien las hojas de lechuga que usarás como base del taco.",
        "Rellena con 100 g de pollo deshebrado, tomate picado y aguacate al gusto.",
        "Sirve fresco, sin necesidad de tortilla.",
      ],
      extra: "Porción sugerida: 1 taco pequeño (0-2 años), 2 (3-5 años), 3 (6-12 años).",
      fuente: FUENTE_RECETAS,
    },
    {
      id: "smoothie-fresa-espinaca",
      icono: "🥤",
      titulo: "Smoothie de fresa y espinaca",
      resumen: "140 kcal por porción · 6 g de proteína",
      ingredientes: [
        "1 taza de fresas",
        "1/2 taza de espinaca",
        "1 taza de leche",
        "1 cucharadita de miel",
      ],
      pasos: [
        "Lava 1 taza de fresas y 1/2 taza de espinaca.",
        "Licúa con 1 taza de leche y 1 cucharadita de miel hasta integrar bien.",
        "Sirve frío.",
      ],
      extra: "Porción sugerida: 1/2 vaso (0-2 años), 3/4 vaso (3-5 años), 1 vaso (6-12 años).",
      fuente: FUENTE_RECETAS,
    },

    // Recetas agregadas a partir de las fichas reales compartidas en la
    // comunidad de Dianui (carpeta "4.0 Red Aliados/Nuevo contenido").
    // Cada una conserva ingredientes e instrucciones tal como aparecen
    // en el material original, con foto real recortada de la ficha.
    {
      id: "nidos-huevo-calabacita",
      icono: "🥚",
      foto: "nidos-huevo-calabacita.jpg",
      titulo: "Nidos de huevo con calabacita y queso",
      resumen: "Desayuno ligero con calabacita, huevo y queso.",
      ingredientes: [
        "1 calabacita grande",
        "3 huevos",
        "1/2 taza de queso mozzarella",
        "Sal y pimienta al gusto",
      ],
      pasos: [
        "Corta 1 calabacita grande con un cortador de espiral (o rállala en tiras delgadas).",
        "Agrega 1/2 taza de queso mozzarella (o el de tu preferencia), sal y pimienta al gusto.",
        "Mezcla muy bien y en un sartén forma unos \"nidos\" con la calabacita.",
        "En medio de cada nido agrega 1 huevo.",
        "Agrega pimienta y cocina unos minutos, tapado, hasta que el huevo cuaje a tu gusto.",
      ],
      fuente: FUENTE_COMUNIDAD,
    },
    {
      id: "carlota-fresas-crema",
      icono: "🍓",
      foto: "carlota-fresas-crema.jpg",
      titulo: "Carlota estilo fresas con crema",
      resumen: "Postre fresco por capas, sin azúcar añadida.",
      ingredientes: [
        "Yogurt griego sin azúcar",
        "Vainilla",
        "Endulzante al gusto",
        "Galletas María",
        "1 taza de fresas",
      ],
      pasos: [
        "Mezcla yogurt griego sin azúcar con vainilla y el endulzante de tu elección hasta lograr una mezcla homogénea.",
        "En un vaso o bowl, pon una capa de galletas María.",
        "Agrega una capa de la mezcla de yogurt y una capa de fresas (1 taza) picadas.",
        "Repite las capas necesarias hasta llenar el vaso.",
        "Encima pon más yogurt griego y galletas María troceadas; mete al refrigerador por unas horas y disfruta.",
      ],
      fuente: FUENTE_COMUNIDAD,
    },
    {
      id: "pollo-estilo-chino",
      icono: "🥡",
      foto: "pollo-estilo-chino.jpg",
      titulo: "Pollo estilo chino",
      resumen: "Salteado de pollo y verdura estilo asiático.",
      ingredientes: [
        "700 g de pechuga de pollo",
        "2 cdas de aceite de ajonjolí u oliva",
        "4 zanahorias",
        "1 chayote o 1 calabaza",
        "1/2 brócoli",
        "3/4 taza de salsa de soya",
        "1/4 taza de miel de abeja o agave",
        "1/2 cdita de maicena",
        "Cebolla y ajo al gusto",
      ],
      pasos: [
        "En un sartén a fuego medio agrega aceite de ajonjolí u oliva, cebolla en cuadros medianos y ajo finamente picado.",
        "Cocina unos minutos y agrega 700 g de pechuga de pollo cortada en cubos medianos.",
        "Añade 4 zanahorias y 1 chayote (o calabaza) ya cortados.",
        "Agrega 3/4 taza de salsa de soya, 1/4 taza de miel de abeja (o agave) y 1/2 cdita de maicena diluida en 1/3 taza de agua; mezcla, tapa y cocina unos 4 minutos.",
        "Por último agrega 1/2 brócoli, tapa de nuevo y cocina hasta que la verdura quede a tu gusto.",
      ],
      fuente: FUENTE_COMUNIDAD,
    },
    {
      id: "avocado-toast",
      icono: "🥑",
      foto: "avocado-toast.jpg",
      titulo: "Avocado toast",
      resumen: "Para 4 personas. Receta compartida por @valeriaalanisv.",
      ingredientes: [
        "2 rebanadas de pan integral",
        "2 huevos",
        "1 cdita de aceite de oliva",
        "1/2 aguacate",
        "Jitomate cherry",
        "Sazonador de tu preferencia",
      ],
      pasos: [
        "Tuesta 2 rebanadas de pan integral a tu gusto (o déjalo blandito).",
        "Cocina 2 huevos a tu gusto: estrellado o duro.",
        "Unta 1/2 aguacate en los panes ya tostados.",
        "Agrega el huevo encima del pan con aguacate; sazona con sal y pimienta al gusto.",
        "Al final agrega jitomate cherry cortado a la mitad y 1 cdita de aceite de oliva.",
      ],
      fuente: FUENTE_VALERIA,
    },
    {
      id: "tacos-pollo-guisado",
      icono: "🌯",
      foto: "tacos-pollo-guisado.jpg",
      titulo: "Tarde de tacos de pollo guisado",
      resumen: "Por la nutrióloga Ximena Hernández.",
      ingredientes: [
        "Media pechuga de pollo",
        "2 tomates rojos",
        "Media cebolla",
        "7 ramas de cilantro",
        "Sal al gusto",
        "Tortillas de maíz",
      ],
      pasos: [
        "En un sartén, sazona media cebolla picada, dos tomates rojos picados y siete ramas de cilantro picado.",
        "Cuando esté sazonado, agrega media pechuga de pollo y mezcla bien hasta obtener el guisado.",
        "Sobre tortilla de maíz, coloca el pollo guisado y enróllalos.",
        "Llévalos a la freidora de aire hasta que estén crujientes.",
        "Prepara tu salsa favorita para acompañar, con queso y crema baja en grasa al gusto.",
      ],
      fuente: FUENTE_XIMENA,
    },
    {
      id: "galletas-arroz-aguacate",
      icono: "🍘",
      foto: "galletas-arroz-aguacate.jpg",
      titulo: "Galletas de arroz y quinoa con aguacate y queso panela",
      resumen: "Snack rápido y crujiente.",
      ingredientes: [
        "1 paquete de galletas de arroz infladas",
        "Queso panela (30 g por galleta)",
        "Aguacate",
        "Jitomate cherry al gusto",
      ],
      pasos: [
        "En cada galleta de arroz inflado unta aguacate.",
        "Agrega 30 g de queso panela por galleta.",
        "Agrega jitomate cherry al gusto.",
      ],
      fuente: FUENTE_COMUNIDAD,
    },
    {
      id: "smoothie-frutos-rojos-comunidad",
      icono: "🍓",
      foto: "smoothie-frutos-rojos.jpg",
      titulo: "Smoothie de frutos rojos",
      resumen: "Opción de desayuno rico y rápido. Receta de @valeriaalanisv.",
      ingredientes: [
        "Fresas o berries congeladas",
        "1 vaso de leche",
        "Proteína en polvo (opcional)",
        "Chía",
        "Yogurt griego",
        "Almendras o nueces (opcional)",
      ],
      pasos: [
        "En la licuadora mezcla berries o fresas, 1 vaso de leche y, si quieres, 1 scoop de proteína en polvo.",
        "Agrega chía para que la mezcla tome una consistencia tipo pudín.",
        "Sirve sobre yogurt griego y agrega la mezcla; de topping puedes usar almendras o nueces.",
      ],
      fuente: FUENTE_VALERIA,
    },
    {
      id: "paletas-clight",
      icono: "🧊",
      foto: "paletas-clight.jpg",
      titulo: "Paletas deliciosas",
      resumen: "Alternativa fría y sin azúcar añadida para los peques.",
      ingredientes: [
        "1 sobre de agua de sabor sin azúcar (del sabor que prefieras)",
        "Medio litro de agua",
      ],
      pasos: [
        "Diluye un sobre de agua de sabor sin azúcar (del sabor que prefieras) en medio litro de agua.",
        "Vierte en moldes para paleta.",
        "Congela hasta que cuajen; no necesitan endulzante extra.",
      ],
      fuente: FUENTE_COMUNIDAD,
    },
    {
      id: "bites-yogurt-frutos-rojos",
      icono: "🫐",
      foto: "bites-yogurt-frutos-rojos.jpg",
      titulo: "Bites de yogurt con frutos rojos",
      resumen: "Snack congelado para toda la semana. Receta de @valeriaalanisv.",
      ingredientes: [
        "Moras",
        "1 cucharada de chía",
        "Miel",
        "Yogurt griego",
      ],
      pasos: [
        "En un bowl aplasta moras junto con una cucharada de chía y miel, hasta lograr una mezcla tipo mermelada.",
        "Mete la mezcla al refrigerador durante unas 2 horas.",
        "Coloca yogurt griego en un bowl, toma la mezcla de frutos rojos ya fría y cúbrela con el yogurt.",
        "Mete al congelador unas 2 horas más y disfruta.",
      ],
      fuente: FUENTE_VALERIA,
    },
    {
      id: "tacos-atun",
      icono: "🐟",
      foto: "tacos-atun.jpg",
      titulo: "Tacos carnita de atún",
      resumen: "Cena ligera, alta en proteína, sin grasas trans. Nutrióloga Ximena Hernández.",
      ingredientes: [
        "1 cdita de ghee (mantequilla clarificada)",
        "1 sobre de atún bajo en sodio",
        "1 cdita de paprika",
        "2 tortillas de nopal",
        "Guacamole, limón, cilantro y cebolla al gusto",
      ],
      pasos: [
        "Calienta 1 cdita de ghee (mantequilla clarificada) y saltea 1 sobre de atún bajo en sodio con 1 cdita de paprika.",
        "Calienta 2 tortillas de nopal.",
        "Sirve el atún sobre las tortillas de nopal.",
        "Agrega guacamole, cilantro y cebolla al gusto, y unas gotas de limón.",
      ],
      extra: "Aporta unos 20 g de proteína por cada 2 tacos.",
      fuente: FUENTE_XIMENA,
    },
    {
      id: "pan-frances-frutos-rojos",
      icono: "🍞",
      foto: "pan-frances-frutos-rojos.jpg",
      titulo: "Pan francés con frutos rojos",
      resumen: "Desayuno dulce sin azúcar añadida. Nutrióloga Ximena Hernández.",
      ingredientes: [
        "2 rebanadas de pan",
        "1 huevo",
        "1 sobre de stevia",
        "1 pizca de canela molida",
        "Un chorrito de vainilla",
        "1 puño de frutos rojos",
        "2 cdas de queso cottage",
        "1 cda de miel de agave",
        "1 cda de almendras fileteadas",
      ],
      pasos: [
        "Mezcla 1 huevo, 1 sobre de stevia, 1 pizca de canela molida y un chorrito de vainilla; remoja ahí 2 rebanadas de pan.",
        "En un sartén, con media cucharadita de mantequilla, cocina el pan remojado.",
        "Desinfecta bien un puño de frutos rojos (mora azul, frambuesa, zarzamora y fresa) y combínalos.",
        "Sirve el pan ya cocido con los frutos rojos, 2 cdas de queso cottage, 1 cda de miel de agave y 1 cda de almendras fileteadas.",
        "Acompaña con té verde o jugo verde, el de tu preferencia.",
      ],
      fuente: FUENTE_XIMENA,
    },
    {
      id: "tacos-carne-saludables",
      icono: "🌮",
      foto: "tacos-carne-saludables.jpg",
      titulo: "Tacos de carne saludables",
      resumen: "Alimento completo: carbohidratos, proteínas y grasas. Nutrióloga Ximena Hernández.",
      ingredientes: [
        "225 g de carne molida magra",
        "3 tortillas de nopal",
        "65 g de jitomate",
        "40 g de cebolla",
        "20 g de cilantro",
        "1 pizca de sal",
        "Salsa roja, limón y guacamole al gusto",
      ],
      pasos: [
        "Cocina 225 g de carne molida magra con 65 g de jitomate, 40 g de cebolla y 20 g de cilantro picados, y 1 pizca de sal.",
        "Calienta 3 tortillas de nopal.",
        "Sirve la carne sobre las tortillas de nopal.",
        "Acompaña con salsa roja, limón y guacamole al gusto.",
      ],
      extra: "Aporta 494 kcal en total; la tortilla de nopal ayuda a reducir la glucosa en sangre.",
      fuente: FUENTE_XIMENA,
    },
  ],

  habitos: [
    {
      id: "habitos-semana",
      titulo: "Hábitos saludables de esta semana",
      resumen: "Marca los que ya lograste, poco a poco.",
      pasos: [
        "Revisa los sellos de advertencia en los empaques antes de comprar y elige los que tengan menos sellos.",
        "Prepara algo fresco y saludable con anticipación para no recurrir a ultraprocesados fuera de casa.",
        "Prioriza frutas y verduras frescas en el desayuno, la comida y la cena.",
        "Revisa tu alacena e identifica un alimento ultraprocesado que puedas cambiar por una opción fresca.",
        "Come en familia cuando se pueda, sin prisas y sin pantallas.",
        "Involucra a los niños en la preparación de la comida.",
        "Evita tirar comida: guarda las sobras para otra comida del día.",
      ],
      fuente: `${FUENTE_GUIA}, Recomendaciones 6 y 10`,
    },
  ],

  descanso: [
    {
      id: "descanso-semana",
      titulo: "Tips de descanso de esta semana",
      resumen: "Pequeños cambios que ayudan a dormir mejor.",
      pasos: [
        "Reduce el tiempo frente a pantallas (celular, tele) en la última hora antes de dormir.",
        "Muévete un poco durante el día: la actividad física ayuda a descansar mejor en la noche.",
        "Procura mantener un horario regular para acostarte y levantarte.",
      ],
      fuente: `${FUENTE_GUIA}, Recomendación 9 (relación entre actividad física, tiempo sedentario y sueño)`,
    },
  ],

  actividad: [
    {
      id: "actividad-semana",
      titulo: "Actividad física de esta semana",
      resumen: "Cada movimiento cuenta, no hace falta ir al gimnasio.",
      pasos: [
        "Usa las escaleras en lugar del elevador cuando puedas.",
        "Si vas en coche, estaciona un poco más lejos de la entrada para caminar más.",
        "Si usas transporte público, baja una parada antes y camina el resto.",
        "Busca acumular movimiento con toda la familia: caminar, bailar o jugar también cuenta.",
        "Niñas, niños y adolescentes: al menos 60 minutos de movimiento al día. Adultos: 150 minutos a la semana.",
      ],
      fuente: `${FUENTE_GUIA}, Recomendación 9`,
    },
  ],

  // Espacio reservado: todavía no se muestra en el menú porque no
  // hay material real que mostrar. En cuanto Dianui lo proporcione,
  // solo hay que llenar este arreglo y agregar una ruta/sección;
  // el módulo de contenido guiado ya sabe renderizar cualquier
  // categoría con este mismo formato de datos.
  saludEmocional: [],

  // Sección "Lactancia": contenido generado únicamente a partir de
  // los dos documentos reales proporcionados por Dianui/Red Aliados
  // ("Lactancia materna.pdf" y "Lactancia materna exclusiva DIANUI.pdf").
  // No se agregó ningún dato que no viniera de esos documentos.
  lactancia: [
    {
      id: "que-es-lactancia",
      icono: "🤱",
      titulo: "¿Qué es la lactancia materna exclusiva?",
      resumen: "La base: qué es y cuánto tiempo se recomienda.",
      pasos: [
        "Es alimentar al bebé únicamente con leche materna, sin darle ningún otro alimento ni bebida.",
        "Se recomienda de forma exclusiva durante los primeros 6 meses de vida del bebé.",
        "Después de los 6 meses inicia la alimentación complementaria, sin dejar la leche materna.",
        "Al cumplir 1 año, el bebé ya se va integrando poco a poco a la dieta familiar.",
        "Idealmente, la lactancia debe iniciar inmediatamente después del nacimiento del bebé.",
      ],
      fuente: FUENTE_LACTANCIA,
    },
    {
      id: "composicion-leche",
      icono: "🍼",
      titulo: "Cómo es la leche materna",
      resumen: "De qué está hecha y cómo cambia con el tiempo.",
      pasos: [
        "Calostro (los primeros días): rico en proteínas, carbohidratos y anticuerpos, con bajo contenido de grasa; aporta unas 67 kcal por cada 100 ml.",
        "Leche de transición: la que sigue al calostro, con más lactosa (el azúcar de la leche).",
        "Leche madura: alrededor de 90% agua, además de carbohidratos, proteínas y grasas; aporta unas 75 kcal por cada 100 ml.",
        "También contiene vitaminas y minerales que van cambiando según lo que el bebé necesita en cada etapa.",
        "Por adaptarse tanto a las necesidades del bebé, se le conoce como \"oro líquido\".",
      ],
      fuente: FUENTE_LACTANCIA,
    },
    {
      id: "tecnica-agarre",
      icono: "🙆‍♀️",
      titulo: "Postura y agarre correctos",
      resumen: "Cómo acomodarse para lactar sin molestias.",
      pasos: [
        "Existen varias posturas válidas: sentada, acostada, de balón o de \"caballito\"; elige la que te resulte más cómoda.",
        "El labio inferior del bebé debe abarcar la mayor parte de la areola, no solo el pezón.",
        "La barbilla del bebé debe quedar pegada al pecho, con su cuerpo cerca del tuyo.",
        "Un buen agarre ayuda a que no le entre aire al bebé y hace la toma más cómoda para ambos.",
        "Para cambiar de pecho o terminar la toma, introduce suavemente tu dedo meñique en la comisura de los labios del bebé: esto rompe el vacío y evita lastimarte.",
      ],
      fuente: FUENTE_LACTANCIA,
    },
    {
      id: "alimentacion-mama-lactando",
      icono: "🥦",
      titulo: "Alimentación de la mamá durante la lactancia",
      resumen: "Qué favorece la leche y qué es mejor evitar.",
      pasos: [
        "Lleva una dieta variada, equilibrada y suficiente: procura de 5 a 6 comidas al día.",
        "Toma entre 8 y 12 vasos de agua al día (unos 2.5 litros).",
        "Incluye alimentos con ácido fólico (verduras, frijoles, lentejas, cereales fortificados), hierro (carne roja magra, aves, mariscos) y yodo (lácteos, huevo, sal yodada).",
        "Si tu médico te indica suplemento de ácido fólico, el rango habitual es de 400 a 800 microgramos.",
        "Evita el consumo excesivo de grasas saturadas, así como tabaco, alcohol y narcóticos.",
        "Cuida también la cafeína y los alimentos que con más frecuencia causan alergia en el bebé: leche, cacahuate, huevo, pescado, crustáceos, frutos secos, trigo y soya.",
      ],
      fuente: FUENTE_LACTANCIA,
    },
    {
      id: "beneficios-lactancia",
      icono: "💚",
      titulo: "Beneficios de la lactancia materna",
      resumen: "Para el bebé, para la mamá, la familia y el ambiente.",
      pasos: [
        "Para el bebé: mejora su supervivencia, disminuye enfermedades, favorece el vínculo con la mamá y su desarrollo cognitivo.",
        "Para la mamá a corto plazo: ayuda a disminuir el sangrado después del parto y fortalece el vínculo con el bebé.",
        "Para la mamá a largo plazo: se asocia con menor riesgo de cáncer de mama y de útero, diabetes, problemas de colesterol, obesidad e infartos.",
        "Para la economía familiar: no tiene costo (a diferencia de la fórmula) y reduce gastos en consultas médicas por infecciones.",
        "Para el medio ambiente: se estima que 1 kg de fórmula cuesta al ambiente 4,700 litros de agua; lactar ahorra ese consumo de agua, energía y transporte.",
      ],
      fuente: FUENTE_LACTANCIA,
    },
    {
      id: "cuando-consultar-lactancia",
      icono: "⚠️",
      titulo: "Cuándo consultar a un profesional",
      resumen: "Situaciones que requieren orientación médica antes de decidir.",
      pasos: [
        "Si la mamá vive con VIH/SIDA o con el virus de leucemia humana.",
        "Si la mamá depende de drogas, o está en tratamiento con radioterapia o quimioterapia.",
        "Si el bebé tiene galactosemia (una condición que impide digerir la lactosa).",
        "Ante cualquiera de estas situaciones, es indispensable el acompañamiento de un médico o nutriólogo antes de decidir cómo alimentar al bebé.",
      ],
      fuente: FUENTE_LACTANCIA,
    },
  ],
};

/* =========================
   Directorio de nutriólogos
   (diseño flexible: funciona igual con 0, 1 o varios)
   ========================= */

const NUTRIOLOGOS = [
  // Ejemplo de forma esperada cuando Dianui proporcione los datos reales:
  // { nombre: "Dra. Olivia Pérez", especialidad: "Nutrición infantil", contacto: "https://wa.me/52..." },
];

function renderNutriologos() {
  const root = $("#nutriologosList");
  if (!root) return;
  root.innerHTML = "";

  if (!NUTRIOLOGOS.length) {
    const empty = el("div", { class: "resultCard nutriologo__empty" }, `
      <h3 class="h5">Muy pronto 🌱</h3>
      <p class="muted">
        Estamos por agregar aquí el contacto directo de nutriólogos y pasantes
        certificados por la Fundación DIANUI A.C. En cuanto esté disponible,
        vas a poder platicar con ellos desde esta misma sección.
      </p>
      <p class="tiny muted">Mientras tanto, puedes revisar las recetas y los tips ya disponibles en la app.</p>
    `);
    root.appendChild(empty);
    return;
  }

  const grid = el("div", { class: "grid" });
  NUTRIOLOGOS.forEach((n) => {
    const card = el("div", { class: "tile nutriologo__card" }, `
      <h3 class="h5">${escapeHtml(n.nombre)}</h3>
      <p class="muted">${escapeHtml(n.especialidad || "Nutrición general")}</p>
      <a class="btn btn--primary" href="${n.contacto || "#"}" target="_blank" rel="noreferrer">Platicar con ${escapeHtml((n.nombre || "").split(" ")[0] || "el nutriólogo")}</a>
    `);
    grid.appendChild(card);
  });
  root.appendChild(grid);
}

/* =========================
   Navegación por pantallas (app de menú)
   En vez de un scroll largo con todo visible, la página se
   comporta como una app: solo la pantalla de inicio (menú) o
   una sección a la vez están visibles. Nada se muestra hasta
   que la mamá lo pide.
   ========================= */

const SCREEN_IDS = ["home", "que-es", "como-funciona", "recetario", "lactancia", "nutriologos", "faq"];

function showScreen(id, opts) {
  opts = opts || {};
  if (!SCREEN_IDS.includes(id)) id = "home";

  SCREEN_IDS.forEach((screenId) => {
    const node = document.getElementById(screenId);
    if (node) node.classList.toggle("screen--active", screenId === id);
  });

  $all(".nav a").forEach((a) => {
    a.classList.toggle("nav__link--active", a.dataset.target === id);
  });

  if (!opts.skipHash) {
    const newHash = "#" + id;
    if (location.hash !== newHash) {
      history.pushState({ screen: id }, "", newHash);
    }
  }

  try {
    window.scrollTo(0, 0);
  } catch (e) {
    /* algunos entornos de prueba no implementan scrollTo; no afecta la navegación */
  }
}

/* =========================
   Tema
   ========================= */

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  const btn = $("#themeBtn");
  if (btn) btn.textContent = theme === "light" ? "☾" : "☀";
}

(function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") setTheme(saved);
})();

document.addEventListener("DOMContentLoaded", () => {
  const themeBtn = $("#themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      setTheme(current === "dark" ? "light" : "dark");
    });
  }

  /* =========================
     Navegación por pantallas
     Cualquier elemento con [data-target] (tarjetas del menú,
     enlaces del nav, botones "volver", CTA del hero) cambia
     de pantalla en lugar de hacer scroll.
     ========================= */
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-target]");
    if (!trigger) return;
    e.preventDefault();
    showScreen(trigger.dataset.target);
  });

  window.addEventListener("popstate", () => {
    const id = (location.hash || "#home").slice(1);
    showScreen(id, { skipHash: true });
  });

  const initialId = (location.hash || "#home").slice(1);
  showScreen(initialId, { skipHash: true });

  /* =========================
     Recetario guiado
     ========================= */
  const recetarioGrid = $("#recetarioGrid");
  if (recetarioGrid) {
    CONTENT.recetas.forEach((receta) => {
      recetarioGrid.appendChild(buildRecetaPreview(receta));
    });
  }

  /* =========================
     Lactancia
     ========================= */
  renderLactanciaPath();

  /* =========================
     Directorio de nutriólogos
     ========================= */
  renderNutriologos();

  /* =========================
     Flujo rápido: "Cómo funciona"
     ========================= */
  const goBtn = $("#goBtn");
  const resetBtn = $("#resetBtn");
  if (goBtn) {
    goBtn.addEventListener("click", () => {
      const key = $("#goalSelect").value;
      renderRoute(key);
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      $(".flow__result").innerHTML = `
        <div class="resultCard">
          <h3 class="h5">Tu ruta aparecerá aquí 👇</h3>
          <p class="muted">Elige una opción y presiona “Continuar”.</p>
        </div>
      `;
    });
  }

  /* =========================
     FAQ interactivo
     ========================= */
  renderFaq(FAQ);
  const faqSearch = $("#faqSearch");
  if (faqSearch) {
    faqSearch.addEventListener("input", (e) => {
      const items = filterFaq(e.target.value || "");
      renderFaq(items);
    });
  }
  const expandAllBtn = $("#expandAllBtn");
  const collapseAllBtn = $("#collapseAllBtn");
  if (expandAllBtn) {
    expandAllBtn.addEventListener("click", () => {
      $all("#faqList details").forEach((d) => (d.open = true));
    });
  }
  if (collapseAllBtn) {
    collapseAllBtn.addEventListener("click", () => {
      $all("#faqList details").forEach((d) => (d.open = false));
    });
  }
});

/* =========================
   Modal / popup genérico
   Se usa para mostrar el detalle de una receta sin llenar
   toda la página: mientras no se pide, queda oculto.
   ========================= */

let activeModalClose = null;

function closeActiveModal() {
  if (activeModalClose) activeModalClose();
}

function openModal({ title, icon, bodyNode, onClose }) {
  closeActiveModal();

  const overlay = el("div", { class: "modalOverlay" });
  const dialog = el("div", {
    class: "modalDialog",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": title || "Detalle",
  });

  const header = el("div", { class: "modalDialog__header" });
  if (icon) {
    header.appendChild(el("span", { class: "modalDialog__icon", "aria-hidden": "true" }, icon));
  }
  header.appendChild(el("h3", { class: "h5 modalDialog__title" }, escapeHtml(title || "")));
  const closeBtn = el("button", { type: "button", class: "btn btn--ghost btn--sm modalDialog__close", "aria-label": "Cerrar" }, "✕");
  header.appendChild(closeBtn);
  dialog.appendChild(header);

  const body = el("div", { class: "modalDialog__body" });
  body.appendChild(bodyNode);
  dialog.appendChild(body);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  document.body.classList.add("noScroll");

  function onKeydown(e) {
    if (e.key === "Escape") close();
  }
  function close() {
    overlay.remove();
    document.body.classList.remove("noScroll");
    document.removeEventListener("keydown", onKeydown);
    if (activeModalClose === close) activeModalClose = null;
    if (typeof onClose === "function") onClose();
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", onKeydown);

  activeModalClose = close;
  closeBtn.focus();

  return { close };
}

/* =========================
   Vista previa de receta (tarjeta pequeña + expandir)
   ========================= */

function buildRecetaPreview(receta) {
  const wrap = el("div", { class: "tile recetaTile" });

  if (receta.foto) {
    const photoWrap = el("div", { class: "recetaTile__photoWrap" });
    photoWrap.appendChild(el("img", {
      src: `assets/recetas/${receta.foto}`,
      alt: `Foto de ${receta.titulo}`,
      class: "recetaTile__photo",
      loading: "lazy",
    }));
    wrap.appendChild(photoWrap);
  }

  const top = el("div", { class: "recetaTile__top" });
  if (receta.icono) {
    top.appendChild(el("div", { class: "recetaTile__icon", "aria-hidden": "true" }, receta.icono));
  }
  top.appendChild(el("h3", { class: "h5 recetaTile__titulo" }, escapeHtml(receta.titulo)));
  wrap.appendChild(top);

  if (receta.resumen) {
    const chips = el("div", { class: "recetaTile__chips" });
    receta.resumen
      .split("·")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((parte) => chips.appendChild(el("span", { class: "chip tiny" }, escapeHtml(parte))));
    wrap.appendChild(chips);
  }

  const stepCount = el("p", { class: "tiny muted recetaTile__stepCount" }, `${receta.pasos.length} pasos, en modo slides`);
  wrap.appendChild(stepCount);

  const toggleBtn = el("button", { type: "button", class: "btn btn--primary btn--sm" }, "Ver receta en pasos");

  // El contenido del modal se construye una sola vez y se reutiliza cada
  // vez que se abre el popup, así el progreso y el paso donde se quedó
  // el usuario no se pierden al cerrar y volver a abrir.
  let modalBody = null;
  toggleBtn.addEventListener("click", () => {
    if (!modalBody) {
      modalBody = buildRecetaModalBody(receta);
    }
    openModal({ title: receta.titulo, icon: receta.icono, bodyNode: modalBody });
  });

  wrap.appendChild(toggleBtn);
  return wrap;
}

/* =========================
   Cuerpo del modal de receta: primero ingredientes, después pasos.
   "Antes de empezar la receta" se muestra qué se necesita, para que
   la mamá pueda revisar/comprar antes de ponerse a cocinar; el botón
   "Comenzar receta" lleva al carrusel de pasos ya existente.
   ========================= */

function buildRecetaModalBody(receta) {
  const container = el("div", { class: "recetaModal" });

  const ingredientesView = el("div", { class: "recetaModal__ingredientes" });

  if (receta.foto) {
    const photoWrap = el("div", { class: "carrusel__photoWrap" });
    photoWrap.appendChild(el("img", {
      src: `assets/recetas/${receta.foto}`,
      alt: `Foto de ${receta.titulo}`,
      class: "carrusel__photo",
      loading: "lazy",
    }));
    ingredientesView.appendChild(photoWrap);
  }

  if (receta.resumen) {
    ingredientesView.appendChild(el("p", { class: "muted tiny" }, escapeHtml(receta.resumen)));
  }

  ingredientesView.appendChild(el("h4", { class: "h5 recetaModal__subtitle" }, "Ingredientes que necesitas"));

  const ul = el("ul", { class: "ingredientesList" });
  (receta.ingredientes || []).forEach((ing) => {
    ul.appendChild(el("li", { class: "ingredientesList__item" }, escapeHtml(ing)));
  });
  ingredientesView.appendChild(ul);

  if (receta.extra) {
    ingredientesView.appendChild(el("p", { class: "tiny muted" }, receta.extra));
  }

  ingredientesView.appendChild(el("p", { class: "tiny muted recetaModal__tip" },
    "Tip: revisa primero qué ya tienes en casa. Para lo demás, un mercado local o tianguis suele tener las frutas y verduras más frescas y a mejor precio que el supermercado; si compras algo empacado, elige el que tenga menos sellos de advertencia."
  ));

  const startBtn = el("button", { type: "button", class: "btn btn--primary recetaModal__start" }, "Comenzar receta →");
  ingredientesView.appendChild(startBtn);

  container.appendChild(ingredientesView);

  let pasosView = null;
  startBtn.addEventListener("click", () => {
    if (!pasosView) {
      pasosView = buildGuidedCard({ ...receta, categoria: "receta" }, { modo: "carrusel", mostrarHeader: false, ocultarFoto: true });
      container.appendChild(pasosView);
    }
    ingredientesView.setAttribute("hidden", "hidden");
    pasosView.removeAttribute("hidden");
  });

  return container;
}

/* =========================
   Ruta de lecciones de Lactancia (estilo Duolingo/Sololearn)
   En vez de una lista de tarjetas, cada tema es un nodo circular
   grande en un camino en zigzag. El nodo cambia de color según el
   avance guardado en localStorage: sin empezar, en progreso o
   completo. Al tocarlo se abre el mismo popup con el checklist.
   ========================= */

function lactanciaTemaEstado(tema) {
  const done = getProgress(`lactancia:${tema.id}`, tema.pasos.length);
  const n = done.filter(Boolean).length;
  if (n === 0) return "pendiente";
  if (n === tema.pasos.length) return "completo";
  return "progreso";
}

function renderLactanciaPath() {
  const progressRoot = $("#lactanciaProgress");
  const pathRoot = $("#lactanciaList");
  if (!pathRoot) return;

  function refresh() {
    const temas = CONTENT.lactancia;
    const estados = temas.map(lactanciaTemaEstado);
    const completos = estados.filter((e) => e === "completo").length;

    if (progressRoot) {
      const pct = temas.length ? Math.round((completos / temas.length) * 100) : 0;
      progressRoot.innerHTML = "";
      const label = el("p", { class: "tiny muted courseProgress__label" },
        completos === temas.length
          ? `¡Completaste las ${temas.length} lecciones! 🎉`
          : `${completos} de ${temas.length} lecciones completas`
      );
      const bar = el("div", { class: "progressBar courseProgress__bar" });
      const fill = el("div", { class: "progressBar__fill" });
      fill.style.width = pct + "%";
      bar.appendChild(fill);
      progressRoot.appendChild(label);
      progressRoot.appendChild(bar);
    }

    pathRoot.innerHTML = "";
    temas.forEach((tema, idx) => {
      const estado = estados[idx];
      const row = el("div", { class: `lessonPath__row lessonPath__row--${idx % 2 === 0 ? "left" : "right"}` });

      const node = el("button", {
        type: "button",
        class: `lessonNode lessonNode--${estado}`,
        "aria-label": `${tema.titulo} (${estado === "completo" ? "completo" : estado === "progreso" ? "en progreso" : "sin empezar"})`,
      });
      node.appendChild(el("span", { class: "lessonNode__icon", "aria-hidden": "true" }, tema.icono || "🤱"));
      if (estado === "completo") {
        node.appendChild(el("span", { class: "lessonNode__badge", "aria-hidden": "true" }, "✓"));
      }

      let guidedCard = null;
      node.addEventListener("click", () => {
        if (!guidedCard) {
          guidedCard = buildGuidedCard({ ...tema, categoria: "lactancia" }, { modo: "carrusel", mostrarHeader: false });
        }
        openModal({
          title: tema.titulo,
          icon: tema.icono,
          bodyNode: guidedCard,
          onClose: refresh,
        });
      });

      const label = el("p", { class: "lessonPath__label tiny" }, escapeHtml(tema.titulo));

      row.appendChild(node);
      row.appendChild(label);
      pathRoot.appendChild(row);
    });
  }

  refresh();
}

/* =========================
   Flujo: "Cómo funciona"
   ========================= */

const ROUTES = {
  contacto: {
    title: "Contactar a un nutriólogo",
    render: (container) => {
      container.innerHTML = `
        <div class="resultCard">
          <h3 class="h5">Contactar a un nutriólogo</h3>
          <p class="muted">
            Muy pronto vas a poder platicar directamente con nutriólogos y
            pasantes certificados por la Fundación DIANUI A.C. Esta sección
            está en preparación.
          </p>
          <a class="btn btn--primary" href="#nutriologos" data-target="nutriologos">Ver esta sección</a>
          <p class="tiny muted" style="margin-top:10px;">Mientras tanto, explora las recetas y los tips ya disponibles.</p>
        </div>
      `;
    },
  },
  recetas: {
    title: "Ver recetas",
    render: (container) => {
      container.innerHTML = `
        <div class="resultCard">
          <h3 class="h5">Recetas reales, paso a paso</h3>
          <p class="muted">Elige una receta y marca cada paso como listo conforme la vayas preparando.</p>
          <a class="btn btn--primary" href="#recetario" data-target="recetario">Ir al recetario</a>
          <p class="tiny muted" style="margin-top:10px;">Si tienes dudas sobre porciones, contacta a un nutriólogo (sección en preparación).</p>
        </div>
      `;
    },
  },
  descanso: {
    title: "Tips de descanso",
    render: (container) => {
      container.innerHTML = `<div class="resultCard" id="rutaDescanso"></div>`;
      const holder = $("#rutaDescanso", container);
      holder.appendChild(buildGuidedCard({ ...CONTENT.descanso[0], categoria: "descanso" }));
    },
  },
  actividad: {
    title: "Actividad física",
    render: (container) => {
      container.innerHTML = `<div class="resultCard" id="rutaActividad"></div>`;
      const holder = $("#rutaActividad", container);
      holder.appendChild(buildGuidedCard({ ...CONTENT.actividad[0], categoria: "actividad" }));
    },
  },
  habitos: {
    title: "Hábitos alimenticios",
    render: (container) => {
      container.innerHTML = `<div class="resultCard" id="rutaHabitos"></div>`;
      const holder = $("#rutaHabitos", container);
      holder.appendChild(buildGuidedCard({ ...CONTENT.habitos[0], categoria: "habitos" }));
    },
  },
};

function renderRoute(key) {
  const route = ROUTES[key];
  const container = $(".flow__result");
  if (!route || !container) return;
  route.render(container);
}

/* =========================
   FAQ interactivo — contenido real
   ========================= */

const FAQ = [
  {
    q: "¿Qué es DIANUI 911?",
    a: "Un programa de ayuda, orientación y educación nutricional de la Fundación DIANUI A.C., dirigido a mujeres madres de familia, apoyado por recursos tecnológicos y pensado para usarse fácilmente desde el celular.",
  },
  {
    q: "¿Cómo se brinda la asesoría con nutriólogos?",
    a: "Muy pronto podrás contactar directamente a nutriólogos y pasantes certificados por la Fundación DIANUI A.C. desde la sección “Habla con un nutriólogo”. Por ahora esa sección está en preparación mientras se confirma la información.",
  },
  {
    q: "¿De dónde sale la información de las recetas y los tips?",
    a: "De materiales reales elaborados para Dianui, como el Manual de Recetas Nutritivas con Ingredientes de Huerto y las Guías Alimentarias saludables y sostenibles para la población mexicana 2025 (SSA, INSP, UNICEF).",
  },
  {
    q: "¿Tengo que pagar por usar la app?",
    a: "No. DIANUI 911 es un programa gratuito de orientación y educación nutricional.",
  },
  {
    q: "¿Esto sustituye ir con un doctor o nutriólogo?",
    a: "No. Es información educativa e informativa. Para atención personalizada, usa la sección de contacto con nutriólogos (en preparación) o acude con tu médico si hay señales de alarma.",
  },
  {
    q: "¿Puedo guardar mi progreso al preparar una receta?",
    a: "Sí. Si marcas los pasos de una receta como listos y cierras la app, al volver a abrirla vas a seguir viendo justo donde te quedaste.",
  },
  {
    q: "¿Qué pasa si todavía no hay recetas o tips de un tema que busco?",
    a: "Estamos agregando contenido nuevo de recetas, descanso, actividad física y salud emocional conforme la Fundación DIANUI A.C. lo va proporcionando. Por ahora encontrarás lo que ya está disponible y verificado.",
  },
  {
    q: "¿Necesito saber mucho de tecnología para usar DIANUI 911?",
    a: "No. La app está pensada para ser simple: botones grandes, sin términos técnicos y sin pasos complicados.",
  },
  {
    q: "¿Las recetas son solo para niños o también para el resto de la familia?",
    a: "Las porciones que se muestran están pensadas por edad (0-2, 3-5 y 6-12 años), pero los ingredientes y la preparación sirven para toda la familia; solo ajusta la cantidad según quién vaya a comer.",
  },
  {
    q: "¿Qué hago si mi hijo o alguien de mi familia tiene alergias o una condición de salud especial?",
    a: "El contenido de DIANUI 911 es información general, no un plan personalizado. Si hay alergias, enfermedades o alguna condición especial, es importante confirmar cualquier receta o tip con un nutriólogo (sección en preparación) o con tu médico antes de aplicarlo.",
  },
  {
    q: "¿Necesito internet para usar la app?",
    a: "Sí, necesitas conexión para abrir la página. Una vez abierta, el progreso que marques en una receta se guarda directamente en tu celular, aunque después te quedes sin conexión por un rato.",
  },
  {
    q: "¿Cómo sé que la información de la app es confiable?",
    a: "Cada receta y cada tip cita de dónde salió: las Guías Alimentarias saludables y sostenibles para la población mexicana 2025 (SSA, INSP, UNICEF) y los manuales de la Fundación DIANUI A.C. No se basa en opiniones sin respaldo.",
  },
  {
    q: "¿La app tiene información sobre lactancia materna?",
    a: "Sí. En la sección \"Lactancia materna\" encontrarás qué es la lactancia exclusiva, cómo es la leche materna, la técnica correcta, la alimentación recomendada para la mamá y sus beneficios, basado en material real de la Fundación DIANUI A.C. y de la Asociación Española de Pediatría.",
  },
];

function renderFaq(items) {
  const root = $("#faqList");
  if (!root) return;
  root.innerHTML = "";

  items.forEach(({ q, a }, idx) => {
    const item = el("details", {});
    item.innerHTML = `
      <summary>${escapeHtml(q)}</summary>
      <div class="answer">${escapeHtml(a)}</div>
    `;
    item.dataset.idx = String(idx);
    root.appendChild(item);
  });
}

function filterFaq(term) {
  const t = term.trim().toLowerCase();
  if (!t) return FAQ;
  return FAQ.filter(
    (item) => item.q.toLowerCase().includes(t) || item.a.toLowerCase().includes(t)
  );
}
