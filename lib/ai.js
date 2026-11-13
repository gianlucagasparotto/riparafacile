// Funzioni condivise dai due server: ricerca web (Tavily), AI (Gemini), foto (Pexels).
// Tutti e tre hanno un piano gratuito. Le chiavi si impostano come variabili d'ambiente su Vercel:
//   GEMINI_API_KEY  (obbligatoria)  da aistudio.google.com/apikey
//   TAVILY_API_KEY  (consigliata)   da app.tavily.com   (senza, l'AI risponde senza cercare sul web)
//   PEXELS_API_KEY  (facoltativa)   da pexels.com/api   (non serve: Pexels ha sospeso le chiavi nuove, le foto vengono da Wikipedia)
//   GEMINI_MODEL    (facoltativa)   di base gemini-3.8-flash; gemini-3.5-flash-lite ha limiti più larghi

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

// Cerca sul web. Se qualcosa va storto restituisce una lista vuota: la risposta arriva comunque, solo dall'AI.
async function cerca(query, max = 5) {
  if (!process.env.TAVILY_API_KEY) return [];
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer " + process.env.TAVILY_API_KEY },
      body: JSON.stringify({ query, search_depth: "basic", max_results: max, topic: "general", include_answer: false }),
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.results || [])
      .filter((x) => x.url && x.content)
      .slice(0, max)
      .map((x) => ({ title: String(x.title || x.url).slice(0, 120), url: x.url, content: String(x.content).slice(0, 900) }));
  } catch {
    return [];
  }
}

// Testo delle fonti da mettere nel prompt, numerate da 1.
function blocchiFonti(fonti) {
  if (!fonti.length) return "Nessuna fonte web disponibile: rispondi con la tua conoscenza.";
  return fonti.map((f, i) => `[${i + 1}] ${f.title} (${f.url})\n${f.content}`).join("\n\n");
}

// Chiama Gemini e restituisce il testo della risposta.
async function gemini({ system, messages, json = true, maxTokens = 6000 }) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3, ...(json ? { responseMimeType: "application/json" } : {}) },
    }),
  });
  if (!r.ok) {
    const e = new Error("Gemini " + r.status + ": " + (await r.text()).slice(0, 200));
    e.status = r.status;
    throw e;
  }
  const d = await r.json();
  const testo = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  if (!testo) throw new Error("risposta vuota");
  return testo;
}

function leggiJson(testo) {
  const pulito = testo.replace(/^```(?:json)?/i, "").replace(/```$/, "");
  const a = pulito.indexOf("{");
  const b = pulito.lastIndexOf("}");
  if (a === -1 || b === -1) throw new Error("risposta senza JSON");
  return JSON.parse(pulito.slice(a, b + 1));
}

async function fotoPexels(query) {
  if (!process.env.PEXELS_API_KEY || !query) return null;
  try {
    const r = await fetch("https://api.pexels.com/v1/search?per_page=1&orientation=landscape&query=" + encodeURIComponent(query), {
      headers: { Authorization: process.env.PEXELS_API_KEY },
    });
    if (!r.ok) return null;
    const p = (await r.json()).photos?.[0];
    return p ? { url: p.src.large, autore: p.photographer + " su Pexels", link: p.url } : null;
  } catch {
    return null;
  }
}

// Foto da Wikipedia: non serve nessuna chiave. Prende l'immagine principale della pagina più pertinente.
async function fotoWikipedia(query) {
  if (!query) return null;
  try {
    const params = new URLSearchParams({
      action: "query", generator: "search", gsrsearch: query, gsrlimit: "4",
      prop: "pageimages|info", piprop: "thumbnail", pithumbsize: "1000", inprop: "url",
      format: "json", formatversion: "2",
    });
    const r = await fetch("https://en.wikipedia.org/w/api.php?" + params, {
      headers: { "User-Agent": "RiparaFacile/1.0 (sito per imparare a riparare oggetti)" },
    });
    if (!r.ok) return null;
    const pagine = (await r.json()).query?.pages || [];
    const p = pagine.filter((x) => x.thumbnail?.source).sort((a, b) => a.index - b.index)[0];
    return p ? { url: p.thumbnail.source, autore: "Wikipedia, " + p.title, link: p.fullurl } : null;
  } catch {
    return null;
  }
}

// Usa Pexels se hai una chiave, altrimenti Wikipedia. Se non trova nulla la pagina mostra un'illustrazione.
async function foto(query) {
  return (await fotoPexels(query)) || (await fotoWikipedia(query));
}

function erroreUtente(e) {
  return e && e.status === 429
    ? "Ci sono troppe richieste in questo momento. Riprova tra un minuto."
    : "Non sono riuscito a rispondere. Riprova tra un momento.";
}

module.exports = { cerca, blocchiFonti, gemini, leggiJson, foto, erroreUtente };
