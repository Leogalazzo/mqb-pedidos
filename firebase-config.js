// Configuración e inicialización de Firebase, compartida por todas las páginas.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  getCountFromServer,
  runTransaction,
  serverTimestamp,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDzbekJXiNgvdtb2HlkIYV3gJve6kC1rlM",
  authDomain: "mqb-pedidos.firebaseapp.com",
  projectId: "mqb-pedidos",
  storageBucket: "mqb-pedidos.firebasestorage.app",
  messagingSenderId: "845408908880",
  appId: "1:845408908880:web:cb0b08ad07a0cb9bdb4355",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  getCountFromServer,
  runTransaction,
  serverTimestamp,
  arrayUnion,
};

// ============================================================
// Rol por correo: NO hace falta ninguna colección "usuarios" para
// decidir quién es central. Central puede tener más de una cuenta con
// acceso administrativo (por ejemplo: el dueño y el local principal),
// así que acá se define un mapa correo -> nombre para mostrar. Cada
// cuenta que esté en este mapa entra como "central"; cualquier otro
// correo que pueda iniciar sesión (los que crees en Authentication)
// se trata automáticamente como sucursal.
// ============================================================
export const CUENTAS_CENTRAL = {
  "admin@mqb.interno": "Casa central",
  "villaangela@mqb.interno": "Villa Ángela (central)",
};

// ============================================================
// Login por "usuario" en vez de correo real: Firebase Authentication
// solo sabe loguear con email, así que cada cuenta se crea con un
// correo inventado (nunca se manda nada ahí) con este dominio fijo.
// La persona solo ve/escribe el usuario ("saenzpena"); acá se arma
// el email completo ("saenzpena@mqb.interno") antes de loguear.
// ============================================================
export const DOMINIO_INTERNO = "mqb.interno";

export function emailDesdeUsuario(usuario) {
  return `${(usuario || "").trim().toLowerCase()}@${DOMINIO_INTERNO}`;
}

export function obtenerRolPorCorreo(email) {
  if (!email) return null;
  return CUENTAS_CENTRAL[email.toLowerCase()] ? "central" : "sucursal";
}

// ============================================================
// Nombre de la sucursal: vive en Firestore, en la colección
// "sucursales" (documento = uid de Authentication), NO en localStorage.
// Así el nombre queda atado a la cuenta y no al navegador/celular: si la
// sucursal cambia de dispositivo o borra el caché, sigue viendo el mismo
// nombre, y ese nombre es el único que aparece en central (nada de
// "Centro" y "Sucursal Centro" como si fueran cosas distintas).
//
// La primera vez que una sucursal inicia sesión no existe el documento
// todavía, así que se crea automáticamente con un nombre provisorio
// (derivado del correo). Central puede renombrarla después desde la
// pestaña "Sucursales" sin que eso afecte los pedidos ya hechos (cada
// pedido guarda su propia copia del nombre en sucursalNombre).
export async function obtenerPerfil(user) {
  const rol = obtenerRolPorCorreo(user.email);
  if (rol === "central") {
    return { rol, nombre: CUENTAS_CENTRAL[(user.email || "").toLowerCase()] || "Casa central" };
  }

  const ref = doc(db, "sucursales", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return { rol: "sucursal", nombre: snap.data().nombre || "Sucursal" };
  }

  const nombreProvisorio = (user.email || "Sucursal").split("@")[0];
  await setDoc(ref, {
    nombre: nombreProvisorio,
    email: user.email || null,
    creadoEn: serverTimestamp(),
  });
  return { rol: "sucursal", nombre: nombreProvisorio };
}

// Genera un número de pedido correlativo simple (contadores/pedidos.ultimo).
export async function siguienteNumeroPedido() {
  const ref = doc(db, "contadores", "pedidos");
  const numero = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const actual = snap.exists() ? snap.data().ultimo || 0 : 0;
    const nuevo = actual + 1;
    tx.set(ref, { ultimo: nuevo }, { merge: true });
    return nuevo;
  });
  return numero;
}