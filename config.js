// =============================================================
//  Configuración de Firebase del proyecto "Gastos Familiar".
//  Ya quedó llena con los datos de Oscar (proyecto gastos-familiar-d1f02).
// =============================================================
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyApg5Wl4e69JM7H8SI_Wehj1iiW7RmwndE",
  authDomain: "gastos-familiar-d1f02.firebaseapp.com",
  projectId: "gastos-familiar-d1f02",
  storageBucket: "gastos-familiar-d1f02.firebasestorage.app",
  messagingSenderId: "167833698110",
  appId: "1:167833698110:web:73d322e24b83f3a7f5b66f"
};

// URL de la Cloud Function "tipoCambioManual" (tipo de cambio oficial del BCCR).
// Esta URL ya es la definitiva mientras despliegue la función en la región
// us-central1 (así viene configurada en functions/index.js). Si no ha
// desplegado la función todavía, déjela así: la app simplemente usará el
// respaldo (open.er-api.com) hasta que exista.
window.BCCR_FUNCTION_URL = "https://us-central1-gastos-familiar-d1f02.cloudfunctions.net/tipoCambioManual";
