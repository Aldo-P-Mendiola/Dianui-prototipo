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
 * @param {Object} item - { id, categoria, titulo, resumen, pasos: [texto,...], extra: html opcional, fuente }
 */
function buildGuidedCard(item) {
  const key = `${item.categoria}:${item.id}`;
  const total = item.pasos.length;
  let done = getProgress(key, total);

  const card = el("article", { class: "guiado__card", "data-key": key });

  const doneCount = () => done.filter(Boolean).length;

  const header = el("div", { class: "guiado__header" });
  header.appendChild(el("h4", { class: "h5" }, escapeHtml(item.titulo)));
  if (item.resumen) {
    header.appendChild(el("p", { class: "muted tiny" }, escapeHtml(item.resumen)));
  }
  card.appendChild(header);

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

  const list = el("ul", { class: "guiado__steps" });

  function refreshProgressUI() {
    const n = doneCount();
    const pct = total ? Math.round((n / total) * 100) : 0;
    progressFill.style.width = pct + "%";
    progressWrap.setAttribute("aria-valuenow", String(n));
    progressLabel.textContent =
      n === 0 ? `0 de ${total} pasos listos` :
      n === total ? `¡Listo! Completaste los ${total} pasos.` :
      `${n} de ${total} pasos listos`;
  }

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
  refreshProgressUI();

  const actions = el("div", { class: "guiado__actions" });
  const resetBtn = el("button", { type: "button", class: "btn btn--ghost btn--sm" }, "Reiniciar esta lista");
  resetBtn.addEventListener("click", () => {
    done = new Array(total).fill(false);
    resetProgress(key, total);
    $all(".guiado__checkbox", list).forEach((cb) => (cb.checked = false));
    $all(".guiado__step", list).forEach((li) => li.classList.remove("guiado__step--done"));
    refreshProgressUI();
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

const CONTENT = {
  recetas: [
    {
      id: "crema-zanahoria-calabaza",
      titulo: "Crema de zanahoria y calabaza",
      resumen: "120 kcal por porción · 2 g de proteína",
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
      titulo: "Ensalada de pepino y tomate",
      resumen: "80 kcal por porción · 2 g de proteína",
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
      titulo: "Tortitas de espinaca",
      resumen: "150 kcal por porción · 8 g de proteína",
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
      titulo: "Arroz con verduras",
      resumen: "190 kcal por porción · 5 g de proteína",
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
      titulo: "Omelette de espinaca y tomate",
      resumen: "170 kcal por porción · 11 g de proteína",
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
      titulo: "Sopa de verduras",
      resumen: "100 kcal por porción · 3 g de proteína",
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
      titulo: "Tacos de lechuga con pollo",
      resumen: "200 kcal por porción · 15 g de proteína",
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
      titulo: "Smoothie de fresa y espinaca",
      resumen: "140 kcal por porción · 6 g de proteína",
      pasos: [
        "Lava 1 taza de fresas y 1/2 taza de espinaca.",
        "Licúa con 1 taza de leche y 1 cucharadita de miel hasta integrar bien.",
        "Sirve frío.",
      ],
      extra: "Porción sugerida: 1/2 vaso (0-2 años), 3/4 vaso (3-5 años), 1 vaso (6-12 años).",
      fuente: FUENTE_RECETAS,
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
     Recetario guiado
     ========================= */
  const recetarioGrid = $("#recetarioGrid");
  if (recetarioGrid) {
    CONTENT.recetas.forEach((receta) => {
      recetarioGrid.appendChild(buildRecetaPreview(receta));
    });
  }

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
          <p class="muted">Elige una opción y presiona "Continuar".</p>
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
   Vista previa de receta (tarjeta pequeña + expandir)
   ========================= */

function buildRecetaPreview(receta) {
  const wrap = el("div", { class: "tile recetaTile" });
  wrap.appendChild(el("h3", { class: "h5" }, escapeHtml(receta.titulo)));
  wrap.appendChild(el("p", { class: "muted tiny" }, escapeHtml(receta.resumen || "")));

  const toggleBtn = el("button", { type: "button", class: "btn btn--primary btn--sm" }, "Ver receta paso a paso");
  const guidedHolder = el("div", { class: "recetaTile__guided", hidden: "hidden" });

  let built = false;
  toggleBtn.addEventListener("click", () => {
    const isHidden = guidedHolder.hasAttribute("hidden");
    if (isHidden) {
      if (!built) {
        guidedHolder.appendChild(buildGuidedCard({ ...receta, categoria: "receta" }));
        built = true;
      }
      guidedHolder.removeAttribute("hidden");
      toggleBtn.textContent = "Ocultar receta";
    } else {
      guidedHolder.setAttribute("hidden", "hidden");
      toggleBtn.textContent = "Ver receta paso a paso";
    }
  });

  wrap.appendChild(toggleBtn);
  wrap.appendChild(guidedHolder);
  return wrap;
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
          <a class="btn btn--primary" href="#nutriologos">Ver esta sección</a>
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
          <a class="btn btn--primary" href="#recetario">Ir al recetario</a>
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
