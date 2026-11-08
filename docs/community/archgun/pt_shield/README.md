# Profit-Taker shield phase — damage per element (2026-11-08)

Shield takes damage only from the displayed type and cycles after 20% of total shield (162,645 at level 60), after 25 s, or on an Operator void beam (wiki Profit-Taker Orb). `model.py` (guns) and `zaw.py` (Exodia Contagion) give seconds / throws per 20% chunk for each type.

Assumptions: Chroma Prime strength 298% → Vex Armor Fury +819.5% additive base damage (guns), applied twice to the Exodia projectile (wiki Vex Armor / Exodia Contagion); subsumed Nourish viral +134%; Reinforced Bond +60% fire rate and Tenacious Bond +1.2 crit multiplier (from the Detron arsenal); Vigorous Swap left out (same for both guns); Exodia x4 after 30 m, combo term ignored; explosion (Viral AoE) lost in phases 3/4 (wiki bug list).

Results:
- Ceiling 12/13 types: one weapon keeps at most one single element (wiki Damage); Mausolon holds Heat, so secondary + Zaw take two of Cold/Electricity/Toxin. Missing Toxin → Operator void beam.
- Zaw (Plague Kripath + Exodia Contagion + Melee Exposure): physical 0.36 throw, every element ≤0.06 throw. Fury → Magnetic Rush and Sacrificial Pressure → Focus Radon add Magnetic and Radiation (physical 0.40, elements ≤0.075).
- Tenet Detron (wiki bug: modded-multishot pellets use the Detron's crit stats): cold 1.36 s, radiation 1.80, magnetic 3.92 (sustained).
- Tenet Diplos, radiation valence 60%, riven crit chance/crit damage/multishot max + Galvanized Diffusion, Lethal Torrent, Creeping Bullseye, Primed Target Cracker, Primed Expel Corpus, Hornet Strike, Deep Freeze, first magazine: viral 0.14, cold 0.21, radiation 0.49, impact 0.74, puncture 0.92, slash 1.06. Without a riven: cold 0.65, radiation 1.57, physical 2.4–3.4.
- Independent review 2026-11-08 caught the Exodia double-dip (first draft understated the Zaw ~9x) and the Detron multishot bug.
