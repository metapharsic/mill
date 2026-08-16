# DPS Excel Import Module — Full Workflow & Rules

## Overview
Automates the ingestion of the Daily Performance Statement (DPS) spreadsheet from operations. Parses Excel date formats, time durations, and raw text entries to automatically upsert daily production reports and GSM breakups.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/dpsImport.js` | Express router and import logic (278 lines) |
| DB: `daily_production_reports` | Main header table updated |
| DB: `dpr_gsm_breakup` | Detail table for GSM/BF breakout updated |

## Database Tables
| Table | Purpose |
|---|---|
| `daily_production_reports` | Stores summary metrics per report date and machine ID |
| `dpr_gsm_breakup` | Stores sliced GSM and BF values extracted from raw text |

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/production/dpr/import` | Level 2+ | Uploads and processes a single DPS spreadsheet file (Max 5MB) |

---

## 1. Import Processing Pipeline

1. **Spreadsheet Ingestion:**
   * Utilizes `multer` memory storage. The spreadsheet file buffer is read directly by `xlsx`.
   * Only the first sheet (`workbook.SheetNames[0]`) is processed.
   * Empty rows are discarded via `xlsx.utils.sheet_to_json`.

2. **Keys Normalization:**
   * Keys are mapped case-insensitively, trimmed, and normalized to replace multiple spaces with a single space.

3. **Date & Machine Mapping:**
   * Dates are converted from Excel serial numeric format (using Excel epoch base date 30/12/1899) or parsed from dd/mm/yyyy and standard string formats. Rows missing a valid date are logged to `skipped`.
   * Machine name or code (e.g. "PM 1") is matched against the database `machines` table. If no match is found, the default active machine ID is selected.

4. **Duration Conversions:**
   * Running and breakdown durations (e.g. `12.5` hours or `"12:30"` format) are normalized into total running and breakdown minutes.

5. **DPR Header Upsert:**
   * The database record for the date and machine is upserted inside an active transaction using `ON CONFLICT (report_date, machine_id)`.
   * Fields updated include production metrics, run time, waste parameters, water intake, boiler feedwater/condensate weight, and ETP flow.

6. **GSM & BF Breakout Parsing:**
   * Slash-separated raw strings (e.g. `gsm_raw = "80/100/120"` and `bf_raw = "18/20/22"`) are split into individual values.
   * Prev-existing breakout values are purged (`DELETE FROM dpr_gsm_breakup WHERE report_id = $1`).
   * New values are inserted dynamically into `dpr_gsm_breakup`.

7. **Kafka Event:**
   * Publishes a `dpr.saved` event to the `mkpm.dpr.events` topic containing the report ID, date, machine ID, source, and user ID.

---

## 2. Spreadsheet Column Mapping Reference

The import engine maps normalized header variations to DB columns:

| Normalized Spreadsheet Header | Target Database Field | Description / Conversion |
|---|---|---|
| `date` | `report_date` | YYYY-MM-DD format |
| `machine` / `machine name` / `machine_name` | `machine_id` | Mapped against `machines.name` or `.code` |
| `machine production (ton) avg` / `production` / `pmc production` | `pmc_production_mt` | PMC production in Metric Tons |
| `running hrs` / `running hours` | `running_minutes` | Converted to integer minutes |
| `break down (hr)` / `breakdown hours` | `down_minutes` | Converted to integer minutes |
| `imported raw material (ton)` / `imported occ` | `furnish_occ_mt` | OCC raw material |
| `indian raw material (ton)` / `local occ` | `furnish_local_mt` | Indian waste paper |
| `total energy consumption` / `power units` | `power_units` | Total electrical energy units |
| `rice husk consumption (mt)` | `rice_husk_mt` | Fuel burnt |
| `total steam (tons)` | `total_steam_mt` | Steam units generated |
| `gsm` | `gsm_raw` | Raw slash-separated string |
| `bf` | `bf_raw` | Raw slash-separated string |
| `prv pressure / prv temp` | `prv_pressure_temp` | Raw text |
| `fresh water (etp + machine + pulpmill)` | `fresh_water_mt` | Fresh water intake |

---

## 3. Rules & Validation

1. **Transaction Integrity:** Every row of the spreadsheet is processed within a single PostgreSQL transaction (`BEGIN ... COMMIT`). If a database error occurs on any row, the entire batch is rolled back.
2. **Missing Dates:** Rows without a parseable date are skipped and returned in the `skipped` JSON list with details.
3. **Draft Status:** Imported reports are set to `'Draft'` status by default, requiring a manager to review and approve them in the UI.
4. **Failsafe Sequence:** Excel decimal values and time strings are handled concurrently. If formatting fails, values fall back to `0`.
