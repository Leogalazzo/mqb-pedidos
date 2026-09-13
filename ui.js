// Helpers de interfaz compartidos: loaders en botones (con bloqueo de doble clic)
// y placeholders de "cargando" para listas que todavía no recibieron datos.

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
      if (alertaGenerica) alert("Algo falló al guardar. Revisá tu conexión e intentá de nuevo.");
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