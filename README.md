# OrbitalPWA — Simulatore Orbitale 3D (PWA + AR) per studi CubeSat

**OrbitalPWA** è una web-app **installabile** (PWA) per la visualizzazione e l’analisi rapida di orbite **circolari** ed **ellittiche** attorno a corpi planetari (Terra, Luna, Marte, Giove).  
È pensata come strumento **didattico e di pre-studio** per missioni **CubeSat**: calcolo del periodo, velocità, quote perigeo/apogeo, orientamento del piano orbitale e **animazione 3D** con **precessione** opzionale. Include inoltre una modalità **AR (Realtà Aumentata)** per presentazioni e dimostrazioni sceniche.

---

## Funzioni principali

- **Modello fisico**
  - Orbite **circolari** ed **ellittiche** con parametri: `hp` (perigeo), `ha` (apogeo).
  - Parametri orbitali 3D: **i** (inclinazione), **Ω** (RAAN), **ω** (argomento del pericentro).
  - **Moto kepleriano**: risoluzione numerica dell’equazione di Keplero `M = E − e sin E`, conversione a **anomalia vera** `ν`.
  - **Vis-viva** per la **velocità istantanea** `v = √( μ ( 2/r − 1/a ) )`.
  - **Periodo** `T = 2π √(a³ / μ)`; **moto medio** `n = √(μ/a³)`.
  - Scelta del corpo centrale (Terra/Luna/Marte/Giove) con `μ` pre-impostato o **inserimento diretto di μ = G·M`.

- **Visualizzazione & animazione**
  - Canvas 3D con **prospettiva**: distinzione **fronte/retro** dell’orbita (linea piena vs attenuata).
  - **Precessione** dell’ellisse: rotazione continua del **piano orbitale** (Ω·) e del **pericentro** (ω·).
  - **Assi/guide**: linea dei nodi (**Ω**) e direzione del pericentro (**ω**) con **frecce/archi** dinamici.
  - **Marker** su **Perigeo (ν = 0)** e **Apogeo (ν = π)**.

- **Dati mostrati in tempo reale**
  - **v** (km/s), **T** (formato h-m-s), **e**, **hp/ha** (km **sopra superficie**),
    **rₚ/rₐ** (km **dal centro**).
  - Etichette di **pianeta** e **satellite**, colori distintivi per ciascun corpo.

- **Modalità di rendering**
  1. **Rotazioni reali** — la precessione segue i tuoi Ω·/ω·.
  2. **Realtà aumentata (AR, beta)** — sfondo **camera** e **vista** pilotata dall’**orientamento del dispositivo**.

- **PWA**
  - **Aggiungi alla Home** (A2HS), **offline** (cache con Service Worker), manifest/icone.
  - Build parallela **No-SW** per debugging senza cache.

---

## Per cosa è utile in studi CubeSat

- **Dimensionamento missione preliminare** (early-stage):
  - Stima di **periodo T**, velocità media e variazioni lungo l’orbita (perigeo/apogeo).
  - Esplorazione di **LEO** tipiche (300–800 km), **MEO/GEO** dimostrative.
- **Visualizzazione della **geometria orbitale**:
  - Effetto 3D intuitivo di **i**, **Ω**, **ω**, e della **precessione** controllata.
  - Marker e valori **hp/ha** per validare rapidamente ipotesi di quota.
- **Comunicazione & Outreach**:
  - **Modalità AR** per demo live con smartphone/tablet.
  - “Aggiungi alla Home” per utilizzo **offline** in aula o laboratorio.
- **Prototipazione didattica**:
  - Confronto tra diversi corpi centrali cambiando **μ**.
  - Replica di passaggi storici (preset **CASIO FX-750P**).

> **Nota**: non è un propagatore “flight grade”. La **precessione** implementata è **parametrica** (Ω·/ω· impostati dall’utente) e non include perturbazioni (es. J2, drag, SRP, terzi corpi, non sfericità, GR, ecc.).

---

## Guida rapida (step-by-step)

1. **Apertura**
   - Apri `index.html` (consigliato via **HTTPS** se vuoi la camera in AR).
   - Su mobile/desktop puoi **installare** la PWA (barra “Aggiungi alla Home”).

2. **Seleziona il corpo centrale**
   - Menu **Corpo celeste**: Terra, Luna, Marte, Giove.  
     Puoi anche inserire **μ** manualmente (spunta “Usa μ = G·M”).

3. **Definisci l’orbita**
   - **Ellittica** (default): inserisci **hp** e **ha** (km sopra superficie).  
     Il codice calcola `a = (rp+ra)/2` ed `e = (ra−rp)/(ra+rp)`, con `rp = R + hp`, `ra = R + ha`.
   - **Circolare**: scegli **Quota** (km) → `r = R + quota`.

4. **Orientamento 3D**
   - Imposta **i**, **Ω**, **ω** tramite slider (vedi archi e frecce che si aggiornano).

5. **Animazione**
   - Premi **Avvia**. Il satellite segue Keplero; in tempo reale vedi **v**, **T**, **e** e marker **Perigeo/Apogeo**.
   - Usa **Velocità ×** per accelerare il tempo simulato.

6. **Precessione (roto-traslazione dell’ellisse)**
   - Abilita **“Ruota l’ellisse”**.
   - Imposta **Ω· (°/s)** e/o **ω· (°/s)**: l’**intera ellisse ruota** nello spazio mentre il satellite avanza.
   - Opzionale: **Demo precessione** per valori già “scenici”.

7. **Modalità AR (Realtà Aumentata)**
   - Seleziona **AR**. Consenti **fotocamera** e **sensori**: lo sfondo diventa il **video live** e la vista ruota con il dispositivo.
   - Requisiti: **HTTPS**, permessi per **DeviceOrientation** (su iOS viene richiesto dall’app).

---

## Modello fisico e implementazione

- **Equazioni chiave**
  - `n = √(μ/a³)`; `T = 2π/n`.
  - **Keplero**: dato `M(t) = n·t`, risolviamo `M = E − e sin E` con **Newton–Raphson**;  
    `ν = atan2( √(1−e²) sin E, cos E − e )`.
  - **Vis-viva**: `v = √( μ ( 2/r − 1/a ) )`.
  - **Rotazioni**: da piano orbitale a ECI con `Rz(Ω) · Rx(i) · Rz(ω)`.

- **Geometria ellittica**
  - `rp = a(1−e)`, `ra = a(1+e)`; nell’UI si lavora con **hp/ha** e raggio del corpo **R**.
  - Marker su **ν = 0** (perigeo) e **ν = π** (apogeo).

- **Rendering**
  - Proiezione prospettica semplice (FOV fisso), separazione **fronte/retro** dell’orbita.
  - **Assi/guide** per **Ω** (linea nodale) e **ω** (direzione del pericentro).
  - **Precessione**: aggiornamento continuo di **Ω** e **ω** (`Ω += Ω··Δt`, `ω += ω··Δt`).

---

## Struttura del progetto

```
OrbitalPWA/
├─ index.html          # UI, inclusione script, manifest (PWA)
├─ app.v7.js           # logica fisica + animazione + AR + precessione
├─ manifest.json       # nome, icone, tema
├─ sw.js               # Service Worker (cache offline)
└─ icons/
   ├─ icon-192.png
   └─ icon-512.png
```

> Per debugging, è disponibile anche una build **No-SW** (senza Service Worker) per evitare cache aggressive durante gli aggiornamenti.

---

## Requisiti e compatibilità

- **Browser**: Chrome/Edge/Firefox/Safari moderni.  
- **AR (camera + sensori)**: **HTTPS** obbligatorio; su iOS è necessaria l’autorizzazione esplicita a `DeviceOrientationEvent`.  
- **Installazione PWA**: supportata su Android/Chrome/Edge; su iOS tramite “Condividi → Aggiungi a Home”.

---

## Limitazioni note

- Modello **kepleriano** ideale (2-body): **non** include **J2**, **drag atmosferico**, **radiazione solare**, **terzi corpi**, **cessi di massa**, **non sfericità**, **relatività**, ecc.
- La **precessione** con **Ω·/ω·** è **didattica**/parametrica (non derivata da perturbazioni fisiche).
- Non è incluso il **ground-track** né l’import **TLE** (funzionalità possibili come estensioni future).

---

## Roadmap suggerita

- Import **TLE** e confronto con parametri (convertitore a, e, i, Ω, ω, M₀).  
- **J2** (regressione RAAN/ω) e **drag** con densità semplice (es. NRLMSISE-00 semplificato).  
- **Ground-track** e passaggi su stazioni.  
- **ADCS** base: set di reference frames e quaternioni per pannelli/antenne.  
- Esportazione **snapshot**/GIF e **report** PDF dei parametri.

---

## Utilizzo / Deploy

1. **Locale**: doppio click su `index.html` (funziona; AR potrebbe richiedere HTTPS e permessi).  
2. **Hosting**: carica l’intera cartella in un **percorso nuovo** ad ogni release per evitare cache SW.  
   - Se sostituisci i file nello **stesso percorso**, fai **Hard Reload** e, se serve, **Unregister** del Service Worker precedente (DevTools → Application → Service Workers).
3. **Installazione**: apri la pagina e usa la barra **“Aggiungi alla Home”** (A2HS).

---

## Riferimenti storici (opzionale)

- **Preset CASIO FX-750P (1984)**: include un profilo che replica i passaggi numerici del manuale storico per un confronto didattico con i valori moderni di `μ`, `R`, `G`.

---

## Licenza e attribuzioni

- **Licenza**: rilasciato con licenza **MIT** (© 2025 Alessandro Pezzali).  
- Fa parte di **[PezzaliStack](https://github.com/pezzaliapp/pezzalistack.git)**, la libreria privata open source di strumenti per studi, simulazioni e prototipazione **CubeSat**.  
- Dati planetari (`μ`, raggi medi) da fonti pubbliche standard (NASA, ESA).

---

## Contatti

Se desideri estendere l’app per i tuoi **studi CubeSat** (TLE, J2/drag, ground-track, ADCS), aggiungi richieste/issue nel repository o contattami direttamente.

---

**Versione corrente**: v7.1 (PWA + AR, precessione attiva, marker perigeo/apogeo, card hp/ha e rₚ/rₐ).  
**Autore**: Progetto didattico personalizzato per studi **CubeSat** nell’ambito di **PezzaliStack**.
