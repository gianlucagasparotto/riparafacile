// Funzione serverless per Vercel: POST /api/chiedi
// Risponde alle domande di chi sta riparando, tenendo conto della scheda e di una ricerca web fatta sulla domanda.
// Corpo (JSON): { oggetto, passi: [{ t, d }], messaggi: [{ role: "user" | "assistant", content }] }
const { cerca, blocchiFonti, gemini, leggiJson, erroreUtente } = require("../lib/ai");

const SISTEMA = (oggetto, passi, fonti) => `Sei l'assistente di riparazione di RiparaFacile. La persona che ti scrive sta riparando o montando questo oggetto, ha l'oggetto davanti e ti fa domande mentre lavora.

Oggetto: ${oggetto}
Scheda che sta seguendo:
${passi.map((p, i) => `${i + 1}. ${p.t}: ${p.d}`).join("\n")}

FONTI WEB trovate sulla sua ultima domanda:
${blocchiFonti(fonti)}

Come rispondere:
- Rispondi in italiano, in modo concreto e breve (di solito sotto le 150 parole), con istruzioni che si possono eseguire subito.
- Se la domanda riguarda un passaggio, richiamalo per numero. Dai misure, versi di rotazione e come riconoscere le parti quando servono.
- Se ti manca un dato per rispondere bene (marca, modello, cosa vede la persona), fai una sola domanda di chiarimento.
- Usa le fonti web per modelli specifici, codici ricambio e valori tecnici. Non inventare mai misure, coppie di serraggio o codici: se non sei sicuro, dillo.
- Se c'è un rischio (elettricità, gas, batterie, parti in pressione, parti taglienti), avvisa e di' quando è meglio chiamare un professionista.
- Testo semplice, senza markdown e senza elenchi con asterischi.

Rispondi SOLO con un oggetto JSON: { "risposta": "testo della risposta", "fonti_usate": [numeri delle fonti web che hai usato davvero, anche nessuna] }`;

function pulisci(body) {
  const oggetto = String(body.oggetto || "").slice(0, 120);
  const passi = (Array.isArray(body.passi) ? body.passi : []).slice(0, 14).map((p) => ({
    t: String(p.t || "").slice(0, 120),
    d: String(p.d || "").slice(0, 500),
  }));

  // L'API vuole messaggi che alternano utente e modello, a partire dall'utente.
  const messaggi = [];
  for (const m of (Array.isArray(body.messaggi) ? body.messaggi : []).slice(-10)) {
    const role = m.role === "assistant" ? "assistant" : "user";
    const content = String(m.content || "").slice(0, 1000).trim();
    if (!content) continue;
    const ultimo = messaggi[messaggi.length - 1];
    if (ultimo && ultimo.role === role) ultimo.content += "\n" + content;
    else messaggi.push({ role, content });
  }
  while (messaggi.length && messaggi[0].role !== "user") messaggi.shift();
  return { oggetto, passi, messaggi };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ errore: "Metodo non consentito." });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ errore: "Server non configurato: manca GEMINI_API_KEY." });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { oggetto, passi, messaggi } = pulisci(body || {});
  if (!oggetto || !messaggi.length || messaggi[messaggi.length - 1].role !== "user") {
    return res.status(400).json({ errore: "Scrivi la tua domanda." });
  }

  try {
    const domanda = messaggi[messaggi.length - 1].content.replace(/^Sul passaggio \d+ \([^)]*\):\s*/, "");
    const fonti = await cerca(`${oggetto} ${domanda}`.slice(0, 200), 4);
    const testo = await gemini({ system: SISTEMA(oggetto, passi, fonti), messages: messaggi, maxTokens: 3000 });
    const out = leggiJson(testo);
    const risposta = String(out.risposta || "").trim();
    if (!risposta) throw new Error("risposta vuota");

    const usate = (Array.isArray(out.fonti_usate) ? out.fonti_usate : []).filter((n) => Number.isInteger(n) && fonti[n - 1]);
    res.status(200).json({ risposta, fonti: [...new Set(usate)].map((n) => ({ title: fonti[n - 1].title, url: fonti[n - 1].url })) });
  } catch (e) {
    console.error(e);
    res.status(502).json({ errore: erroreUtente(e) });
  }
};
