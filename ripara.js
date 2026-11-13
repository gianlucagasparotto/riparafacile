// Funzione serverless per Vercel: /api/ripara?q=rubinetto
// 1) cerca sul web come si ripara (Tavily)  2) l'AI (Gemini) unisce le fonti con la sua conoscenza  3) foto da Pexels.
const { cerca, blocchiFonti, gemini, leggiJson, foto, erroreUtente } = require("../lib/ai");

const SISTEMA = `Sei l'assistente di riparazione di RiparaFacile. Spieghi come riparare o montare oggetti di casa a persone che non l'hanno mai fatto.
Rispondi SOLO con un oggetto JSON valido, in italiano, con questa forma:
{
  "oggetto": "nome chiaro del problema, ad esempio Rubinetto che gocciola",
  "riassunto": "una frase sulla causa più probabile",
  "difficolta": "Facile" | "Media" | "Difficile",
  "tempo": "ad esempio 30 minuti",
  "costo": "ad esempio 5-15 €",
  "sicurezza": "avviso di sicurezza se ci sono elettricità, gas, batterie, parti taglienti o acqua in pressione, altrimenti stringa vuota",
  "attrezzi": ["..."],
  "passi": [ { "t": "titolo breve", "d": "istruzione precisa: cosa fare, con quale attrezzo, in che direzione, con quanta forza, con misure e tempi dove contano", "controllo": "come capire che il passo è riuscito", "attenzione": "errore comune o rischio di questo passo, oppure stringa vuota", "fonte": numero della fonte web da cui viene questo passo, oppure null } ],
  "foto_query": "2-3 parole in inglese per cercare una foto di questo oggetto"
}
Regole:
- Da 5 a 10 passi, in ordine. Scrivi come se spiegassi a una persona che ha l'oggetto davanti: nomina le parti con il loro nome e di' come riconoscerle, indica misure, versi di rotazione e tempi quando contano, e non saltare passaggi che sembrano ovvi.
- Ti do delle fonti web numerate. Usale quando dicono qualcosa di utile e completa con la tua conoscenza. In "fonte" metti il numero della fonte da cui viene il passo; se il passo viene dalla tua conoscenza e nessuna fonte lo conferma, metti null. Non inventare numeri.
- Se la riparazione è pericolosa o richiede un professionista, dillo nel campo "sicurezza".`;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
  const q = String(req.query?.q || "").trim().slice(0, 80);
  if (!q) return res.status(400).json({ errore: "Scrivi il nome dell'oggetto da riparare." });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ errore: "Server non configurato: manca GEMINI_API_KEY." });

  try {
    const fonti = await cerca(`come riparare ${q} guida passo passo`, 5);
    const testo = await gemini({
      system: SISTEMA,
      messages: [{ role: "user", content: `Oggetto da riparare: "${q}"\n\nFONTI WEB:\n${blocchiFonti(fonti)}` }],
      maxTokens: 8000,
    });
    const scheda = leggiJson(testo);

    // Ogni passo con un numero di fonte valido è "web", gli altri sono conoscenza dell'AI.
    for (const p of scheda.passi || []) {
      const n = Number(p.fonte);
      p.fonte = Number.isInteger(n) && fonti[n - 1] ? n : null;
      p.origine = p.fonte ? "web" : "ai";
    }
    scheda.fonti = fonti.map((f) => ({ title: f.title, url: f.url }));
    scheda.immagine = await foto(scheda.foto_query || q);
    delete scheda.foto_query;
    res.status(200).json(scheda);
  } catch (e) {
    console.error(e);
    res.status(502).json({ errore: erroreUtente(e) });
  }
};
