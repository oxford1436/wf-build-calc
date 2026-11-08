# Kuva Tonkor vs Kuva Zarr / Kuva Ogris (2026-11-08, calculator v2.00–2.01, aim off)

Same options for all three through the app's run path (`cmp.js`, share hash → auto run): Steel Path Lv150/250/400, three factions, 12-enemy crowd, kill stacks from zero, companion bonds on. Cyte-09 = the user's frame (strength 298%, 2 violet shards, Nourish, Growing Power), Resupply cast time 0 s (calculator default).
Score = kills per second (geometric mean), relative to the user's Kuva Zarr (riven cd 143 / ms 102.1 / cc 181.9 / −status duration 84.5, toxin 37%).

| weapon | Cyte-09 Resupply | no frame | sustained fire |
|---|---|---|---|
| Kuva Zarr (user's riven) | 17.74 (100%) | 1.874 (100%) | 10 s |
| Kuva Tonkor, no riven, valence 60% (auto) | 3.06 (17%) normal reload / 16.65 (94%) Resupply every shot | 1.453 (78%) | 36 s |
| Kuva Tonkor + max riven (reload / crit damage / crit chance, −recoil) | — | 2.53 (135%) | 24 s |
| Kuva Ogris (user's riven, heat 28.7%) | 10.20 (58%) | 0.454 (24%) | 12 s |

- Resupply cast time sensitivity (`ev.json`, same builds): Zarr 0 / 0.2 / 0.5 s = 17.74 / 15.69 / 12.38, Tonkor (casts every shot) 16.65 / 8.80 / 4.51, Ogris 10.20 / 7.65 / 5.65.
- Grineer heavy one-shot level (no frame): Zarr 69, Tonkor 52 (riven 55), Ogris 46.
- Primary Compression (aim) on the no-frame #1 builds (not re-optimised): Tonkor 1.453 → 0.782, Zarr 1.874 → 0.738 (radius ×0.2 loses crowd hits); one-shot level Tonkor 52 → 82, Zarr 69 → 139. Found while reading arca.live: the engine added Compression beside Serration; the wiki says projectile weapons multiply → fixed in v2.01.
- Kuva Zarr Cyte-09 confirmed set (2026-11-07) = 97.5% of the v2.00 #1 (Serration, Heavy Caliber, Point Strike, Vital Sense).
- Community (arca.live, read directly, `builds/kuva_tonkor.json`): "no reason to use Zarr over Tonkor, Zarr's problem is ammo"; "On Call uses Zarr because one reload loads all 5 rounds"; "Ogris is for Profit-Taker / Arbitrations (napalm)".

## v2.02 recheck (magazine rounding, 2026-11-08 night)
The user pasted a community Kuva Tonkor guide with an arsenal screenshot (magazine 2 with Primed Magazine Warp). The engine kept 1 × 1.55 = 1.55 rounds and valued Magnetic Capacity's +40% as 1.4; the wiki rounds to the nearest whole number → fixed in v2.02. Re-run (`r2_tonkor.json`, `r2_triv.json`, `ev2-4.json`), no frame:

| build | score | vs Zarr |
|---|---|---|
| Kuva Zarr #1 (user's riven) | 1.874 | 100% |
| Kuva Tonkor #1, no riven: Galvanized Chamber, Malignant Force, Primed Cryo Rounds, Critical Delay, Semi-Rifle Cannonade, Vital Sense, Primed Magazine Warp, Radiated Reload + Primary Merciless, heat 60% (viral + heat) | 1.623 | 87% |
| community build, author's pick (Semi-Rifle Cannonade instead of Amalgam Serration), toxin 60% | 1.276 | 68% |
| community build as in the screenshot (Amalgam Serration, toxin 25%) | 0.903 | 48% |
| Kuva Tonkor + max riven (crit damage / damage / spliced corrosive) | 3.214 | 172% |
| Kuva Ogris #1 (user's riven) | 0.443 | 24% |

- Old v2.01 #1 (Magnetic Capacity alone, 1.4 → 1 round) drops 1.453 → 1.127.
- Slot checks on the Tonkor #1: Radiated Reload → Primed Firestorm 92.4%; heat valence + Malignant Force → toxin valence + Hunter Munitions (viral + slash) 77.7%; Semi-Rifle Cannonade → Amalgam Serration 96.4%; remove Primed Magazine Warp 64.0%.
- Cyte-09 without Resupply: Tonkor 3.11 (17.5% of Zarr's 17.74 with Resupply), unchanged.
