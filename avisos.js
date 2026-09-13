// ============================================================
// avisos.js — modal de aviso/confirmación a tono con el sitio,
// para reemplazar los alert()/confirm() nativos del navegador.
//
// Uso:
//   import { alertaBonita, confirmarBonito } from "./avisos.js";
//
//   await alertaBonita("No se pudo guardar el cambio.", { tipo: "error" });
//
//   const ok = await confirmarBonito("¿Eliminar este producto?", {
//     tipo: "peligro",
//     textoConfirmar: "Eliminar",
//   });
//   if (!ok) return;
// ============================================================

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// Un ícono por tipo, mismo lenguaje visual (stroke redondeado) que el
// resto de los íconos del sitio (ver sidebar en central.html/sucursal.html).
const ICONOS = {
  info: '<circle cx="12" cy="12" r="9"></circle><line x1="12" y1="10.5" x2="12" y2="16"></line><circle cx="12" cy="7.5" r="0.5" fill="currentColor" stroke="none"></circle>',
  exito: '<circle cx="12" cy="12" r="9"></circle><polyline points="8 12.5 10.8 15.3 16 9.3"></polyline>',
  advertencia: '<path d="M12 3.5 21.5 20h-19L12 3.5z"></path><line x1="12" y1="10" x2="12" y2="14.5"></line><circle cx="12" cy="17.3" r="0.5" fill="currentColor" stroke="none"></circle>',
  peligro: '<circle cx="12" cy="12" r="9"></circle><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"></line><line x1="15.5" y1="8.5" x2="8.5" y2="15.5"></line>',
  error: '<circle cx="12" cy="12" r="9"></circle><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"></line><line x1="15.5" y1="8.5" x2="8.5" y2="15.5"></line>',
};

let overlayEl = null;
let cerrarActual = null; // función para cerrar el modal abierto en este momento, si hay uno

function asegurarDom() {
  if (overlayEl) return overlayEl;
  overlayEl = document.createElement("div");
  overlayEl.id = "aviso-overlay";
  overlayEl.className = "aviso-overlay hidden";
  overlayEl.innerHTML = `
    <div class="aviso-modal" role="alertdialog" aria-modal="true" aria-labelledby="aviso-titulo" aria-describedby="aviso-mensaje">
      <div class="aviso-icono" id="aviso-icono"></div>
      <div class="aviso-cuerpo">
        <div class="aviso-titulo" id="aviso-titulo"></div>
        <div class="aviso-mensaje" id="aviso-mensaje"></div>
        <div class="aviso-acciones" id="aviso-acciones"></div>
      </div>
    </div>`;
  document.body.appendChild(overlayEl);

  overlayEl.addEventListener("mousedown", (e) => {
    if (e.target === overlayEl && cerrarActual) cerrarActual(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && cerrarActual) cerrarActual(false);
  });

  return overlayEl;
}

const TITULOS_POR_DEFECTO = {
  info: "Aviso",
  exito: "Listo",
  advertencia: "Atención",
  peligro: "Confirmar acción",
  error: "Ocurrió un error",
};

function abrir({ tipo, titulo, mensaje, botones }) {
  const overlay = asegurarDom();
  const modal = overlay.querySelector(".aviso-modal");
  overlay.querySelector("#aviso-icono").innerHTML =
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONOS[tipo] || ICONOS.info}</svg>`;
  overlay.querySelector("#aviso-icono").className = `aviso-icono aviso-icono-${tipo}`;
  overlay.querySelector("#aviso-titulo").textContent = titulo || TITULOS_POR_DEFECTO[tipo] || "Aviso";
  overlay.querySelector("#aviso-mensaje").innerHTML = escapeHtml(mensaje).replace(/\n/g, "<br>");

  const acciones = overlay.querySelector("#aviso-acciones");
  acciones.innerHTML = "";
  const elementosBoton = botones.map((b) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `aviso-btn ${b.clase || ""}`;
    btn.textContent = b.texto;
    acciones.appendChild(btn);
    return btn;
  });

  return new Promise((resolve) => {
    let resuelto = false;
    const cerrar = (valor) => {
      if (resuelto) return;
      resuelto = true;
      cerrarActual = null;
      overlay.classList.add("hidden");
      overlay.classList.remove("flex");
      document.body.classList.remove("aviso-abierto");
      resolve(valor);
    };
    cerrarActual = cerrar;
    elementosBoton.forEach((btn, i) => {
      btn.addEventListener("click", () => cerrar(botones[i].valor));
    });

    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    document.body.classList.add("aviso-abierto");
    // Foco en el botón principal (el último, que es el de la acción
    // afirmativa) para poder confirmar con Enter directamente.
    requestAnimationFrame(() => elementosBoton[elementosBoton.length - 1]?.focus());
    modal.scrollTop = 0;
  });
}

/**
 * Reemplazo de window.alert(). Muestra un mensaje con un solo botón y
 * resuelve la promesa cuando se cierra.
 * @param {string} mensaje
 * @param {{titulo?: string, tipo?: 'info'|'exito'|'advertencia'|'error'}} opciones
 */
export function alertaBonita(mensaje, opciones = {}) {
  const { titulo, tipo = "info", textoBoton = "Entendido" } = opciones;
  return abrir({
    tipo,
    titulo,
    mensaje,
    botones: [{ texto: textoBoton, valor: true, clase: "aviso-btn-principal" }],
  }).then(() => undefined);
}

/**
 * Reemplazo de window.confirm(). Devuelve true/false según lo que elija
 * la persona.
 * @param {string} mensaje
 * @param {{titulo?: string, tipo?: 'advertencia'|'peligro', textoConfirmar?: string, textoCancelar?: string}} opciones
 */
export function confirmarBonito(mensaje, opciones = {}) {
  const {
    titulo,
    tipo = "advertencia",
    textoConfirmar = "Confirmar",
    textoCancelar = "Cancelar",
  } = opciones;
  return abrir({
    tipo,
    titulo,
    mensaje,
    botones: [
      { texto: textoCancelar, valor: false, clase: "aviso-btn-secundario" },
      { texto: textoConfirmar, valor: true, clase: tipo === "peligro" ? "aviso-btn-peligro" : "aviso-btn-principal" },
    ],
  });
}