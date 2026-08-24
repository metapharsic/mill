# 2026-08-24 — Indent Plant Section, Machine & Digital Twin Roll Selection Synchronization

## Root-Cause Analysis
1. In `Indent.jsx`, `const [sectionEquipment, setSectionEquipment]` was missing from the state tree and not fetched during initialization, which prevented machinery roll / equipment components from being populated.
2. The Raise Indent form had a fragmented layout where Plant Section and Machine dropdowns were detached from the 725 registered machinery roll assemblies and Digital Twin specifications (bearing size, lock nut, belt no, shaft size).
3. Line Items lacked two-way synchronization: selecting a material did not auto-fill or suggest the mapped plant section/machine, and component fitment location had to be manually typed rather than selected from the section's roll catalog.

---

## Solutions & Wiring Implemented
1. **State & API Data Loading ([`Indent.jsx`](../frontend/src/pages/Indent.jsx))**:
   * Added `sectionEquipment` state and loaded all 725 digital twin equipment and rolls from `/api/master/section-equipment`.
   * Loaded registered machine units (`PM1`, `PM2`, `AUX`) and plant sections.
2. **Synchronized Plant Section & Machinery Allocation Panel**:
   * **🏭 Plant Section / Process Area**: Searchable selector with process icons (🕸️ Wire, 🔄 Press, ☀️ Pre-Dryer, etc.), section code, and owning department.
   * **⚡ Target Machine Unit**: Searchable selector for registered paper machines (`PM1`, `PM2`).
   * **⚙️ Machinery Roll / Equipment Component**: Filtered dynamically to the selected section's rolls. Displays Tag code, Roll Name, and live specs (`⚙️ Bearing: 23234K | Nut: KM 34 | Belt: C-144`).
   * **Digital Twin Fitment Preview**: Inline context card displays the mechanical parameters of the chosen equipment component.
3. **Line Items Two-Way Auto-Sync**:
   * Selecting a material automatically detects its mapped section/machine and syncs the form.
   * `Position / Mechanical Fitment Location` provides an auto-complete datalist of the selected section's rolls & equipment while allowing custom free-text fitment locations.
4. **Verification**:
   * Frontend built in 7.81s with 0 errors.
   * Multi-agent validation suite passed 45/45 assertions on live database.
