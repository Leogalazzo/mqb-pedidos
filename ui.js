// Helpers de interfaz compartidos: loaders en botones (con bloqueo de doble clic)
// y placeholders de "cargando" para listas que todavía no recibieron datos.

import { alertaBonita } from "./avisos.js";

// Envuelve una acción async en un botón: lo deshabilita, le pone un spinner + texto,
// y lo devuelve a su estado original al terminar (ya sea que salga bien o falle).
// Si el botón ya está en curso, un segundo click se ignora — esto es lo que evita
// que tocar "Enviar pedido" dos veces cree dos pedidos.
export function conCarga(boton, tarea, textoCargando = "Guardando…", alertaGenerica = true) {
  if (boton.dataset.cargando === "1") return Promise.resolve();

  const contenidoOriginal = boton.innerHTML;
  boton.dataset.cargando = "1";
  boton.disabled = true;
  boton.classList.add("btn-cargando");
  const claseSpinner = boton.dataset.spinnerOscuro === "1" ? "spinner spinner-oscuro" : "spinner";
  boton.innerHTML = `<span class="btn-cargando-contenido"><span class="${claseSpinner}"></span>${textoCargando}</span>`;

  const restaurar = () => {
    boton.dataset.cargando = "";
    boton.disabled = false;
    boton.classList.remove("btn-cargando");
    boton.innerHTML = contenidoOriginal;
  };

  return Promise.resolve()
    .then(tarea)
    .then((resultado) => { restaurar(); return resultado; })
    .catch((err) => {
      restaurar();
      console.error(err);
      if (alertaGenerica) {
        alertaBonita("Algo falló al guardar. Revisá tu conexión e intentá de nuevo.", {
          titulo: "No se pudo guardar",
          tipo: "error",
        });
      }
      throw err;
    });
}

// Pinta un placeholder de "cargando" dentro de un contenedor de lista, para
// distinguir "todavía no llegaron los datos" de "no hay nada" (evita el parpadeo
// del mensaje de vacío mientras se espera la primera respuesta de Firestore).
export function mostrarCargandoLista(contenedorId, mensaje = "Cargando…") {
  const el = document.getElementById(contenedorId);
  if (el) {
    el.innerHTML = `<div class="skeleton-fila"><span class="spinner spinner-oscuro"></span>${mensaje}</div>`;
  }
}

// Oculta el overlay de página completa (#cargando-pagina) una vez que ya sabemos
// qué mostrar (login resuelto y primeros datos en camino).
export function ocultarCargaPagina() {
  const el = document.getElementById("cargando-pagina");
  if (el) el.remove();
}

// Botón "Instalar app" (PWA). Se muestra solo cuando corresponde:
//  - Android / escritorio (Chrome, Edge…): cuando el navegador avisa que la app
//    es instalable (evento beforeinstallprompt); al tocarlo sale el diálogo nativo.
//  - iPhone / iPad: Safari no tiene diálogo de instalación, así que el botón
//    muestra los pasos manuales (Compartir → Agregar a inicio).
//  - Si la app ya está instalada y abierta como app, el botón no aparece.
export function configurarBotonInstalar(boton) {
  if (!boton) return;

  const yaInstalada =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (yaInstalada) return;

  const mostrar = () => { boton.classList.remove("hidden"); boton.classList.add("flex"); };
  const ocultar = () => { boton.classList.add("hidden"); boton.classList.remove("flex"); };

  const esIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS
  let promptDiferido = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // guardamos el aviso para dispararlo con nuestro botón
    promptDiferido = e;
    mostrar();
  });
  window.addEventListener("appinstalled", () => {
    promptDiferido = null;
    ocultar();
  });

  if (esIOS) mostrar();

  boton.addEventListener("click", async () => {
    if (promptDiferido) {
      promptDiferido.prompt();
      await promptDiferido.userChoice;
      promptDiferido = null; // el aviso solo se puede usar una vez
      ocultar();
      return;
    }
    if (esIOS) {
      alertaBonita(
        "Para instalar la app en tu iPhone o iPad:\n1. Tocá el botón Compartir (el cuadrado con la flecha hacia arriba).\n2. Elegí «Agregar a inicio».\n3. Tocá «Agregar».",
        { titulo: "Instalar la app", tipo: "info" }
      );
    }
  });
}

// ============================================================
// Aviso de actualización de la app (PWA).
//
// Cuando se sube una versión nueva de sw.js (cambiando CACHE_VERSION), el
// navegador la descarga en segundo plano y la deja "en espera". Acá se
// detecta eso y se muestra un modal con el botón "Actualizar": al tocarlo,
// le avisamos al service worker nuevo que se active (SKIP_WAITING) y, apenas
// toma el control, se recarga la página con todo lo nuevo.
//
// Se inicia solo al importar ui.js, y todas las pantallas ya lo importan,
// así que no hace falta tocar cada página.
// ============================================================
export function iniciarAvisoActualizacion() {
  if (!("serviceWorker" in navigator)) return;

  // Si al cargar la página todavía no había service worker controlándola
  // (primera visita), el "controllerchange" de esa primera activación no
  // debe recargar nada.
  const teniaControlador = !!navigator.serviceWorker.controller;
  let actualizacionPedida = false;
  let avisoMostrado = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Solo se recarga si fue esta persona quien tocó "Actualizar".
    if (teniaControlador && actualizacionPedida) location.reload();
  });

  function mostrarAviso(worker) {
    if (avisoMostrado) return;
    avisoMostrado = true;
    alertaBonita(
      "Hay cambios en la app. Tocá «Actualizar» para ver la última versión.",
      { titulo: "Hay una actualización", tipo: "info", textoBoton: "Actualizar", cerrable: false }
    ).then(() => {
      actualizacionPedida = true;
      worker.postMessage({ type: "SKIP_WAITING" });
      // Por si el cambio de controlador no llegara a dispararse, recarga igual.
      setTimeout(() => location.reload(), 3000);
    });
  }

  function iniciar() {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // Una versión nueva que ya quedó esperando de una visita anterior.
      if (reg.waiting && navigator.serviceWorker.controller) mostrarAviso(reg.waiting);

      // Una versión nueva que se descarga ahora mismo.
      reg.addEventListener("updatefound", () => {
        const nuevo = reg.installing;
        if (!nuevo) return;
        nuevo.addEventListener("statechange", () => {
          if (nuevo.state === "installed" && navigator.serviceWorker.controller) {
            mostrarAviso(nuevo);
          }
        });
      });

      // Buscar versiones nuevas al volver a la app (útil en la app instalada,
      // que puede quedar abierta días) y cada media hora.
      const buscar = () => reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") buscar();
      });
      setInterval(buscar, 30 * 60 * 1000);
    }).catch(() => {});
  }

  if (document.readyState === "complete") iniciar();
  else window.addEventListener("load", iniciar);
}

iniciarAvisoActualizacion();
