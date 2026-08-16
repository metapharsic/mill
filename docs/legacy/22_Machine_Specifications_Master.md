# MK Paper Mill — Machine & Section Specification Master Reference

**Scope:** 500–1000+ TPD integrated paper mill. Trim width 5–8 m, speed 1000–2000 mpm.
**Authority:** All section detail in PlantSection.jsx, section_equipment, section_process_readings, and section_kpi_snapshots tables MUST conform to specs below.
**DB Mapping:** See `.cursorrules` §25 (Plant Sections Module) for DB schema, API routes, and KPI JSONB keys.

---

## Universal Specification Standards (ALL Sections)

Every section/machine documentation must include:

1. **General Info:** Equipment tag no. (format: `{SECTION_CODE}-{TYPE}-{NNN}`), OEM, model, serial no., year, location.
2. **Design Specs:** Capacity, dimensions, MOC, design pressure/temp, power rating.
3. **Operating Parameters:** Normal / min / max with alarm and trip setpoints.
4. **P&ID and GA Drawings** reference.
5. **BOM:** Spare parts list linked to materials table (material_id).
6. **Lubrication Schedule:** Points, lubricant type, frequency.
7. **Maintenance Plan:** PM (daily/weekly/monthly/annual), Predictive (vibration, thermography, oil analysis), Corrective.
8. **SOPs:** Startup, normal, shutdown, emergency, changeover, cleaning — stored in `section_sops` table.
9. **Safety:** LOTO, PPE, interlock list, F&G detection.
10. **Electrical & Control:** Motor data, drive type, control philosophy, PLC/DCS tag list.
11. **QC Linkage:** Tests done at this stage linked to `quality_tests`.
12. **Documentation:** Manuals, datasheets, test certificates, calibration records.
13. **Digital Integration:** SCADA tags, historian, CBM sensors, indent integration.
14. **Compliance:** Factories Act, IBR (boilers), PESO, CPCB, ISO 9001/14001/45001/50001.
15. **KPI Targets:** OEE ≥ 85%, MTBF, MTTR, First-Pass Yield, Energy Index.

---

## 🌐 1. All Sections (Plant-Wide / CCR)

**Purpose:** Centralized plant-wide command, monitoring, aggregation.

**Must Contain:**
- **CCR:** DCS (Honeywell/ABB/Siemens/Valmet DNA), redundant servers, large mimic video wall, operator HMIs.
- **Plant Network:** Industrial Ethernet (Profinet/EtherNet-IP), OPC-UA gateways, cybersecurity firewalls (IEC 62443).
- **Plant Master DB:** Real-time historian (PI System, Aveva), event logger, MES integration.
- **Power Distribution:** Main HT substation (33/11 kV), transformers, PCC/MCC, UPS, DG backup.
- **Plant Air & Utility Headers:** Instrument air, service air, fire water, DM water, cooling water.
- **Safety Systems:** F&G detection, ESD, fire hydrants, sprinklers, evacuation alarms.
- **Plant Documentation:** P&IDs, SLDs, equipment registers, calibration master list.

**Key KPIs:** Plant OEE, MTBF, MTTR, First-Pass Yield, Energy Index (kWh/T), Specific Steam (T/T), Water (m³/T), TRIR.

---

## 🪵 2. Pulp Mill Section (`PULP`)

**Purpose:** Convert raw fiber to clean refined pulp.

**Equipment (tag prefix PULP-):**
| Tag | Equipment | Key Specs |
|-----|-----------|-----------|
| PULP-HP-001 | Hydrapulper | 25–50 m³, vertical/horizontal |
| PULP-DP-001 | Drum Pulper | OCC line |
| PULP-HD-001 | HD Cleaner | Ceramic apex |
| PULP-SC-001 | Coarse Pressure Screen | Slot 1.4–1.8 mm |
| PULP-SF-001 | Fine Screen | Slot 0.15–0.25 mm |
| PULP-DD-001 | Double-Disc Refiner | VFD drive, plate gap control |
| PULP-DF-001 | Disc Filter | Thickening |
| PULP-SP-001 | Screw Press | Thickening |

**Operating Parameters:**
- Freeness: 300–550 mL CSF / 20–40 °SR
- Consistency by stage: Pulping 3–5%, Cleaning 0.8–1.2%, Refining 3–4%
- pH: 6.5–8.5
- Brightness: 55–80 %ISO (grade dependent)
- Ash content: 1–25% (grade dependent)
- Production: 50–200 TPD per line

**Controls:** Consistency loops, level loops, refiner SEC loop (kWh/T), brightness control.
**Chemicals:** NaOH, H₂O₂, surfactants, deinking agents.
**Safety:** Confined space entry for chests, LOTO, explosion-proof motors (dust risk).

---

## 🌀 3. Centricleaner Section (`CENTRI`)

**Purpose:** Remove fine heavy/light contaminants before headbox.

**Equipment (tag prefix CENTRI-):**
| Tag | Equipment | Key Specs |
|-----|-----------|-----------|
| CENTRI-CL-001 | Cleaner Bank Stage 1 | Forward, PU/ceramic cones |
| CENTRI-CL-002 | Cleaner Bank Stage 2 | Forward |
| CENTRI-CL-003 | Cleaner Bank Stage 3 | Reverse |
| CENTRI-CL-004 | Cleaner Bank Stage 4 | Forward |
| CENTRI-CL-005 | Cleaner Bank Stage 5 | Reverse |
| CENTRI-DA-001 | Deaeration Tank | With vacuum system |

**Operating Parameters:**
- Stages: 3–5 (forward + reverse)
- Inlet pressure: 2.5–3.0 bar
- ΔP per stage: 1.2–1.5 bar
- Reject rate: 10–15% per stage
- Capacity: per line LPM rating

**Controls:** Pressure transmitters inlet/outlet, ΔP control, reject flow control valve, consistency.
**Instrumentation:** Sight glasses, flow meters, consistency sensors.
**Safety:** Pressure relief, isolation valves, splash guards.

---

## 🕸️ 4. Wire Section / Forming (`WIRE`)

**Purpose:** Form sheet from dilute stock.

**Equipment (tag prefix WIRE-):**
| Tag | Equipment | Key Specs |
|-----|-----------|-----------|
| WIRE-HB-001 | Headbox | Hydraulic dilution-controlled, CD profile actuators |
| WIRE-BR-001 | Breast Roll | — |
| WIRE-HF-001..N | Hydrofoils | Adjustable angle |
| WIRE-SB-001 | Suction Box (low vac) | 10–30 kPa |
| WIRE-SB-002 | Suction Box (high vac) | 30–50 kPa |
| WIRE-CR-001 | Couch Roll | Suction, 50–70 kPa |
| WIRE-WF-001 | Forming Fabric | Multi-layer polyester |

**Operating Parameters:**
- Slice opening: 8–25 mm
- Jet velocity: grade/speed dependent
- Jet-wire ratio: 0.98–1.02
- Basis weight range: 40–400 GSM
- First-pass retention: 65–80%
- Total retention: 85–95%
- Wire speed: 1000–2000 mpm

**Controls:** Headbox pressure/level, dilution profile, slice CD profile, vacuum levels, retention loop.
**Instrumentation:** Basis weight scanner, moisture sensor, consistency, formation index sensor.
**Utilities:** Vacuum, fresh & white water, HP shower water (filtered, <50 µm).
**Safety:** Wire run guards, emergency stops, walkway gratings.

---

## 💨 5. Vacuum Section (`VACUUM`)

**Purpose:** Generate process vacuum for forming, pressing, felt conditioning.

**Equipment (tag prefix VACUUM-):**
| Tag | Equipment | Key Specs |
|-----|-----------|-----------|
| VACUUM-LP-001..N | Liquid Ring Vacuum Pump | High efficiency |
| VACUUM-TB-001..N | Turbo Blower | Energy-efficient option |
| VACUUM-DL-001 | Drop-Leg Tank | Separator |
| VACUUM-SW-001 | Seal Water Tank | With cooling |

**Operating Parameters (vacuum levels):**
| Element | Vacuum (kPa) |
|---------|-------------|
| Foils | 10–30 |
| Flat boxes | 30–50 |
| Couch roll | 50–70 |
| Uhle boxes | 40–60 |

- Airflow: per pump design (m³/min)
- Seal water flow: per pump (m³/h)
- Seal water temp: <35°C

**Controls:** Vacuum control loops, seal water flow/temp control.
**Utilities:** Cooling water, fresh water for seal.
**Safety:** Relief valves, noise enclosures, hot surface guards.

---

## 🗜️ 6. Press Section (`PRESS`)

**Purpose:** Mechanically dewater sheet from ~20% → 45–50% dryness.

**Equipment (tag prefix PRESS-):**
| Tag | Equipment | Key Specs |
|-----|-----------|-----------|
| PRESS-PK-001 | Pickup Press | — |
| PRESS-1P-001 | 1st Main Press | Nip load 80–200 kN/m |
| PRESS-2P-001 | 2nd Main Press | Nip load 150–350 kN/m |
| PRESS-SH-001 | Shoe Press | Extended nip, high dryness |
| PRESS-FL-001..N | Press Felts | Multi-layer, per position |
| PRESS-UB-001..N | Uhle Boxes | Per felt position |

**Operating Parameters:**
- Nip load: 80–350 kN/m
- Shoe press dryness target: ≥50%
- Felt permeability: 80–150 cfm (new), >60 cfm (minimum)
- Post-press dryness target: 45–52%

**Controls:** Nip load profile (I-roll), felt moisture, vibration monitoring (CBM critical).
**Instrumentation:** Nip profile sensor, felt moisture (microwave), vibration probes.
**Utilities:** Hydraulic oil system, shower water, vacuum.
**Safety:** Nip guards, emergency hydraulic release, LOTO for felt change.

---

## 🏃 7. Unirun Section (`UNIRUN`)

**Purpose:** Closed-draw transfer of sheet from press to first dryer.

**Equipment (tag prefix UNIRUN-):**
| Tag | Equipment | Key Specs |
|-----|-----------|-----------|
| UNIRUN-VR-001 | Vacuum Transfer Roll | — |
| UNIRUN-UF-001 | Single-Felt Loop | Pickup, guide, stretcher, auto-guide |

**Operating Parameters:**
- Felt tension: 4–8 kN/m
- Transfer vacuum: 30–50 kPa
- Speed differential: ±2% from wire speed

**Controls:** Tension control, vacuum control, auto-guider.
**Safety:** Guards, sheet break detection.

---

## 🔥 8. Pre Dryer Section (`PREDRYER`)

**Purpose:** Bulk evaporation; raise dryness from ~50% to ~92–95%.

**Equipment (tag prefix PREDRYER-):**
| Tag | Equipment | Key Specs |
|-----|-----------|-----------|
| PREDRYER-DC-001..N | Dryer Cylinders | 30–50 cyl, 1.5–1.8 m dia, cast iron |
| PREDRYER-DF-001..N | Dryer Fabrics | Single/double-tier synthetic |
| PREDRYER-BV-001..N | Blow Boxes (PV) | Pocket ventilation |
| PREDRYER-FT-001..N | Flash Tanks | Per steam group |
| PREDRYER-TC-001..N | Thermocompressors | Blow-through recovery |
| PREDRYER-HD-001 | Hood | Closed insulated, AHU with heat recovery |

**Steam Groups:** 3–6 groups, pressure cascade:
| Group | Pressure (bar) | Function |
|-------|---------------|----------|
| G1 | 1.5–2.0 | Initial drying |
| G2 | 2.5–3.5 | Mid drying |
| G3 | 4.0–6.0 | Main drying |
| G4–G6 | 6.0–10.0 | Final pre-dryer |

**Operating Parameters:**
- Steam pressure range: 1–10 bar (by group)
- Cylinder surface temp: 90–175°C
- Evaporation rate: 25–45 kg/m²·h
- Hood dew point: 55–65°C
- Specific steam: 1.4–1.6 T/T paper

**Controls:** Steam pressure cascade, ΔP across syphons, hood humidity, moisture profile (CD).
**Instrumentation:** Steam P/T, ΔP, IR moisture scanner, hood RH, vibration on doctors.
**Safety:** Hot surface guards, hood access interlocks, steam relief valves.

---

## 📏 9. Size Press Section (`SIZEPRESS`)

**Purpose:** Apply surface starch/sizing for strength and printability.

**Equipment (tag prefix SIZEPRESS-):**
| Tag | Equipment | Key Specs |
|-----|-----------|-----------|
| SIZEPRESS-SP-001 | Film Size Press (MSP) | Metering rod beds |
| SIZEPRESS-AP-001 | Applicator Rolls | 2 rolls |
| SIZEPRESS-CP-001 | Catch Pans | Starch recirculation |
| SIZEPRESS-SL-001 | Starch Supply Lines | Heated/insulated |

**Operating Parameters:**
- Starch solids: 8–14%
- Viscosity: 60–120 cP at operating temp
- Temperature: 60–70°C
- Pickup: 1–4 g/m² per side
- Roll nip load: 30–80 kN/m

**Controls:** Pickup control, viscosity, temperature, pan level.
**Instrumentation:** Inline viscometer, temperature, level, flow.
**Safety:** Hot surface guards, sheet break detection, fire protection (starch combustible).

---

## 🍳 10. Size Kitchen Section (`SIZEKITCHEN`)

**Purpose:** Prepare and supply surface sizing solution.

**Equipment (tag prefix SIZEKITCHEN-):**
| Tag | Equipment | Key Specs |
|-----|-----------|-----------|
| SIZEKITCHEN-JC-001 | Jet Cooker | Continuous, 130–145°C, 5–7 bar |
| SIZEKITCHEN-FT-001 | Flash Tank | Post-cooker |
| SIZEKITCHEN-SP-001 | Slurry Prep Tank | With agitator |
| SIZEKITCHEN-HT-001 | Holding Tank | With agitator |
| SIZEKITCHEN-AT-001..N | Additive Tanks | AKD/ASA/OBA/dyes |
| SIZEKITCHEN-MP-001..N | Metering Pumps | Additive dosing, ±1% accuracy |

**Operating Parameters:**
- Cooking temperature: 130–145°C
- Residence time: 30–60 s in cooker
- Solids %: 8–14%
- Viscosity stability: ±5 cP
- Additive dosing accuracy: ±1%

**Controls:** Temperature, solids, viscosity, level, additive flow loops.
**Utilities:** Steam, water, additives.
**Safety:** Hot water/steam burn protection, chemical handling PPE, fire protection.

---

## ☀️ 11. Post Dryer Section (`POSTDRYER`)

**Purpose:** Final drying after size press to target moisture (5–7%).

**Equipment:** Same types as Pre-Dryer (cylinders, fabrics, steam system, PV, hood, doctors). Typically 8–15 cylinders.

**Operating Parameters:**
- Steam pressure: lower than pre-dryer (2–5 bar)
- Exit moisture target: 5–7%
- CD moisture profile: 2σ ≤ 0.3%
- Optional IR/Air-foil dryers: for CD profile correction

**Controls:** Final moisture loop (cross-coupled with reel scanner), CD profile control.
**Instrumentation:** Final moisture scanner, IR profiler if used.

---

## 🛢️ 12. Calender Section (`CALENDER`)

**Purpose:** Improve surface smoothness, gloss, and caliper uniformity.

**Equipment (tag prefix CALENDER-):**
| Tag | Equipment | Key Specs |
|-----|-----------|-----------|
| CALENDER-HC-001 | Hard Nip Machine Calender | Steel rolls |
| CALENDER-SC-001 | Soft Calender | Polymer + heated steel |
| CALENDER-NF-001 | NipcoFlex (zone-controlled) | If premium grade |
| CALENDER-HS-001 | Hydraulic Loading System | — |

**Operating Parameters:**
- Nip load: 50–400 kN/m
- Roll temperature: 80–200°C
- Number of nips: 2–10 (grade dependent)
- Sheet entry moisture: 4–7%
- Caliper tolerance: ±2% of target

**Controls:** Nip load profile, roll temperature, caliper profile (steam showers/induction).
**Instrumentation:** Caliper scanner, gloss/smoothness sensor, roll temp, vibration.
**Safety:** Nip guards, hot surface guards, emergency hydraulic dump.

---

## ⭕ 13. Pope Reel Section (`POPE`)

**Purpose:** Wind finished sheet onto parent (jumbo) reel.

**Equipment (tag prefix POPE-):**
| Tag | Equipment | Key Specs |
|-----|-----------|-----------|
| POPE-RD-001 | Reel Drum | Driven, rubber-covered |
| POPE-PA-001 | Primary Arms | Pneumatic/hydraulic loading |
| POPE-SA-001 | Secondary Arms | — |
| POPE-SL-001 | Spool Loader | Auto spool loading |
| POPE-TU-001 | Turn-up System | Air/tape/water-jet automatic |

**Operating Parameters:**
- Max reel diameter: 2.5–3.5 m
- Max reel weight: 25–60 T
- Turn-up success rate: >98%
- Reel hardness: 60–90 (Schmidt) across width

**Controls:** Nip load, center torque ratio, turn-up sequence.
**Instrumentation:** Reel hardness scanner (Schmidt), diameter, load cells, vibration.
**Safety:** Reel ejection guards, lockable spool area, anti-collision interlocks.

---

## 🔄 14. Rewinder Section (`REWINDER`)

**Purpose:** Slit and rewind parent reel into customer rolls.

**Equipment (tag prefix REWINDER-):**
| Tag | Equipment | Key Specs |
|-----|-----------|-----------|
| REWINDER-UW-001 | Unwind Stand | Brake/regenerative drive |
| REWINDER-SK-001 | Slitter Section | Shear/score/razor knives, auto-positioning |
| REWINDER-BR-001 | Bow/Spreader Rolls | Web spreading |
| REWINDER-WD-001 | Winding Drums | Surface or center-surface |
| REWINDER-CL-001 | Core Loader | Auto core handling |
| REWINDER-TE-001 | Trim Chopper | Trim & dust extraction |

**Operating Parameters:**
- Operating speed: 1500–2500 mpm
- Max roll diameter: 1.2–1.5 m
- Trim widths: per customer order
- Tension range: per grade specification

**Controls:** Tension, winding hardness, slitter positioning, auto sequencing.
**Instrumentation:** Tension load cells, diameter sensors, edge/speed encoders.
**Safety:** Slitter guards, light curtains, e-stops, dust extraction interlock.

---

## 🧪 15. Starch Kitchen Section (`STARCHKITCHEN`)

**Purpose:** Prepare cationic starch for wet-end (retention/strength) addition.

**Equipment (tag prefix STARCHKITCHEN-):**
| Tag | Equipment | Key Specs |
|-----|-----------|-----------|
| STARCHKITCHEN-JC-001 | Cationic Starch Cooker | Jet cooker, continuous flow |
| STARCHKITCHEN-ST-001 | Slurry Tank | — |
| STARCHKITCHEN-HT-001 | Holding Tank | — |
| STARCHKITCHEN-DL-001 | Dosing Loop | With metering pumps |

**Operating Parameters:**
- Cationic charge: 0.2–0.5 meq/g
- Solids %: 3–8%
- Cooking temperature: 130–140°C
- Dosing rate: 5–20 kg/T paper

**Controls:** Temperature, solids, dosing flow.
**Safety:** Same as Size Kitchen.

---

## 💧 16. Steam & Condensate Section (`STEAMCOND`)

**Purpose:** Distribute steam to dryers and recover condensate.

**Equipment (tag prefix STEAMCOND-):**
| Tag | Equipment | Key Specs |
|-----|-----------|-----------|
| STEAMCOND-HP-001 | HP Steam Header | Main line |
| STEAMCOND-MP-001 | MP Steam Header | Reduced pressure |
| STEAMCOND-LP-001 | LP Steam Header | Low-pressure users |
| STEAMCOND-PRV-001..N | PRVs & Desuperheaters | Pressure/temp control |
| STEAMCOND-TC-001..N | Thermocompressors | Blow-through steam recovery |
| STEAMCOND-FT-001..N | Flash Tanks | Per pressure level |
| STEAMCOND-CT-001 | Condensate Tank | With makeup connection |
| STEAMCOND-CP-001 | Condensate Pumps | Return to boiler |
| STEAMCOND-TR-001..N | Steam Traps | Per cylinder group |

**Operating Parameters:**
- Condensate return target: >85%
- Blow-through steam: <10%
- Thermocompressor efficiency: >90%
- Steam trap monitoring: acoustic/thermal, weekly audit

**Controls:** Pressure cascade, level, ΔP control.
**Instrumentation:** P/T/flow on all lines, condensate conductivity, sight glasses.
**Safety:** Safety valves, water hammer protection, hot surface insulation.

---

## 🍀 17. ETP Section (`ETP`)

**Purpose:** Treat mill effluent for compliant discharge or ZLD reuse.

**Equipment (tag prefix ETP-):**
| Tag | Equipment | Key Specs |
|-----|-----------|-----------|
| ETP-BS-001 | Bar Screen | — |
| ETP-GC-001 | Grit Chamber | — |
| ETP-PC-001 | Primary Clarifier | With fiber recovery |
| ETP-EQ-001 | Equalization Tank | Flow balancing |
| ETP-AT-001 | Aeration Tank | Diffused air / MBBR / SBR |
| ETP-SC-001 | Secondary Clarifier | — |
| ETP-DAF-001 | DAF Unit | Tertiary |
| ETP-SF-001 | Sand Filter | Tertiary |
| ETP-UF-001 | UF Membrane | ZLD stage |
| ETP-RO-001 | RO System | ZLD stage |
| ETP-ST-001 | Sludge Thickener | — |
| ETP-BP-001 | Belt Press | Sludge dewatering |

**Operating Parameters (discharge limits — CPCB norms):**
| Parameter | Inlet (typical) | Outlet Target |
|-----------|----------------|---------------|
| BOD | 500–2000 ppm | <30 ppm |
| COD | 1500–5000 ppm | <250 ppm |
| TSS | 500–2000 ppm | <100 ppm |
| pH | 5.0–9.0 | 6.5–8.5 |
| Color | Dark | Acceptable |

- MLSS: 2000–4000 mg/L
- F/M ratio: 0.05–0.25 kg BOD/kg MLSS/day
- SRT: 5–20 days
- DO in aeration: >2 mg/L

**Controls:** pH, DO, level, flow, dosing loops.
**Instrumentation:** Online BOD/COD/TSS analyzers, DO/pH/ORP sensors, flow, level.
**Safety:** H₂S detection, confined space SOPs, chemical PPE.

---

## 🌋 18. Boiler Section (`BOILER`)

**Purpose:** Generate steam (and co-gen power) for the mill.

**Equipment (tag prefix BOILER-):**
| Tag | Equipment | Key Specs |
|-----|-----------|-----------|
| BOILER-BO-001 | Main Boiler | AFBC/CFBC, 80–250 TPH |
| BOILER-EC-001 | Economizer | Flue gas heat recovery |
| BOILER-APH-001 | Air Preheater | — |
| BOILER-SH-001 | Superheater | Steam temp control |
| BOILER-FD-001 | FD Fan | Forced draft |
| BOILER-ID-001 | ID Fan | Induced draft |
| BOILER-PA-001 | PA Fan | Primary air |
| BOILER-ESP-001 | ESP / Bag Filter | APCDs |
| BOILER-DM-001 | DM Plant | Deaerator + BFP |
| BOILER-TG-001 | Steam Turbine + Generator | Cogen (if installed) |
| BOILER-SB-001..N | Soot Blowers | Wall + long-retractable |

**Operating Parameters:**
- Steam capacity: 80–250 TPH
- Steam pressure: 45–110 bar
- Steam temperature: 450–540°C
- Boiler efficiency: >85%
- Drum level control: 3-element (steam flow, feedwater flow, drum level)

**Emissions (CPCB norms):**
| Parameter | Limit |
|-----------|-------|
| PM | <30 mg/Nm³ |
| SO₂ | <600 mg/Nm³ |
| NOₓ | <600 mg/Nm³ |

**Controls:** Drum level (3-element), combustion control, steam temp control, O₂ trim.
**Instrumentation:** Drum level (redundant), P/T transmitters, O₂/CO analyzers, CEMS, vibration monitoring on fans/turbines.
**Safety:** Safety valves (IBR certified), interlocks, flame detectors, fire protection, gauge glasses (redundant), ESD.

---

## 🔬 19. Lab Section (`LAB`)

**Purpose:** Quality testing of raw materials, in-process, and finished paper.

**Equipment (tag prefix LAB-):**
| Tag | Equipment | Standard |
|-----|-----------|----------|
| LAB-FR-001 | Freeness Tester (SR/CSF) | TAPPI T227 |
| LAB-FA-001 | Fiber Analyzer (L&W) | ISO 16065 |
| LAB-ZP-001 | Zeta Potential | — |
| LAB-GS-001 | GSM Balance | ISO 536 |
| LAB-MC-001 | Micrometer | ISO 534 |
| LAB-TS-001 | Tensile Tester (L&W) | ISO 1924 |
| LAB-BT-001 | Burst Tester (Mullen) | ISO 2758 |
| LAB-TR-001 | Tear Tester (Elmendorf) | ISO 1974 |
| LAB-RC-001 | RCT / CMT / SCT | ISO 12192 |
| LAB-ST-001 | Stiffness (Taber) | TAPPI T489 |
| LAB-CB-001 | Cobb Tester | ISO 535 |
| LAB-BR-001 | Brightness Meter (Elrepho) | ISO 2470 |
| LAB-GL-001 | Gloss Meter | ISO 8254 |
| LAB-SM-001 | Smoothness (Bendtsen/PPS) | ISO 8791 |
| LAB-PH-001 | pH Meter | — |
| LAB-AF-001 | Ash Furnace | ISO 1762 |
| LAB-MB-001 | Moisture Balance | — |
| LAB-VI-001 | Viscometer | — |

**Integration:** All testers networked to LIMS → results flow to `quality_tests` table.
**Utilities:** Power, DM water, N₂ gas, compressed air.
**Safety:** Fume hood, chemical storage, eye wash, fire extinguisher, MSDS, PPE.

---

## 🏗️ 20. Cranes Section (`CRANES`)

**Purpose:** Material handling — raw material, finished reels, maintenance lifts.

**Equipment (tag prefix CRANES-):**
| Tag | Type | Key Specs |
|-----|------|-----------|
| CRANES-EOT-001 | EOT Crane (machine hall) | 25–80 T SWL |
| CRANES-EOT-002 | EOT Crane (finishing area) | 10–25 T SWL |
| CRANES-GT-001 | Gantry Crane (yard) | 20–50 T SWL |
| CRANES-JB-001..N | Jib Cranes (workshops) | 1–5 T SWL |
| CRANES-MR-001..N | Monorails | 0.5–2 T, locally sited |

**Per-Crane Specifications:**
- SWL: 5–80 T (per duty)
- Span: 10–40 m
- Lift height: per bay requirement
- Duty class: M5–M8 (per FEM/ISO 4301)
- Hoist speed, trolley speed, bridge speed per design

**Controls:** VFD drives, load limiters, anti-sway, anti-collision.
**Instrumentation:** Load cells, limit switches, hour meter.
**Safety:** Daily operator checks, monthly inspection, annual 3rd-party load test certification, fall protection for crane access, SWL placard visible.

---

## 🌬️ 21. Compressors & Air Dryer Section (`COMPRESSORS`)

**Purpose:** Generate compressed air for instruments and service.

**Equipment (tag prefix COMP-):**
| Tag | Equipment | Key Specs |
|-----|-----------|-----------|
| COMP-OF-001..N | Oil-Free Screw Compressor | Instrument air |
| COMP-OI-001..N | Oil-Injected Screw Compressor | Service air |
| COMP-RD-001 | Refrigerated Dryer | Service air, dew point +3°C |
| COMP-DD-001 | Desiccant Dryer | Instrument air, dew point -40°C |
| COMP-RF-001 | Receiver (Instrument Air) | — |
| COMP-RS-001 | Receiver (Service Air) | — |
| COMP-F1-001 | Pre-Filter | Particulate |
| COMP-F2-001 | Coalescing Filter | Oil removal |
| COMP-F3-001 | Carbon Filter | Oil vapor <0.003 ppm |
| COMP-CD-001 | Condensate Separator | Oil-water separator |
| COMP-DM-001 | Distribution Ring Main | With ID-coded drops |

**Operating Parameters:**
- Discharge pressure: 6.5–8.0 bar
- Instrument air dew point: -40°C (pressure dew point)
- Service air dew point: +3°C
- Oil content (instrument air): <0.01 ppm
- Specific power: <6.5 kW/(Nm³/min) (target)

**Controls:** Master controller for sequencing and load sharing.
**Instrumentation:** Pressure, dew point, flow, temperature, oil content monitor.
**Utilities:** Cooling water, power.
**Safety:** Pressure relief, noise enclosures (≤75 dB at 1m), leak detection program (monthly).

---

## 🏪 22. Store Section (`STORE`)

**Purpose:** Central warehousing — spares, consumables, raw materials, chemicals. Direct integration with indent/issuance system.

**Layout Zones:**
| Zone | Contents |
|------|---------|
| Mechanical Spares | Bearings, seals, couplings, belts |
| Electrical Spares | Motors, switchgear, cables, contactors |
| Instrumentation | Transmitters, sensors, control valves |
| Consumables | Chemicals, lubricants, PPE, packing |
| Fabrics / Felts | Climate-controlled, flat storage |
| Bonded Store | Imported items, high-value |
| Hazardous Chemicals | Secondary containment, ventilation, MSDS |
| Scrap Yard | Segregated, labeled |

**Key Specifications:**
- Material Master: unique Part ID, UoM, classification (A/B/C + VED), shelf life, OEM, equivalent vendors, HSN code
- Stock Levels: Min, max, ROP, safety stock, lead time per item
- Stock Valuation: FIFO/Weighted Average
- Bin Location: Rack-Row-Shelf-Bin code (e.g., A-03-04-12)
- Cycle Counting: monthly ABC, annual full physical (target >98% accuracy)

**KPIs:**
- Inventory turnover ratio
- Stockout %
- Dead stock % (no movement >12 months)
- Fill rate (% indents fully issued same day)
- Indent-to-issue cycle time (target: <2 hours routine, immediate emergency)
- Inventory value (₹)
- Physical vs system accuracy (target >98%)

**Integration with PIIMAS:** Receives approved indent → checks stock → issues → deducts stock_ledger → triggers PRQ if below ROP.

**Safety:** FM200 for electronics store, sprinklers for general, MSDS display, chemical segregation (incompatibles separated), ergonomic lifting protocols, CCTV.

---

## Specification Parameters Quick-Reference (per `section_kpi_snapshots.kpi_data`)

| Section Code | Must-Capture Parameters | Target Range |
|-------------|------------------------|-------------|
| PULP | consistency_pct, freeness_csl, refiner_sec_kwh_t, brightness_iso, reject_pct | consistency 3–4%, freeness 300–450 mL |
| CENTRI | inlet_pressure_bar, dp_bar, reject_rate_pct, fiber_loss_pct | ΔP 1.2–1.5 bar |
| WIRE | retention_pct, couch_dryness_pct, wire_speed_mpm, vacuum_kpa | retention >75%, couch dry >20% |
| VACUUM | vacuum_kpa, seal_water_temp_c, motor_current_a, sheet_dryness_pct | per element table above |
| PRESS | post_press_dryness_pct, nip_load_knm, felt_permeability_cfm | dryness >48%, permeability >60 |
| UNIRUN | break_count_shift, runnability_index | breaks <2/shift |
| PREDRYER | steam_pressure_bar, moisture_pct_out, evap_rate_kg_m2h, hood_dewpoint_c | moisture out <12%, dewpoint 55–65°C |
| SIZEPRESS | starch_solids_pct, pickup_gsm_side, viscosity_cp, nip_load_knm | solids 8–14%, viscosity 60–120 cP |
| SIZEKITCHEN | cooking_temp_c, solids_pct, viscosity_cp, starch_consumption_kg_t | temp 130–145°C |
| POSTDRYER | moisture_pct_final, steam_pressure_bar, cd_profile_sigma | final moisture 5–7%, 2σ <0.3% |
| CALENDER | nip_load_knm, roll_temp_c, smoothness_bendtsen, caliper_um | caliper ±2% target |
| POPE | turn_up_success_pct, reel_hardness_schmidt, broke_pct | turn-up >98%, hardness 60–90 |
| REWINDER | speed_mpm, trim_loss_pct, roll_rejection_pct | trim loss <3% |
| STARCHKITCHEN | cooking_temp_c, solids_pct, dosing_rate_kg_t | dosing 5–20 kg/T |
| STEAMCOND | steam_pressure_bar, condensate_return_pct, trap_ok_count | condensate return >85% |
| ETP | ph, bod_ppm, cod_ppm, tss_ppm, do_ppm, mlss | per CPCB discharge limits |
| BOILER | steam_pressure_bar, steam_temp_c, drum_level_pct, o2_pct, efficiency_pct | efficiency >85% |
| LAB | tests_today, pass_rate_pct, coa_turnaround_min | pass rate >92%, TAT <60 min |
| CRANES | lifts_today, availability_pct, incident_free_hours | availability >95% |
| COMPRESSORS | discharge_pressure_bar, dew_point_c, loading_pct, leak_loss_pct | dew point -40°C IA, leak <5% |

---

## Document Index

| Doc | Contents |
|-----|---------|
| `00_Architecture.md` | Full stack architecture, DB overview |
| `09_DB_Reference.md` | All table schemas and constraints |
| `11_API_Reference.md` | Complete API route reference |
| `18_Store_Module_Complete.md` | Store / GRN / issuance full spec |
| `18C_Enhanced_Traceability_Design.md` | Installed asset traceability (future) |
| `21_PlantSections_Module.md` | Plant sections DB, routes, KPI schema |
| **`22_Machine_Specifications_Master.md`** | **THIS FILE — per-section equipment, specs, controls** |
| `Metapharsic_Master_2000_Item_CMMS_Ledger.xlsx` | 2000-item spare parts catalog |

---

*Last updated: 2026-06-30*
*Applies to: `C:/Project/MK Paper Mill` — PaperMES Platform*
