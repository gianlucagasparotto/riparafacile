# RiparaFacile (versione gratuita)

Scrivi il nome di un oggetto e ottieni foto, attrezzi e passaggi precisi per ripararlo. Puoi fare domande in una chat mentre lavori.
Tutto usa servizi con un piano gratuito, senza carta di credito.

## Cosa contiene

- `index.html` è la pagina
- `api/ripara.js` costruisce la scheda: cerca sul web (Tavily), l'AI (Gemini) unisce le fonti con la sua conoscenza, la foto viene da Wikipedia
- `api/chiedi.js` è la chat: risponde alle domande sul tuo caso, con una ricerca web su ogni domanda
- `lib/ai.js` contiene le funzioni usate dai due server
- `vercel.json` dà alla ricerca fino a 60 secondi di tempo

## Le due chiavi gratuite

| Servizio | A cosa serve | Dove si prende | Variabile su Vercel |
|---|---|---|---|
| Google Gemini | l'AI che scrive le istruzioni e risponde | aistudio.google.com/apikey | `GEMINI_API_KEY` |
| Tavily | la ricerca sul web | app.tavily.com | `TAVILY_API_KEY` |

La foto dell'oggetto viene da Wikipedia e non chiede nessuna chiave. Pexels ha sospeso le chiavi nuove; se ne hai già una puoi mettere `PEXELS_API_KEY` e verrà usata al posto di Wikipedia.

Facoltativa: `GEMINI_MODEL`. Di base è `gemini-3.8-flash`. Se finisci spesso i limiti, prova `gemini-3.5-flash-lite`.

## Metterlo online

1. Prendi le due chiavi qui sopra.
2. Crea un repository su github.com e carica il contenuto di questa cartella (index.html, vercel.json, README.md e le cartelle api e lib).
3. Su vercel.com accedi con GitHub, scegli "Add New", "Project" e importa il repository. Lascia le impostazioni com'è.
4. Prima di premere Deploy apri "Environment Variables" e inserisci le due chiavi.
5. Premi Deploy. Dopo circa un minuto il sito è online.

## Limiti da conoscere

- **Tavily gratis:** 1.000 crediti al mese. Ogni nuova scheda ne usa 1 e ogni domanda in chat ne usa 1. Finiti i crediti il sito continua a funzionare, ma risponde solo con la conoscenza dell'AI e i passaggi vengono segnati "Conoscenza AI".
- **Gemini gratis:** ha limiti di richieste al minuto e al giorno, e li decide Google. Se sono finiti, la pagina dice di riprovare tra un minuto. Puoi vedere i tuoi limiti in aistudio.google.com.
- **Foto:** vengono dall'immagine principale della pagina di Wikipedia più vicina alla ricerca, quindi per oggetti molto particolari può non esserci una foto: in quel caso la scheda mostra un'illustrazione. La foto è accreditata con un link alla pagina.
- **Privacy:** sul piano gratuito di Gemini Google può usare i dati inviati per migliorare i suoi servizi. Controlla le condizioni e non scrivere dati personali nella chat.
- **Vercel gratis:** vale solo per uso non commerciale.
- Le chiavi stanno solo nel server e non finiscono mai nella pagina. Non caricarle su GitHub.
