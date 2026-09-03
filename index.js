// functions/index.js
// -----------------------------------------------------------------------
// Obtiene el tipo de cambio OFICIAL de compra/venta USD-CRC del Banco
// Central de Costa Rica (BCCR) y lo guarda en Firestore, en el mismo
// documento que la app "Gastos Familia" ya escucha con onSnapshot
// (colección "hogar", doc "config"). Así el tipo de cambio se actualiza
// solo, sin que nadie tenga que abrir la app.
//
// Por qué una Cloud Function y no llamar al BCCR desde el navegador:
//  - El servicio del BCCR exige un correo y un token de suscripción
//    (no se debe exponer ese token en código de cliente).
//  - Es un webservice ASMX pensado para consumo servidor-a-servidor;
//    normalmente no envía cabeceras CORS, así que un fetch() desde el
//    navegador falla de forma intermitente según el navegador/red.
// -----------------------------------------------------------------------

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const https = require("https");

admin.initializeApp();
const db = admin.firestore();

// Configúrelos una sola vez con:
//   firebase functions:secrets:set BCCR_EMAIL
//   firebase functions:secrets:set BCCR_TOKEN
// (correo y token que el BCCR entrega al registrarse en su servicio web
// de indicadores económicos)
const BCCR_EMAIL = defineSecret("BCCR_EMAIL");
const BCCR_TOKEN = defineSecret("BCCR_TOKEN");

const BCCR_BASE =
  "https://gee.bccr.fi.cr/Indicadores/Suscripciones/WS/wsIndicadoresEconomicos.asmx/ObtenerIndicadoresEconomicosXML";
const IND_COMPRA = 317; // Tipo de cambio: compra colón/dólar
const IND_VENTA = 318; // Tipo de cambio: venta colón/dólar

// Colección/documento donde vive la config de Costa Rica dentro de la app.
// Debe coincidir con CUR.CR.col en index.html (por defecto "hogar").
const CFG_COLLECTION = "hogar";
const CFG_DOC = "config";

function fechaCR() {
  // BCCR espera dd/mm/aaaa
  const partes = new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());
  const get = (t) => partes.find((p) => p.type === t).value;
  return `${get("day")}/${get("month")}/${get("year")}`;
}

function getXML(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

function extraerValor(xml) {
  // El XML del BCCR trae el valor dentro de <NUM_VALOR>...</NUM_VALOR>
  const m = xml.match(/<NUM_VALOR>([\d.,]+)<\/NUM_VALOR>/i);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

async function consultarIndicador(codigo, email, token) {
  const fecha = fechaCR();
  const params = new URLSearchParams({
    Indicador: String(codigo),
    FechaInicio: fecha,
    FechaFinal: fecha,
    Nombre: "GastosFamilia",
    SubNiveles: "N",
    CorreoElectronico: email,
    Token: token,
  });
  const xml = await getXML(`${BCCR_BASE}?${params.toString()}`);
  return extraerValor(xml);
}

async function obtenerTipoCambioBCCR(email, token) {
  const [compra, venta] = await Promise.all([
    consultarIndicador(IND_COMPRA, email, token),
    consultarIndicador(IND_VENTA, email, token),
  ]);
  if (!compra || !venta) {
    throw new Error("El BCCR no devolvió valores válidos para hoy");
  }
  return { compra, venta };
}

async function guardarTipoCambio(compra, venta) {
  const ref = db.collection(CFG_COLLECTION).doc(CFG_DOC);
  await ref.set(
    {
      tc: venta,
      tcCompra: compra,
      tcVenta: venta,
      tcFecha: new Date().toISOString().slice(0, 10),
      tcFuente: "BCCR",
    },
    { merge: true }
  );
}

// 1) Corre sola todos los días a las 6:00am hora de Costa Rica.
exports.actualizarTipoCambioBCCR = onSchedule(
  {
    region: "us-central1",
    schedule: "0 6 * * *",
    timeZone: "America/Costa_Rica",
    secrets: [BCCR_EMAIL, BCCR_TOKEN],
    retryCount: 3, // reintenta sola si el BCCR falla momentáneamente
  },
  async () => {
    try {
      const { compra, venta } = await obtenerTipoCambioBCCR(
        BCCR_EMAIL.value(),
        BCCR_TOKEN.value()
      );
      await guardarTipoCambio(compra, venta);
      logger.info("Tipo de cambio BCCR actualizado", { compra, venta });
    } catch (e) {
      logger.error("Error actualizando tipo de cambio BCCR", e);
      throw e; // deja que retryCount reintente
    }
  }
);

// 2) Endpoint HTTPS para el botón "Actualizar ahora" de la app.
//    region fija para que la URL sea predecible: siempre
//    https://us-central1-gastos-familiar-d1f02.cloudfunctions.net/tipoCambioManual
exports.tipoCambioManual = onRequest(
  { region: "us-central1", secrets: [BCCR_EMAIL, BCCR_TOKEN], cors: true },
  async (req, res) => {
    try {
      const { compra, venta } = await obtenerTipoCambioBCCR(
        BCCR_EMAIL.value(),
        BCCR_TOKEN.value()
      );
      await guardarTipoCambio(compra, venta);
      res.json({ ok: true, compra, venta });
    } catch (e) {
      logger.error("Error en tipoCambioManual", e);
      res.status(502).json({ ok: false, error: String(e.message || e) });
    }
  }
);
