"use strict";

const APP_VERSION = "1.6.2";

const TIPOS_ENTRENO = {
  "bici-cerro": { label: "Bici cerro", badge: "badge-bici", icon: "bici", campos: ["distancia", "desnivel", "tiempo", "fc"] },
  "bici-xco": { label: "Bici XCO", badge: "badge-bici", icon: "bici", campos: ["distancia", "desnivel", "tiempo", "fc"] },
  "bici-electrica": { label: "Bici eléctrica", badge: "badge-bici", icon: "bici", campos: ["distancia", "desnivel", "tiempo", "fc"] },
  gym: { label: "Gym", badge: "badge-gym", icon: "gym", campos: ["ejercicios"] },
  trote: { label: "Trote", badge: "badge-trote", icon: "trote", campos: ["distancia", "tiempo", "ritmo", "fc"] },
  futbol: { label: "Futbolito", badge: "badge-futbol", icon: "futbol", campos: ["tiempo"] },
  commute: { label: "Commuting", badge: "badge-commute", icon: "commute", campos: [] },
};

const CAMPOS = {
  distancia: { label: "Distancia (km)", type: "number", step: "0.1", inputmode: "decimal" },
  desnivel: { label: "Desnivel (m)", type: "number", step: "1", inputmode: "numeric" },
  tiempo: { label: "Tiempo (min)", type: "number", step: "1", inputmode: "numeric" },
  ritmo: { label: "Ritmo (min/km)", type: "number", step: "0.1", inputmode: "decimal" },
  fc: { label: "FC media / máx", type: "text", placeholder: "ej. 142 / 178", inputmode: "text" },
};

const ICONS = {
  bici: '<path d="M5.5 20a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/><path d="M18.5 20a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/><path d="M9 16.5h6l-3-7h-2.5L7 13l2 3.5z"/><path d="M12 9.5h4"/>',
  gym: '<path d="M6 4v16"/><path d="M18 4v16"/><rect x="2" y="8" width="4" height="8" rx="1"/><rect x="18" y="8" width="4" height="8" rx="1"/><line x1="10" y1="4" x2="14" y2="4"/><line x1="10" y1="20" x2="14" y2="20"/>',
  trote: '<circle cx="13" cy="4.5" r="2"/><path d="M11 8l-2.5 4L6 11l1 2.5 3.5-.5 1.5 3 1.5 5 2.5-.5-1.5-5L11 12l1.5-2.5"/><path d="M14.5 11.5L17 10l2 3.5-2.5 1.5"/>',
  futbol: '<circle cx="12" cy="12" r="9"/><path d="M12 7l-4.5 3 1.7 5h5.6l1.7-5L12 7z"/><path d="M12 3v4"/><path d="M12 15v6"/>',
  commute: '<path d="M5.5 20a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/><path d="M18.5 20a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/><path d="M9 16.5h6l-3-7h-2.5L7 13l2 3.5z"/><path d="M5 8l4-2"/><path d="M16 10h4l1 3"/>',
};

const svgWrap = (icon) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`;

const $ = (sel, root = document) => root.querySelector(sel);

let currentView = "hoy";
let estadoSync = "ok";

/* ================= Estado ================= */
const App = {
  comidas: [],
  entrenos: [],
  async loadAll() {
    const [comidas, entrenos] = await Promise.all([
      DB.getAll("comidas"),
      DB.getAll("entrenos"),
    ]);
    this.comidas = comidas.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
    this.entrenos = entrenos.sort((a, b) => (a.fecha + (a.hora || "")).localeCompare(b.fecha + (b.hora || "")));
  },
  comidasDe(fecha) {
    return this.comidas.filter((c) => c.fecha === fecha);
  },
  entrenosDe(fecha) {
    return this.entrenos.filter((e) => e.fecha === fecha);
  },
};

/* ================= Navegación ================= */
function switchView(view) {
  currentView = view;
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view);
  });
  render();
}

/* ================= Metas diarias ================= */
const METAS_DEFAULT = { calorias: 2200, proteinas: 165, carbs: 250, grasas: 60 };

function metasDiarias() {
  try {
    const m = JSON.parse(localStorage.getItem("metas") || "null");
    if (!m) return { ...METAS_DEFAULT };
    return {
      calorias: Number(m.calorias) || METAS_DEFAULT.calorias,
      proteinas: Number(m.proteinas) || METAS_DEFAULT.proteinas,
      carbs: Number(m.carbs) || METAS_DEFAULT.carbs,
      grasas: Number(m.grasas) || METAS_DEFAULT.grasas,
    };
  } catch {
    return { ...METAS_DEFAULT };
  }
}

function progresoDia(fecha) {
  const todas = App.comidasDe(fecha);
  const comidas = todas.filter((c) => c.macros);
  const sum = (k) => comidas.reduce((s, c) => s + (Number(c.macros[k]) || 0), 0);
  return {
    conMacros: comidas.length,
    total: todas.length,
    sinMacros: todas.length - comidas.length,
    calorias: sum("calorias"),
    proteinas: sum("proteinas"),
    carbs: sum("carbs"),
    grasas: sum("grasas"),
  };
}

function tieneClaveGemini() {
  return !!(localStorage.getItem("geminiKey") || "").trim();
}

function barraProgreso(valor, meta, label, unidad) {
  const pct = meta > 0 ? Math.min(100, Math.round((valor / meta) * 100)) : 0;
  const falta = Math.max(0, Math.round(meta - valor));
  const clase = pct >= 100 ? "done" : "warn";
  return `
    <div class="prog-row">
      <div class="prog-lbl"><span>${label}</span><span>${Math.round(valor)} / ${meta} ${unidad} · falta ${falta}</span></div>
      <div class="prog-bar"><div class="prog-fill ${clase}" style="width:${pct}%"></div></div>
    </div>`;
}

function cardProgresoDia(fecha) {
  const p = progresoDia(fecha);
  const metas = metasDiarias();
  let aviso = "";
  if (p.total === 0) {
    aviso = '<div class="empty">Registra comidas para ver tu progreso</div>';
  } else if (p.sinMacros > 0) {
    if (!tieneClaveGemini()) {
      aviso = `<div class="entry-meta" style="margin-top:8px">⚠️ ${p.sinMacros} comida${p.sinMacros > 1 ? "s" : ""} sin macros — <b>configura tu clave de Gemini</b> en Ajustes para estimarlas automáticamente</div>`;
    } else {
      aviso = `
        <div class="entry-meta" style="margin-top:8px">⚠️ ${p.sinMacros} comida${p.sinMacros > 1 ? "s" : ""} sin macros — el progreso es parcial</div>
        <button class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="estimarFaltantes('${fecha}')">🔍 Estimar macros faltantes</button>`;
    }
  } else if (p.total > 0) {
    aviso = `<div class="entry-meta" style="margin-top:8px">✓ macros de ${p.conMacros} de ${p.total} comidas</div>`;
  }
  return `
    <div class="card">
      <div class="card-title-row"><h3>Cuánto falta hoy · ${fmtFecha(fecha)}</h3></div>
      ${barraProgreso(p.proteinas, metas.proteinas, "Proteína", "g")}
      ${barraProgreso(p.carbs, metas.carbs, "Carbs", "g")}
      ${barraProgreso(p.grasas, metas.grasas, "Grasas", "g")}
      ${barraProgreso(p.calorias, metas.calorias, "Calorías", "kcal")}
      ${aviso}
    </div>`;
}

/* ================= Estimación de macros faltantes ================= */
async function estimarFaltantes(fecha) {
  if (!tieneClaveGemini()) {
    toast("Configura tu clave de Gemini en Ajustes primero", true);
    return;
  }
  const pendientes = App.comidasDe(fecha).filter((c) => !c.macros);
  if (!pendientes.length) return toast("No hay comidas pendientes ✓", false, true);

  let ok = 0;
  for (const c of pendientes) {
    try {
      const macros = await estimarMacrosTexto(c.texto);
      if (macros) {
        c.macros = macros;
        await DB.add("comidas", c);
        ok++;
      }
    } catch (err) {
      if (!/falta clave/.test(err.message || "")) {
        toast(`Error con "${c.texto.slice(0, 20)}…"`, true);
      }
    }
  }
  setPendienteSync();
  if (ok > 0) toast(`${ok} de ${pendientes.length} estimadas ✓`, false, true);
  render();
}

/* ================= Render: Hoy ================= */
function renderHoy() {
  const hoy = todayStr();
  const comidas = App.comidasDe(hoy);
  const entrenos = App.entrenosDe(hoy);

  const reminders = [
    { id: "desayuno", label: "Desayuno registrado" },
    { id: "almuerzo", label: "Almuerzo registrado" },
    { id: "cena", label: "Cena registrada" },
  ];

  const doneIds = comidas.map((c) => c.etiqueta).filter(Boolean);
  const remHtml = reminders
    .map((r) => {
      const done = doneIds.includes(r.id);
      const icon = done
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
      return `<div class="reminder ${done ? "done" : "pending"}">${icon}<span>${r.label}</span></div>`;
    })
    .join("");

  const entrenoToday = entrenos.length
    ? entrenos
        .map(
          (e) => `<div class="entry">
            <div class="entry-main">
              <span class="badge ${TIPOS_ENTRENO[e.tipo]?.badge || "badge-gym"}">${esc(TIPOS_ENTRENO[e.tipo]?.label || e.tipo)}</span>
              <div class="entry-title">${esc(e.resumen || "Entrenamiento")}</div>
            </div>
            <div class="entry-actions">
              <div class="entry-time">${e.hora || ""}</div>
              <button class="entry-del" onclick="borrarRegistro('entrenos','${e.id}')" title="Borrar" aria-label="Borrar">✕</button>
            </div>
          </div>`
        )
        .join("")
    : '<div class="empty">Sin entrenamiento registrado hoy.<br>¡La bici al trabajo también cuenta!</div>';

  const foodHtml = comidas.length
    ? comidas
        .map(
          (c) => `<div class="entry">
            <div class="entry-main"><div class="entry-title">${esc(c.texto)}</div></div>
            <div class="entry-actions">
              <div class="entry-time">${c.hora || ""}</div>
              <button class="entry-del" onclick="borrarRegistro('comidas','${c.id}')" title="Borrar" aria-label="Borrar">✕</button>
            </div>
          </div>`
        )
        .join("")
    : '<div class="empty">Nada registrado hoy todavía.</div>';

  $("#view").innerHTML = `
    <div class="view-section">
      <div class="stats-grid">
        <div class="stat"><div class="num">${comidas.length}</div><div class="lbl">Comidas</div></div>
        <div class="stat"><div class="num">${entrenos.length}</div><div class="lbl">Entrenos</div></div>
        <div class="stat"><div class="num">${kmBiciHoy(entrenos)}</div><div class="lbl">Km bici</div></div>
      </div>
      <div class="card">
        <h3>Hoy · ${fmtFecha(hoy)}</h3>
        ${remHtml}
      </div>
      ${cardProgresoDia(hoy)}
      <div class="card">
        <div class="card-title-row"><h3>Comidas</h3><button class="btn btn-sm btn-secondary" onclick="goComida()">+ Añadir</button></div>
        ${foodHtml}
      </div>
      <div class="card">
        <div class="card-title-row"><h3>Entrenamientos</h3><button class="btn btn-sm btn-secondary" onclick="goEntreno()">+ Añadir</button></div>
        ${entrenoToday}
      </div>
      ${entrenos.length ? '<div class="card"><button class="btn btn-secondary" onclick="switchView(\'semana\')">Ver mi semana</button></div>' : ""}
    </div>`;
}

function kmBiciHoy(entrenos) {
  const tipos = ["bici-cerro", "bici-xco", "bici-electrica", "commute"];
  const total = entrenos
    .filter((e) => tipos.includes(e.tipo))
    .reduce((s, e) => s + parseFloat(e.datos?.distancia || 0), 0);
  return total ? total.toFixed(1) : "0";
}

/* ================= Render: Comida ================= */
function renderComida() {
  const hoy = todayStr();
  const lista = App.comidasDe(hoy);
  const items = lista
    .map(
      (c) => `<div class="entry">
        <div class="entry-main">
          <div class="entry-title">${esc(c.texto)}</div>
          ${c.macros ? `<div class="entry-macros">${macrosBadge(c.macros)}</div>` : ""}
          ${c.notas ? `<div class="entry-meta">${esc(c.notas)}</div>` : ""}
        </div>
        <div class="entry-actions">
          <div class="entry-time">${c.hora || ""}</div>
          <button class="entry-del" onclick="borrarRegistro('comidas','${c.id}')" title="Borrar" aria-label="Borrar">✕</button>
        </div>
      </div>`
    )
    .join("") || '<div class="empty">Hoy no has registrado comidas.</div>';

  $("#view").innerHTML = `
    <div class="view-section">
      ${cardProgresoDia(hoy)}
      <div class="card">
        <div class="card-title-row"><h3>Nueva comida · ${fmtFecha(hoy)}</h3></div>
        <div class="form-group">
          <label>¿Qué comiste? <span style="color:var(--text-dim)">(desayuno, almuerzo, colación, cena)</span></label>
          <textarea id="c-texto" placeholder="ej. almuerzo: pollo al horno, arroz, ensalada + un jugo natural"></textarea>
        </div>
        <div class="form-group">
          <label>Etiqueta (para recordatorios)</label>
          <select id="c-etiqueta">
            <option value="">— ninguna —</option>
            <option value="desayuno">Desayuno</option>
            <option value="almuerzo">Almuerzo</option>
            <option value="cena">Cena</option>
            <option value="colacion">Colación</option>
          </select>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Hora</label><input type="time" id="c-hora" value="${horaActual()}"></div>
          <div class="form-group"><label>Notas (opcional)</label><input type="text" id="c-notas" placeholder="porción, extras..."></div>
        </div>
        <div class="form-row">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('camara').click()">📷 Foto</button>
          <button class="btn" onclick="guardarComida()">Guardar comida</button>
        </div>
        <input type="file" id="camara" accept="image/*" capture="environment" style="display:none" onchange="reconocerComida(event)">
        <div id="foto-estado" style="margin-top:10px"></div>
        <div id="foto-macros"></div>
        <div id="estado-estimacion" style="margin-top:10px"></div>
      </div>
      <div class="card">
        <div class="card-title-row"><h3>Comidas de hoy</h3></div>
        <div class="entry-list">${items}</div>
      </div>
    </div>`;
}

async function guardarComida() {
  if (window._guardando) return;
  const texto = $("#c-texto").value.trim();
  if (!texto) return toast("Escribe qué comiste", true);
  window._guardando = true;
  try {
    const macros = window._macrosPendientes || null;
    const item = {
      id: uid(),
      fecha: todayStr(),
      hora: $("#c-hora").value || horaActual(),
      texto,
      etiqueta: $("#c-etiqueta").value,
      notas: $("#c-notas").value.trim(),
      sync: false,
    };
    if (macros) item.macros = macros;
    await DB.add("comidas", item);
    App.comidas.push(item);
    App.comidas.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
    window._macrosPendientes = null;
    toast("Comida guardada ✓", false, true);
    setPendienteSync();
    renderComida();
    // Estimar macros por texto si no vinieron de la foto (async, no bloquea)
    if (!macros) estimarMacrosTextoYActualizar(item);
  } finally {
    window._guardando = false;
  }
}

async function estimarMacrosTextoYActualizar(item) {
  const est = $("#estado-estimacion");
  if (est) est.innerHTML = '<span style="color:var(--accent)">⏳ estimando macros…</span>';
  try {
    const macros = await estimarMacrosTexto(item.texto);
    if (!macros) {
      if (est) est.innerHTML = '<span style="color:var(--warn)">No se pudieron estimar macros (intenta describir mejor la comida).</span>';
      return;
    }
    item.macros = macros;
    await DB.add("comidas", item);
    const i = App.comidas.findIndex((c) => c.id === item.id);
    if (i >= 0) App.comidas[i].macros = macros;
    if (est) est.innerHTML = `<span style="color:var(--accent)">✓ Macros estimados: ${esc(macrosBadge(macros))}</span>`;
    toast("Macros estimados ✓", false, true);
    setPendienteSync();
    render();
  } catch (err) {
    const sinClave = /falta clave/.test(err.message || "");
    if (est) {
      est.innerHTML = sinClave
        ? '<span style="color:var(--warn)">Comida guardada sin macros — <b>configura tu clave de Gemini</b> en Ajustes y luego toca "Estimar macros faltantes".</span>'
        : `<span style="color:var(--danger)">Error estimando: ${esc(err.message || err)}</span>`;
    }
    if (!sinClave) toast("No se pudieron estimar macros", true);
  }
}

/* ================= Reconocimiento de comida (Gemini) ================= */
const GEMINI_MODELS = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
const GEMINI_URL = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

const PROMPT_MACROS =
  'Responde SOLO en JSON válido, sin markdown ni texto extra, con esta estructura exacta: {"alimentos": ["..."], "calorias": 0, "proteinas": 0, "carbs": 0, "grasas": 0}. Las unidades: calorias en kcal, proteinas/carbs/grasas en gramos. Usa números (no strings). Si no puedes estimar, usa 0.';

function macrosBadge(m) {
  const k = m.calorias != null ? `${m.calorias} kcal` : "";
  const p = m.proteinas != null ? `${m.proteinas}g prot` : "";
  const c = m.carbs != null ? `${m.carbs}g carb` : "";
  const g = m.grasas != null ? `${m.grasas}g grasa` : "";
  return [k, p, c, g].filter(Boolean).join(" · ");
}

async function llamarGemini(texto, imagenB64, mimeType) {
  const key = (localStorage.getItem("geminiKey") || "").trim();
  if (!key) throw new Error("falta clave");
  const parts = [{ text: texto }];
  if (imagenB64) parts.push({ inline_data: { mime_type: mimeType || "image/jpeg", data: imagenB64 } });
  const payload = { contents: [{ parts }] };

  let ultimoError = null;
  for (const modelo of GEMINI_MODELS) {
    try {
      const res = await fetch(`${GEMINI_URL(modelo)}?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let detalle = "";
        try {
          const j = await res.json();
          detalle = (j?.error?.message || j?.error?.status || "").toString();
        } catch {}
        // 404/400 por modelo no disponible → probar el siguiente
        if (res.status === 404 || res.status === 400) {
          ultimoError = `Gemini ${res.status}: ${detalle || modelo}`;
          continue;
        }
        throw new Error(`Gemini ${res.status}: ${detalle || "error"}`.slice(0, 200));
      }
      const data = await res.json();
      const textoResp = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
      if (!textoResp && data?.promptFeedback?.blockReason) {
        throw new Error("Contenido bloqueado por la IA (" + data.promptFeedback.blockReason + ")");
      }
      return textoResp;
    } catch (err) {
      if (/bloqueado/.test(err.message || "")) throw err;
      ultimoError = err.message || String(err);
    }
  }
  throw new Error(ultimoError || "No se pudo conectar con Gemini");
}

async function reconocerComida(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const estado = $("#foto-estado");
  const cont = $("#foto-macros");
  if (estado) estado.innerHTML = '<span style="color:var(--accent)">Analizando foto…</span>';
  if (cont) cont.innerHTML = "";

  try {
    const base64 = await fileToBase64(file);
    const text = await llamarGemini("Identifica los alimentos de esta foto y estima las porciones. " + PROMPT_MACROS, base64, file.type);
    const macros = parseMacros(text);

    if (!macros) {
      if (estado) estado.innerHTML = '<span style="color:var(--warn)">No pude leer la respuesta. Intenta otra foto.</span>';
      return;
    }

    window._macrosPendientes = macros;
    if (estado) estado.innerHTML = '<span style="color:var(--accent)">✓ Reconocida</span>';
    if (cont) cont.innerHTML = `<div class="macros-card">${macrosBadge(macros)}</div>`;

    // Autocompletar el texto con los alimentos detectados
    const txt = $("#c-texto");
    if (macros.alimentos && macros.alimentos.length && txt && !txt.value.trim()) {
      txt.value = macros.alimentos.join(", ");
    }
  } catch (err) {
    const sinClave = /falta clave/.test(err.message || "");
    if (estado) estado.innerHTML = sinClave
      ? '<span style="color:var(--warn)">Configura tu clave de Gemini en Ajustes</span>'
      : `<span style="color:var(--danger)">Error: ${esc(err.message || err)}</span>`;
  } finally {
    if (event.target) event.target.value = "";
  }
}

async function estimarMacrosTexto(texto) {
  const text = await llamarGemini("Estima los macronutrientes de esta comida descrita: \"" + texto + "\". " + PROMPT_MACROS);
  return parseMacros(text);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || "";
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function parseMacros(text) {
  if (!text) return null;
  const limpio = text.replace(/```json|```/g, "").trim();
  let obj;
  try {
    obj = JSON.parse(limpio);
  } catch {
    const match = limpio.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      obj = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
  const num = (v) => {
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
    return isNaN(n) ? null : Math.round(n);
  };
  const alimentos = Array.isArray(obj.alimentos) ? obj.alimentos.filter((a) => typeof a === "string") : [];
  return {
    alimentos,
    calorias: num(obj.calorias),
    proteinas: num(obj.proteinas),
    carbs: num(obj.carbs),
    grasas: num(obj.grasas),
  };
}

/* ================= Render: Entrenamiento ================= */
function renderEntreno() {
  const tipos = Object.entries(TIPOS_ENTRENO);
  const cards = tipos
    .map(
      ([k, v]) => `<div class="type-card" id="tc-${k}" onclick="seleccionarTipo('${k}')">
        ${svgWrap(ICONS[v.icon])}<span>${v.label}</span>
      </div>`
    )
    .join("");

  $("#view").innerHTML = `
    <div class="view-section">
      <div class="card">
        <div class="card-title-row"><h3>Nuevo entrenamiento · ${fmtFecha(todayStr())}</h3></div>
        <div class="type-grid">${cards}</div>
        <div id="entreno-form"></div>
      </div>
      <div class="card">
        <div class="card-title-row"><h3>Mis entrenos de hoy</h3></div>
        <div id="hoy-entrenos">${entrenosDeHoyHtml()}</div>
      </div>
    </div>`;
  if (window._tipoSel) seleccionarTipo(window._tipoSel, true);
}

function entrenosDeHoyHtml() {
  const lista = App.entrenosDe(todayStr());
  if (!lista.length) return '<div class="empty">Aún no registras entrenamientos hoy.</div>';
  return `<div class="entry-list">${lista.map(entryEntrenoHtml).join("")}</div>`;
}

function entryEntrenoHtml(e) {
  const t = TIPOS_ENTRENO[e.tipo] || { label: e.tipo, badge: "badge-gym" };
  return `<div class="entry">
    <div class="entry-main">
      <span class="badge ${t.badge}">${esc(t.label)}</span>
      <div class="entry-title">${esc(e.resumen || "—")}</div>
      ${e.notas ? `<div class="entry-meta">${esc(e.notas)}</div>` : ""}
    </div>
    <div class="entry-actions">
      <div class="entry-time">${e.hora || ""}</div>
      <button class="entry-del" onclick="borrarRegistro('entrenos','${e.id}')" title="Borrar" aria-label="Borrar">✕</button>
    </div>
  </div>`;
}

function seleccionarTipo(tipo, silencioso = false) {
  window._tipoSel = tipo;
  document.querySelectorAll(".type-card").forEach((el) => el.classList.remove("selected"));
  const el = document.getElementById("tc-" + tipo);
  if (el) el.classList.add("selected");
  renderFormEntreno(tipo);
}

function renderFormEntreno(tipo) {
  const t = TIPOS_ENTRENO[tipo];
  const cont = $("#entreno-form");
  if (!cont) return;

  let inner = "";
  if (tipo === "gym") {
    inner = `
      <div class="form-group">
        <label>Hora</label>
        <input type="time" id="e-hora" value="${horaActual()}">
      </div>
      <div class="form-group"><label>Ejercicios (nombre · series · reps)</label></div>
      <div class="ex-list" id="ex-list"></div>
      <button class="btn btn-secondary btn-sm" style="margin-bottom:12px" onclick="addEjercicio()">+ Añadir ejercicio</button>
      <div class="form-group"><label>Notas (sensación, etc.)</label><input type="text" id="e-notas" placeholder="opcional"></div>
      <button class="btn" onclick="guardarEntreno()">Guardar entrenamiento</button>`;
  } else if (tipo === "commute") {
    inner = `
      <div class="form-group"><label>Hora</label><input type="time" id="e-hora" value="${horaActual()}"></div>
      <div class="form-group"><label>Trayecto</label></div>
      <div class="toggle" id="e-toggle">
        <button type="button" class="active" data-leg="ida" onclick="toggleCommute(this)">🏠 → 🏢 Ida</button>
        <button type="button" data-leg="vuelta" onclick="toggleCommute(this)">🏢 → 🏠 Vuelta</button>
      </div>
      <div class="form-group" style="margin-top:12px"><label>Distancia aprox. (km, opcional)</label><input type="number" id="e-distancia" step="0.1" inputmode="decimal" placeholder="22"></div>
      <div class="form-group"><label>Notas (sensación, clima, etc.)</label><input type="text" id="e-notas" placeholder="opcional"></div>
      <button class="btn" style="margin-top:6px" onclick="guardarEntreno()">Guardar commuting</button>`;
  } else {
    inner = `
      <div class="form-group"><label>Hora</label><input type="time" id="e-hora" value="${horaActual()}"></div>
      <div class="form-row-3">
        ${t.campos
          .filter((c) => CAMPOS[c])
          .map((c) => `<div class="form-group"><label>${CAMPOS[c].label}</label><input type="${CAMPOS[c].type}" id="e-${c}" step="${CAMPOS[c].step || ""}" inputmode="${CAMPOS[c].inputmode || "text"}" placeholder="${CAMPOS[c].placeholder || ""}"></div>`)
          .join("")}
      </div>
      <div class="form-group"><label>Notas (sensación, clima, etc.)</label><input type="text" id="e-notas" placeholder="opcional"></div>
      <button class="btn" onclick="guardarEntreno()">Guardar entrenamiento</button>`;
  }
  cont.innerHTML = inner;
  if (tipo === "gym") addEjercicio();
}

function addEjercicio() {
  const list = $("#ex-list");
  const div = document.createElement("div");
  div.className = "ex-item";
  div.innerHTML = `
    <input type="text" placeholder="Ejercicio" class="ex-nombre">
    <input type="number" placeholder="Series" class="ex-series" inputmode="numeric">
    <input type="number" placeholder="Reps" class="ex-reps" inputmode="numeric">
    <button class="ex-del" onclick="this.parentElement.remove()">✕</button>`;
  list.appendChild(div);
  list.lastElementChild.querySelector("input").focus();
}

function toggleCommute(btn) {
  btn.classList.toggle("active");
}

async function guardarEntreno() {
  if (window._guardando) return;
  const tipo = window._tipoSel;
  if (!tipo) return toast("Elige el tipo de entrenamiento", true);
  const t = TIPOS_ENTRENO[tipo];
  const hora = $("#e-hora")?.value || horaActual();
  const datos = {};
  let resumen = "";

  if (tipo === "gym") {
    const ejercicios = [];
    document.querySelectorAll(".ex-item").forEach((row) => {
      const nombre = row.querySelector(".ex-nombre").value.trim();
      const series = row.querySelector(".ex-series").value.trim();
      const reps = row.querySelector(".ex-reps").value.trim();
      if (nombre) ejercicios.push({ nombre, series, reps });
    });
    if (!ejercicios.length) return toast("Añade al menos un ejercicio", true);
    datos.ejercicios = ejercicios;
    resumen = `${ejercicios.length} ejercicio${ejercicios.length > 1 ? "s" : ""} · ${ejercicios.map((e) => e.nombre.split(" ")[0]).slice(0, 3).join(", ")}`;
  } else if (tipo === "commute") {
    const legs = Array.from(document.querySelectorAll("#e-toggle button.active")).map((b) => b.dataset.leg);
    if (!legs.length) return toast("Marca al menos ida o vuelta", true);
    datos.ida = legs.includes("ida");
    datos.vuelta = legs.includes("vuelta");
    const dist = $("#e-distancia")?.value.trim();
    if (dist) datos.distancia = dist;
    resumen = (datos.ida ? "Ida" : "") + (datos.ida && datos.vuelta ? " + " : "") + (datos.vuelta ? "Vuelta" : "") + (dist ? ` · ${dist} km` : "");
  } else {
    const orden = { distancia: "km", desnivel: "m d+", tiempo: "min", ritmo: "/km", fc: "" };
    const partes = [];
    for (const c of t.campos) {
      const val = $("#e-" + c)?.value.trim();
      if (val) {
        datos[c] = val;
        partes.push(`${val} ${orden[c] || ""}`.trim());
      }
    }
    resumen = partes.join(" · ");
  }

  window._guardando = true;
  try {
    const item = {
      id: uid(),
      fecha: todayStr(),
      hora,
      tipo,
      datos,
      resumen,
      notas: $("#e-notas")?.value.trim() || "",
      sync: false,
    };

    await DB.add("entrenos", item);
    App.entrenos.push(item);
    App.entrenos.sort((a, b) => (a.fecha + (a.hora || "")).localeCompare(b.fecha + (b.hora || "")));
    toast(`${t.label} guardado ✓`, false, true);
    setPendienteSync();
    window._tipoSel = null;
    renderEntreno();
  } finally {
    window._guardando = false;
  }
}

/* ================= Render: Semana ================= */
function rangoSemanaActual() {
  const hoy = new Date();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  return { lunes, domingo, lunesStr: fmtISO(lunes), domingoStr: fmtISO(domingo) };
}

function renderSemana() {
  const { lunes, lunesStr, domingoStr } = rangoSemanaActual();

  const comidasSem = App.comidas.filter((c) => c.fecha >= lunesStr && c.fecha <= domingoStr);
  const entrenosSem = App.entrenos.filter((e) => e.fecha >= lunesStr && e.fecha <= domingoStr);

  const kmBici = entrenosSem
    .filter((e) => ["bici-cerro", "bici-xco", "bici-electrica", "commute"].includes(e.tipo))
    .reduce((s, e) => s + parseFloat(e.datos?.distancia || 0), 0);
  const minutos = entrenosSem.reduce((s, e) => s + parseFloat(e.datos?.tiempo || 0), 0);
  const desnivel = entrenosSem
    .filter((e) => ["bici-cerro", "bici-xco"].includes(e.tipo))
    .reduce((s, e) => s + parseFloat(e.datos?.desnivel || 0), 0);
  const diasEntreno = new Set(entrenosSem.map((e) => e.fecha)).size;

  const dias = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  const filas = Array.from({ length: 7 }, (_, i) => {
    const fecha = fmtISO(new Date(lunes.getTime() + i * 86400000));
    const en = entrenosSem.filter((e) => e.fecha === fecha);
    const co = comidasSem.filter((c) => c.fecha === fecha);
    const marcadores = en.map((e) => `<span class="badge ${TIPOS_ENTRENO[e.tipo]?.badge || "badge-gym"}" style="margin:2px 2px 0 0">${esc(TIPOS_ENTRENO[e.tipo]?.label || e.tipo)}</span>`).join("");
    const coBadge = co.length ? `<span class="badge" style="background:rgba(34,197,94,0.15);color:#4ade80;margin:2px 2px 0 0">${co.length} comida${co.length > 1 ? "s" : ""}</span>` : "";
    return `<div class="entry">
      <div class="entry-main">
        <div class="entry-title" style="text-transform:capitalize">${dias[i]} <span style="color:var(--text-dim);font-weight:400;font-size:0.75rem">${fmtFecha(fecha)}</span></div>
        <div>${marcadores}${coBadge}</div>
      </div>
    </div>`;
  }).join("");

  $("#view").innerHTML = `
    <div class="view-section">
      <div class="stats-grid">
        <div class="stat"><div class="num">${entrenosSem.length}</div><div class="lbl">Entrenos</div></div>
        <div class="stat"><div class="num">${kmBici.toFixed(1)}</div><div class="lbl">Km bici</div></div>
        <div class="stat"><div class="num">${Math.round(minutos)}</div><div class="lbl">Min</div></div>
      </div>
      <div class="stats-grid">
        <div class="stat"><div class="num">${desnivel.toFixed(0)}</div><div class="lbl">m d+ bici</div></div>
        <div class="stat"><div class="num">${diasEntreno}</div><div class="lbl">Días</div></div>
        <div class="stat"><div class="num">${comidasSem.length}</div><div class="lbl">Comidas</div></div>
      </div>
      <div class="card">
        <div class="card-title-row"><h3>Semana del ${fmtFecha(lunesStr)} al ${fmtFecha(domingoStr)}</h3></div>
        <div class="entry-list">${filas}</div>
      </div>
    </div>`;
}

/* ================= Render: Ajustes ================= */
function renderAjustes() {
  const serverIp = localStorage.getItem("serverIp") || "";
  const metas = metasDiarias();
  const estado = estadoSync === "pending"
    ? '<span style="color:var(--warn)">● hay datos sin sincronizar</span>'
    : estadoSync === "error"
      ? '<span style="color:var(--danger)">● sincronización falló</span>'
      : '<span style="color:var(--accent)">● sincronizado</span>';

  $("#view").innerHTML = `
    <div class="view-section">
      <div class="card">
        <h3>Servidor (PC)</h3>
        <div class="form-group">
          <label>IP del servidor (ej. 192.168.1.10)</label>
          <div class="form-row">
            <input type="text" id="server-ip" value="${esc(serverIp)}" placeholder="IP del PC">
            <button class="btn btn-sm" onclick="guardarIp()" style="height:auto">Guardar</button>
          </div>
        </div>
        <div class="ajuste-row"><div><div class="aj-lbl">Estado</div><div class="aj-desc">${estado}</div></div></div>
        <button class="btn" onclick="syncAhora()">Sincronizar ahora</button>
      </div>
      <div class="card">
        <h3>Reconocimiento de comida (Gemini)</h3>
        <div class="form-group">
          <label>Clave API de Gemini</label>
          <div class="form-row">
            <input type="password" id="gemini-key" value="${esc(localStorage.getItem("geminiKey") || "")}" placeholder="pega tu clave aquí" autocomplete="off">
            <button class="btn btn-sm" onclick="guardarGeminiKey()" style="height:auto">Guardar</button>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="probarClave()" style="margin-bottom:10px">🔌 Probar clave</button>
        <div id="prueba-clave"></div>
        <div class="ajuste-row"><div><div class="aj-lbl">Cómo obtenerla</div><div class="aj-desc">Toca el enlace → <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;font-weight:600">Crear API key de Gemini (gratis)</a>. Se guarda solo en tu dispositivo.</div></div></div>
      </div>
      <div class="card">
        <h3>Metas diarias (para el progreso)</h3>
        <div class="form-row-3">
          <div class="form-group"><label>Calorías (kcal)</label><input type="number" id="m-calorias" value="${metas.calorias}" inputmode="numeric"></div>
          <div class="form-group"><label>Proteína (g)</label><input type="number" id="m-proteinas" value="${metas.proteinas}" inputmode="numeric"></div>
          <div class="form-group"><label>Carbs (g)</label><input type="number" id="m-carbs" value="${metas.carbs}" inputmode="numeric"></div>
        </div>
        <div class="form-group"><label>Grasas (g)</label><input type="number" id="m-grasas" value="${metas.grasas}" inputmode="numeric"></div>
        <button class="btn btn-secondary" onclick="guardarMetas()">Guardar metas</button>
      </div>
      <div class="card">
        <h3>Datos</h3>
        <div class="ajuste-row">
          <div><div class="aj-lbl">Registros</div><div class="aj-desc" id="aj-counts">calculando…</div></div>
        </div>
        <div class="btn-group">
          <button class="btn btn-secondary" onclick="exportarSemana()">Exportar semana</button>
          <button class="btn btn-secondary" onclick="exportarDatos()">Exportar todo</button>
        </div>
        <div class="btn-group" style="margin-top:10px">
          <button class="btn btn-secondary" onclick="document.getElementById('importar-file').click()">⬆️ Importar (JSON · CSV · GPX · FIT)</button>
        </div>
        <input type="file" id="importar-file" accept=".json,.csv,.gpx,.fit,application/json,text/csv,application/gpx+xml" style="display:none" onchange="importarArchivo(event)">
        <div id="importar-estado" style="margin-top:8px"></div>
      </div>
      <div class="card">
        <h3>Zona de riesgo</h3>
        <div class="ajuste-row">
          <div><div class="aj-lbl">Borrar todo</div><div class="aj-desc">Elimina comidas y entrenos del dispositivo</div></div>
        </div>
        <button class="btn btn-danger" onclick="borrarTodo()">Borrar todos los datos</button>
      </div>
      <div class="card">
        <h3>Acerca de</h3>
        <div class="ajuste-row">
          <div><div class="aj-lbl">Versión</div><div class="aj-desc" id="aj-version">v${APP_VERSION}</div></div>
          <button class="btn btn-sm btn-secondary" onclick="buscarActualizacion()">Buscar actualización</button>
        </div>
        <div class="ajuste-row">
          <div><div class="aj-lbl">Nueva versión</div><div class="aj-desc" id="aj-update">al día ✓</div></div>
        </div>
      </div>
    </div>`;

  DB.counts().then(({ comidas, entrenos }) => {
    const el = $("#aj-counts");
    if (el) el.textContent = `${comidas} comidas · ${entrenos} entrenos`;
  });
}

function guardarIp() {
  localStorage.setItem("serverIp", $("#server-ip").value.trim());
  toast("IP guardada ✓", false, true);
}

function guardarGeminiKey() {
  const v = $("#gemini-key").value.trim();
  localStorage.setItem("geminiKey", v);
  toast(v ? "Clave de Gemini guardada ✓" : "Clave de Gemini borrada", false, true);
}

async function probarClave() {
  const cont = $("#prueba-clave");
  const key = (localStorage.getItem("geminiKey") || "").trim();
  if (!key) {
    if (cont) cont.innerHTML = '<span style="color:var(--danger)">Primero guarda una clave.</span>';
    return;
  }
  if (cont) cont.innerHTML = '<span style="color:var(--text-dim)">Probando…</span>';
  try {
    const textoResp = await llamarGemini('Responde solo con la palabra OK. ' + PROMPT_MACROS);
    if (cont) cont.innerHTML = `<span style="color:var(--accent)">✓ Clave válida — Gemini respondió: ${esc(textoResp.slice(0, 60))}</span>`;
    toast("Clave válida ✓", false, true);
  } catch (err) {
    const mensaje = err.message || String(err);
    if (cont) cont.innerHTML = `<span style="color:var(--danger)">✗ ${esc(mensaje)}</span>`;
    toast("Clave no válida", true);
  }
}

function guardarMetas() {
  const metas = {
    calorias: Number($("#m-calorias").value) || METAS_DEFAULT.calorias,
    proteinas: Number($("#m-proteinas").value) || METAS_DEFAULT.proteinas,
    carbs: Number($("#m-carbs").value) || METAS_DEFAULT.carbs,
    grasas: Number($("#m-grasas").value) || METAS_DEFAULT.grasas,
  };
  localStorage.setItem("metas", JSON.stringify(metas));
  toast("Metas guardadas ✓", false, true);
  render();
}

async function buscarActualizacion() {
  if (!("serviceWorker" in navigator)) return toast("Sin soporte de SW", true);
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return toast("Sin service worker registrado", true);
  toast("Buscando actualización…", false, true);
  reg.update()
    .then(() => {
      if (reg.waiting) {
        const el = $("#aj-update");
        if (el) el.innerHTML = '<span style="color:var(--accent)">nueva versión lista — recarga la app</span>';
        toast("Nueva versión lista ✓", false, true);
      }
    })
    .catch(() => toast("No se pudo buscar actualización", true));
}

async function exportarDatos() {
  descargarJSON("mi-entrenamiento-export.json", { comidas: App.comidas, entrenos: App.entrenos });
  toast("Exportado ✓", false, true);
}

function exportarSemana() {
  const { lunesStr, domingoStr } = rangoSemanaActual();
  const comidas = App.comidas.filter((c) => c.fecha >= lunesStr && c.fecha <= domingoStr);
  const entrenos = App.entrenos.filter((e) => e.fecha >= lunesStr && e.fecha <= domingoStr);
  const nombre = `mi-entrenamiento-semana-${lunesStr}.json`;
  descargarJSON(nombre, {
    semana: { inicio: lunesStr, fin: domingoStr },
    comidas,
    entrenos,
  });
  toast(`Semana ${fmtFecha(lunesStr)} exportada ✓`, false, true);
}

function descargarJSON(nombre, datos) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  a.remove();
}

/* ================= Importación de archivos ================= */
function leerArchivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function leerArchivoBinario(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

async function importarArchivo(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  const nombre = (file.name || "").toLowerCase();
  try {
    if (nombre.endsWith(".json")) return await importarJson(event);
    if (nombre.endsWith(".csv")) return await importarGarminCSV(event);
    if (nombre.endsWith(".gpx")) return await importarGPX(event);
    if (nombre.endsWith(".fit")) return await importarFIT(event);
    toast("Formato no soportado (usa JSON, CSV, GPX o FIT)", true);
  } catch (err) {
    toast("Error al importar: " + (err.message || err), true);
  } finally {
    if (event.target) event.target.value = "";
  }
}

async function importarJson(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  const estado = $("#importar-estado");
  const limpiar = () => { if (event.target) event.target.value = ""; };

  try {
    const contenido = await leerArchivo(file);
    const datos = JSON.parse(contenido);

    // Acepta el formato de exportarSemana (con "semana") y exportarDatos ({comidas, entrenos})
    let comidas = Array.isArray(datos.comidas) ? datos.comidas : [];
    let entrenos = Array.isArray(datos.entrenos) ? datos.entrenos : [];
    if (datos.semana && Array.isArray(datos.comidas)) comidas = datos.comidas;

    if (!comidas.length && !entrenos.length) {
      if (estado) estado.innerHTML = '<span style="color:var(--danger)">El archivo no tiene comidas ni entrenos.</span>';
      return limpiar();
    }

    const modo = window._confirmOverride
      ? window._confirmOverride()
      : confirm(`El archivo tiene ${comidas.length} comidas y ${entrenos.length} entrenos. ¿Reemplazar todo? (Cancelar = añadir sin borrar)`);

    if (modo) {
      // Reemplazar
      await DB.clear("comidas");
      await DB.clear("entrenos");
      await Promise.all([
        comidas.length ? DB.putAll("comidas", comidas) : Promise.resolve(),
        entrenos.length ? DB.putAll("entrenos", entrenos) : Promise.resolve(),
      ]);
    } else {
      // Fusionar por id (no duplica; el existente gana)
      const existentes = await DB.getAll("comidas");
      const idsExistentes = new Set(existentes.map((c) => c.id));
      const nuevasComidas = comidas.filter((c) => !idsExistentes.has(c.id));
      const existentesE = await DB.getAll("entrenos");
      const idsExistentesE = new Set(existentesE.map((e) => e.id));
      const nuevosEntrenos = entrenos.filter((e) => !idsExistentesE.has(e.id));
      await Promise.all([
        nuevasComidas.length ? DB.putAll("comidas", nuevasComidas) : Promise.resolve(),
        nuevosEntrenos.length ? DB.putAll("entrenos", nuevosEntrenos) : Promise.resolve(),
      ]);
      if (estado) estado.innerHTML = `<span style="color:var(--accent)">✓ Añadidas ${nuevasComidas.length} comidas y ${nuevosEntrenos.length} entrenos nuevos.</span>`;
    }

    await App.loadAll();
    setPendienteSync();
    toast(modo ? "Datos reemplazados ✓" : "Datos añadidos ✓", false, true);
    render();
  } catch (err) {
    if (estado) estado.innerHTML = `<span style="color:var(--danger)">Error: ${esc(err.message || err)} — ¿es un JSON válido exportado por la app?</span>`;
  } finally {
    limpiar();
  }
}

/* ================= Parser CSV de Garmin Connect ================= */
function parseCSV(texto) {
  const filas = [];
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
  for (const linea of lineas) {
    const fila = [];
    let campo = "";
    let entreComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const ch = linea[i];
      if (ch === '"') {
        if (entreComillas && linea[i + 1] === '"') { campo += '"'; i++; }
        else entreComillas = !entreComillas;
      } else if (ch === "," && !entreComillas) {
        fila.push(campo.trim()); campo = "";
      } else {
        campo += ch;
      }
    }
    fila.push(campo.trim());
    filas.push(fila);
  }
  return filas;
}

const TIPO_GARMIN = {
  ride: "bici-cerro", cycling: "bici-cerro", bike: "bici-cerro", mountain: "bici-cerro", mtb: "bici-cerro",
  running: "trote", run: "trote", trail: "trote", track: "trote",
  walking: "trote", hike: "trote", hiking: "trote",
};

function mapTipoGarmin(t) {
  const s = String(t || "").toLowerCase();
  return TIPO_GARMIN[s] || "bici-cerro";
}

async function importarGarminCSV(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  const estado = $("#importar-estado");
  try {
    const contenido = await leerArchivo(file);
    const filas = parseCSV(contenido);
    if (filas.length < 2) throw new Error("CSV sin datos");
    const headers = filas[0].map((h) => h.toLowerCase());
    const idx = (nombre) => headers.findIndex((h) => h.includes(nombre));
    const iTipo = idx("activity_type") >= 0 ? idx("activity_type") : idx("type");
    const iFecha = idx("activity date") >= 0 ? idx("activity date") : idx("start time");
    const iDist = idx("distance");
    const iDur = idx("duration") >= 0 ? idx("duration") : idx("time");
    const iHr = idx("avg hr");
    const iHrMax = idx("max hr");
    const iElev = idx("total elevation gain");
    const iNombre = idx("activity name");

    let nuevos = 0;
    for (const fila of filas.slice(1)) {
      const tipo = iTipo >= 0 ? mapTipoGarmin(fila[iTipo]) : "bici-cerro";
      let fecha = iFecha >= 0 ? fila[iFecha] : "";
      const hora = iFecha >= 0 && fecha.includes(" ") ? fecha.split(" ")[1] || "" : "";
      fecha = (fecha.split(" ")[0] || "").split("T")[0];
      if (!fecha) continue;

      const datos = {};
      if (iDist >= 0) datos.distancia = String(parseFloat(fila[iDist]) || 0).replace(/\.?0+$/, "");
      if (iElev >= 0) datos.desnivel = String(parseFloat(fila[iElev]) || 0).replace(/\.?0+$/, "");
      const durSeg = parsearDuracion(fila[iDur]);
      if (durSeg > 0) datos.tiempo = String(Math.round(durSeg / 60));
      const hr = iHr >= 0 ? parseFloat(fila[iHr]) : NaN;
      const hrMax = iHrMax >= 0 ? parseFloat(fila[iHrMax]) : NaN;
      if (!isNaN(hr)) datos.fc = hrMax && !isNaN(hrMax) ? `${Math.round(hr)} / ${Math.round(hrMax)}` : String(Math.round(hr));

      const resumen = iNombre >= 0 && fila[iNombre] ? fila[iNombre] : "Importado de Garmin";
      const item = { id: uid(), fecha, hora, tipo, datos, resumen, notas: "Importado desde Garmin Connect", sync: false };
      await DB.add("entrenos", item);
      App.entrenos.push(item);
      nuevos++;
    }
    App.entrenos.sort((a, b) => (a.fecha + (a.hora || "")).localeCompare(b.fecha + (b.hora || "")));
    setPendienteSync();
    if (estado) estado.innerHTML = `<span style="color:var(--accent)">✓ Importados ${nuevos} entrenos de Garmin.</span>`;
    toast(`${nuevos} entrenos importados ✓`, false, true);
    render();
  } catch (err) {
    if (estado) estado.innerHTML = `<span style="color:var(--danger)">Error CSV: ${esc(err.message || err)}</span>`;
  }
}

function parsearDuracion(v) {
  const s = String(v || "").trim();
  if (!s) return 0;
  const partes = s.split(":").map(Number);
  if (partes.length === 3 && !partes.some(isNaN)) return partes[0] * 3600 + partes[1] * 60 + partes[2];
  if (partes.length === 2 && !partes.some(isNaN)) return partes[0] * 60 + partes[1];
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/* ================= Parser GPX ================= */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function parseGPXTexto(texto) {
  const doc = new DOMParser().parseFromString(texto, "application/xml");
  const trks = Array.from(doc.getElementsByTagName("trk"));
  const ruta = trks.length ? trks[0] : doc;

  // ---- Datos del track ----
  const nombre = ruta.getElementsByTagName("name")[0]?.textContent || "";
  let tipoGPX = "";
  const tipoTag = ruta.getElementsByTagName("type")[0]?.textContent;
  if (tipoTag) tipoGPX = tipoTag;

  const pts = Array.from(ruta.getElementsByTagName("trkpt"));
  if (!pts.length) throw new Error("GPX sin puntos (trkpt)");

  let distancia = 0;
  let elevGanancia = 0;
  let elevPerdida = 0;
  let prev = null;
  let prevElev = null;

  // Calorias (Garmin pone en <extensions><calories> por punto o en el summary)
  let totalCalorias = 0;
  const calEl = ruta.getElementsByTagName("calories");
  if (calEl.length) {
    // Algunos GPX tienen un campo <calories> en <extensions> del track
    totalCalorias = parseInt(calEl[0]?.textContent) || 0;
  }

  // FC: maxHR, avgHR en extensions
  let maxHR = 0;
  let avgHR = 0;
  const xhr = ruta.getElementsByTagName("MaxHR");
  if (xhr.length) maxHR = parseInt(xhr[0]?.textContent) || 0;
  const ayhr = ruta.getElementsByTagName("AvgHR");
  if (ayhr.length) avgHR = parseInt(ayhr[0]?.textContent) || 0;

  for (const p of pts) {
    const lat = parseFloat(p.getAttribute("lat"));
    const lon = parseFloat(p.getAttribute("lon"));
    if (isNaN(lat) || isNaN(lon)) continue;
    if (prev) distancia += haversine(prev.lat, prev.lon, lat, lon);
    const elev = parseFloat(p.getElementsByTagName("ele")[0]?.textContent);
    if (!isNaN(elev)) {
      if (prevElev != null) {
        const d = elev - prevElev;
        if (d > 0) elevGanancia += d;
        else elevPerdida += Math.abs(d);
      }
      prevElev = elev;
    }
    prev = { lat, lon };
  }

  const t0 = pts[0]?.getElementsByTagName("time")[0]?.textContent;
  const t1 = pts[pts.length - 1]?.getElementsByTagName("time")[0]?.textContent;
  let duracionMin = 0;
  if (t0 && t1) duracionMin = Math.round((new Date(t1) - new Date(t0)) / 60000);

  return {
    distanciaKm: Math.round(distancia * 10) / 10,
    desnivel: Math.round(elevGanancia),
    desnivelBajada: Math.round(elevPerdida),
    duracionMin: Math.max(0, duracionMin),
    calorias: totalCalorias,
    fcMax: maxHR,
    fcPromedio: avgHR,
    nombre,
    tipoGPX,
  };
}

async function importarGPX(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  const estado = $("#importar-estado");
  try {
    const contenido = await leerArchivo(file);
    const g = parseGPXTexto(contenido);
    if (!g.distanciaKm && !g.desnivel && !g.duracionMin) throw new Error("GPX vacío o inválido");

    const partes = [
      g.distanciaKm ? `${g.distanciaKm} km` : "",
      g.duracionMin ? `${g.duracionMin} min` : "",
      g.desnivel ? `${g.desnivel} m d+` : "",
      g.fcPromedio ? `FC ${g.fcPromedio}${g.fcMax ? "/" + g.fcMax : ""}` : "",
      g.calorias ? `${g.calorias} kcal` : "",
    ].filter(Boolean);

    let tipo = "bici-cerro";
    if (g.tipoGPX) {
      const tg = g.tipoGPX.toLowerCase();
      if (tg.includes("running") || tg.includes("run") || tg.includes("trail") || tg.includes("hik")) tipo = "trote";
    }
    // Si no hay tipo del GPX, preguntar
    if (tipo === "bici-cerro") {
      const esBici = window._confirmOverride
        ? window._confirmOverride()
        : confirm(`GPX: ${partes.join(" · ")}. ¿Importar como BICI? (Cancelar = como TROTE)`);
      tipo = esBici ? "bici-cerro" : "trote";
    } else {
      const confirmTipo = window._confirmOverride
        ? window._confirmOverride()
        : confirm(`GPX detectado como "${tipo}" (${partes.join(" · ")}). ¿Confirmar? (Cancelar = TROTE)`);
      if (!confirmTipo) tipo = "trote";
    }

    const hoy = todayStr();
    const datos = { distancia: String(g.distanciaKm), tiempo: String(g.duracionMin || ""), desnivel: String(g.desnivel || "") };
    if (g.fcPromedio) datos.fc = g.fcMax ? `${g.fcPromedio} / ${g.fcMax}` : String(g.fcPromedio);
    if (g.calorias) datos.calorias = String(g.calorias);

    const item = {
      id: uid(),
      fecha: hoy,
      hora: "",
      tipo,
      datos,
      resumen: (g.nombre || partes.join(" · ")).slice(0, 80),
      notas: "Importado de GPX",
      sync: false,
    };
    await DB.add("entrenos", item);
    App.entrenos.push(item);
    setPendienteSync();
    if (estado) estado.innerHTML = `<span style="color:var(--accent)">✓ GPX importado: ${item.resumen}</span>`;
    toast("GPX importado ✓", false, true);
    render();
  } catch (err) {
    if (estado) estado.innerHTML = `<span style="color:var(--danger)">Error GPX: ${esc(err.message || err)}</span>`;
  }
}

/* ================= Parser FIT (binario) ================= */
const FIT_BASE = {
  0x00: 1, 0x01: 1, 0x02: 1, 0x83: 2, 0x84: 2, 0x85: 4, 0x86: 4,
  0x88: 4, 0x89: 8, 0x8a: 1, 0x8b: 2, 0x8c: 4, 0x8d: 1,
};
const FIT_INVALIDOS = { 0x00: 0xff, 0x01: 0x7f, 0x02: 0xff, 0x83: 0x7fff, 0x84: 0xffff, 0x85: 0x7fffffff, 0x86: 0xffffffff, 0x88: 0xffffffff, 0x89: NaN, 0x8a: 0xff, 0x8b: 0xffff, 0x8c: 0xffffffff, 0x8d: 0xff };

function parseFITBytes(buf) {
  const dv = new DataView(buf);
  const headerSize = dv.getUint8(0);
  const dataSize = dv.getUint32(4, true);
  const definiciones = {}; // local mesg num -> { mesg, campos: [{num,size,base}] }

  let offset = headerSize;
  const end = headerSize + dataSize;
  const lecturas = { distancia: 0, alturas: [], hr: [], tiempos: [] };

  const leerCampo = (base, size) => {
    const invalido = FIT_INVALIDOS[base];
    const valorInvalido = (v) => invalido !== undefined && v === invalido;
    if (base === 0x86 || base === 0x8c) { const v = dv.getUint32(offset, true); offset += size; return valorInvalido(v) ? null : v; }
    if (base === 0x85) { const v = dv.getInt32(offset, true); offset += size; return valorInvalido(v) ? null : v; }
    if (base === 0x84 || base === 0x8b) { const v = dv.getUint16(offset, true); offset += size; return valorInvalido(v) ? null : v; }
    if (base === 0x83) { const v = dv.getInt16(offset, true); offset += size; return valorInvalido(v) ? null : v; }
    if (base === 0x02 || base === 0x8a) { const v = dv.getUint8(offset); offset += size; return valorInvalido(v) ? null : v; }
    if (base === 0x01) { const v = dv.getInt8(offset); offset += size; return valorInvalido(v) ? null : v; }
    if (base === 0x88) { const v = dv.getFloat32(offset, true); offset += size; return valorInvalido(v) ? null : v; }
    if (base === 0x89) { const v = dv.getFloat64(offset, true); offset += size; return valorInvalido(v) ? null : v; }
    offset += size;
    return null;
  };

  while (offset < end && offset < buf.byteLength - 1) {
    const h = dv.getUint8(offset); offset += 1;
    const isDef = (h & 0x40) !== 0;
    const isComp = (h & 0x80) !== 0;
    const localNum = isComp ? (h >> 5) & 0x03 : h & 0x0f;
    if (isDef) {
      const reserved = dv.getUint8(offset); offset += 1;
      const arch = dv.getUint8(offset); offset += 1;
      const mesg = arch === 1 ? dv.getUint16(offset, false) : dv.getUint16(offset, true);
      offset += 2;
      const nCampos = dv.getUint8(offset); offset += 1;
      const campos = [];
      for (let i = 0; i < nCampos; i++) {
        const num = dv.getUint8(offset); offset += 1;
        const size = dv.getUint8(offset); offset += 1;
        const base = dv.getUint8(offset); offset += 1;
        campos.push({ num, size, base });
      }
      definiciones[localNum] = { mesg, campos };
    } else {
      const def = definiciones[localNum];
      if (!def) continue;
      const { mesg, campos } = def;
      const vals = {};
      for (const c of campos) {
        const v = leerCampo(c.base, c.size);
        if (v != null) vals[c.num] = v;
      }
      if (mesg === 20) {
        if (vals[5] != null) lecturas.distancia = vals[5];
        if (vals[6] != null) lecturas.alturas.push(vals[6]);
        if (vals[3] != null) lecturas.hr.push(vals[3]);
        if (vals[253] != null) lecturas.tiempos.push(vals[253]);
      }
    }
  }

  let desnivel = 0;
  for (let i = 1; i < lecturas.alturas.length; i++) {
    const d = lecturas.alturas[i] - lecturas.alturas[i - 1];
    if (d > 0) desnivel += d;
  }
  const hrMedia = lecturas.hr.length ? Math.round(lecturas.hr.reduce((a, b) => a + b, 0) / lecturas.hr.length) : null;
  const hrMax = lecturas.hr.length ? Math.max(...lecturas.hr) : null;
  const duracionSeg = lecturas.tiempos.length >= 2 ? lecturas.tiempos[lecturas.tiempos.length - 1] - lecturas.tiempos[0] : 0;

  return {
    distanciaKm: Math.round(lecturas.distancia / 1000 * 10) / 10,
    desnivel: Math.round(desnivel),
    duracionMin: Math.max(0, Math.round(duracionSeg / 60)),
    hrMedia, hrMax,
  };
}

async function importarFIT(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  const estado = $("#importar-estado");
  try {
    const buffer = await leerArchivoBinario(file);
    const f = parseFITBytes(buffer);
    if (!f.distanciaKm && !f.desnivel && !f.duracionMin) throw new Error("FIT vacío o no soportado");
    const partes = [
      f.distanciaKm ? `${f.distanciaKm} km` : "",
      f.duracionMin ? `${f.duracionMin} min` : "",
      f.desnivel ? `${f.desnivel} m d+` : "",
      f.hrMedia ? `FC ${f.hrMedia}/${f.hrMax}` : "",
    ].filter(Boolean);
    const tipo = window._confirmOverride
      ? window._confirmOverride()
      : confirm(`FIT: ${partes.join(" · ")}. ¿Importar como BICI? (Cancelar = como TROTE)`);

    const hoy = todayStr();
    const item = {
      id: uid(),
      fecha: hoy,
      hora: "",
      tipo: tipo ? "bici-cerro" : "trote",
      datos: { distancia: String(f.distanciaKm), tiempo: String(f.duracionMin || ""), desnivel: String(f.desnivel || "") },
      resumen: partes.join(" · "),
      notas: "Importado de FIT",
      sync: false,
    };
    if (f.hrMedia && f.hrMax) item.datos.fc = `${f.hrMedia} / ${f.hrMax}`;
    await DB.add("entrenos", item);
    App.entrenos.push(item);
    setPendienteSync();
    if (estado) estado.innerHTML = `<span style="color:var(--accent)">✓ FIT importado: ${partes.join(" · ")}</span>`;
    toast("FIT importado ✓", false, true);
    render();
  } catch (err) {
    if (estado) estado.innerHTML = `<span style="color:var(--danger)">Error FIT: ${esc(err.message || err)}</span>`;
  }
}

async function borrarTodo() {
  if (!confirm("¿Seguro? Se borrará TODO del dispositivo. (Los datos del PC sobreviven a la siguiente sync.)")) return;
  await DB.clear("comidas");
  await DB.clear("entrenos");
  App.comidas = [];
  App.entrenos = [];
  toast("Datos borrados", false, true);
  setPendienteSync();
  render();
}

/* ================= Borrado de registros ================= */
async function borrarRegistro(store, id) {
  const ok = window._confirmOverride ? window._confirmOverride() : confirm("¿Borrar este registro?");
  if (!ok) return;
  await DB.remove(store, id);
  App[store] = App[store].filter((r) => r.id !== id);
  toast("Registro borrado", false, true);
  setPendienteSync();
  render();
}

/* ================= Sincronización ================= */
function setPendienteSync() {
  estadoSync = "pending";
  actualizarDot();
}

function actualizarDot() {
  const dot = $("#sync-dot");
  if (!dot) return;
  dot.className = "sync-dot " + estadoSync;
}

async function syncAhora() {
  const serverIp = (localStorage.getItem("serverIp") || "").trim();
  if (!serverIp) return toast("Configura la IP del servidor en Ajustes", true);

  const btn = $("#btn-sync");
  btn.classList.add("spinning");
  estadoSync = "pending";
  actualizarDot();

  try {
    const url = `http://${serverIp}:8787/sync`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comidas: App.comidas,
        entrenos: App.entrenos,
      }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    // El servidor devuelve los datos consolidados → los guardamos de vuelta
    if (data.comidas) {
      await DB.putAll("comidas", data.comidas);
      App.comidas = data.comidas;
    }
    if (data.entrenos) {
      await DB.putAll("entrenos", data.entrenos);
      App.entrenos = data.entrenos;
    }

    estadoSync = "ok";
    toast("Sincronizado ✓", false, true);
  } catch (err) {
    estadoSync = "error";
    toast("No se pudo sincronizar: " + err.message, true);
  } finally {
    btn.classList.remove("spinning");
    actualizarDot();
    render();
  }
}

/* ================= Utilidades ================= */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function horaActual() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtFecha(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

let toastTimer = null;
function toast(msg, error = false, ok = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast show " + (error ? "error" : ok ? "ok" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = "toast"), 2600);
}

/* ================= Helpers globales para onclick ================= */
window.switchView = switchView;
window.goComida = () => switchView("comida");
window.goEntreno = () => switchView("entreno");
window.seleccionarTipo = seleccionarTipo;
window.addEjercicio = addEjercicio;
window.toggleCommute = toggleCommute;
window.guardarComida = guardarComida;
window.guardarEntreno = guardarEntreno;
window.borrarRegistro = borrarRegistro;
window.reconocerComida = reconocerComida;
window.parseMacros = parseMacros;
window.syncAhora = syncAhora;
window.guardarIp = guardarIp;
window.guardarGeminiKey = guardarGeminiKey;
window.probarClave = probarClave;
window.guardarMetas = guardarMetas;
window.metasDiarias = metasDiarias;
window.progresoDia = progresoDia;
window.tieneClaveGemini = tieneClaveGemini;
window.estimarFaltantes = estimarFaltantes;
window.buscarActualizacion = buscarActualizacion;
window.exportarDatos = exportarDatos;
window.exportarSemana = exportarSemana;
window.importarArchivo = importarArchivo;
window.importarJson = importarJson;
window.importarGarminCSV = importarGarminCSV;
window.importarGPX = importarGPX;
window.importarFIT = importarFIT;
window.parseGPXTexto = parseGPXTexto;
window.parseFITBytes = parseFITBytes;
window.borrarTodo = borrarTodo;

/* ================= Main ================= */
async function render() {
  switch (currentView) {
    case "hoy": renderHoy(); break;
    case "comida": renderComida(); break;
    case "entreno": renderEntreno(); break;
    case "semana": renderSemana(); break;
    case "ajustes": renderAjustes(); break;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const sub = document.getElementById("header-sub");
  if (sub) sub.textContent = "v" + APP_VERSION;

  document.querySelectorAll(".tab-btn").forEach((b) =>
    b.addEventListener("click", () => switchView(b.dataset.view))
  );
  $("#btn-sync").addEventListener("click", syncAhora);
  await App.loadAll();
  actualizarDot();

  // Detección de red para auto-sync
  window.addEventListener("online", () => {
    if (localStorage.getItem("serverIp")) syncAhora();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      // Detectar nueva versión del SW → avisar y recargar automáticamente
      let actualizacionAplicada = false;
      reg.addEventListener("updatefound", () => {
        const nuevo = reg.installing;
        if (!nuevo) return;
        nuevo.addEventListener("statechange", () => {
          if (nuevo.state === "installed" && navigator.serviceWorker.controller) {
            const el = $("#aj-update");
            if (el) el.innerHTML = '<span style="color:var(--warn)">⚠️ nueva versión disponible — actualizando…</span>';
            toast("Nueva versión disponible ✓", false, true);
            nuevo.postMessage({ type: "SKIP_WAITING" });
            actualizacionAplicada = true;
          }
        });
      });
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (actualizacionAplicada) {
          actualizacionAplicada = false;
          toast("Actualizado ✓", false, true);
          setTimeout(() => location.reload(), 600);
        }
      });
    }).catch(() => {});
  }

  render();
});
