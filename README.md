# Orbita — Velocità & Periodo

App offline per calcolare **velocità orbitale** e **periodo** di un satellite in **orbita circolare**.

- Formula: `v = √(G·M / r)` e `T = 2πr / v`
- Dove `r = (raggio del corpo + quota) · 1000` per ottenere i metri (SI)
- Preset inclusi:
  - *CASIO FX‑750P (1984)* — replica dell’esempio storico (R=6400 km, M=6×10²⁴ kg, quota 5500 km, G=6.67×10⁻¹¹) ⇒ **v ≈ 5800 m/s**, **T ≈ 12 891 s ≈ 3h 34m 51s**
  - *Terra (moderni)* — costanti aggiornate (G=6.67430×10⁻¹¹, R=6371 km, M=5.972×10²⁴ kg)

## Uso
1. Apri `index.html` (funziona anche offline).
2. Scegli un preset o inserisci **raggio del corpo**, **quota**, **massa** e **G**.
3. Premi **Calcola**. I risultati sono mostrati in m/s, km/s e in ore:minuti:secondi.

## Installazione come PWA
- Il file `manifest.json` e `sw.js` permettono l’uso **offline**.  
- Aggiungi alla Home dal browser del telefono/desktop.

## Note fisiche
- Modello a orbita **circolare** e **punto materiale** (senza J2, attrito, eccentricità).  
- Per orbite ellittiche, usa il semiasse maggiore `a` al posto di `r` in `T = 2π√(a³/μ)` con `μ = G·M`.

© 2025 MIT — PezzaliAPP
