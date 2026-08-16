-- ============================================================
-- Migration: Add Daily Performance Statement (DPS) Ingest columns
-- Mapped to support spreadsheet import fields for wastewater, 
-- ETP flows, feedwater, condensate, water consumption.
-- ============================================================

ALTER TABLE daily_production_reports 
  ADD COLUMN IF NOT EXISTS start_time             VARCHAR(20),
  ADD COLUMN IF NOT EXISTS end_time               VARCHAR(20),
  ADD COLUMN IF NOT EXISTS gsm_raw                 VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bf_raw                  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS draw_avg                NUMERIC(8,2)   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS machine_speed_avg       NUMERIC(8,2)   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS moisture_pct_avg        NUMERIC(5,2)   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prv_pressure_temp       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pulper_running_minutes  INTEGER        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pulper_units            NUMERIC(12,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS etp_inlet_ppm           NUMERIC(8,2)   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS etp_outlet_ppm          NUMERIC(8,2)   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS etp_inlet_flow          NUMERIC(12,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS etp_outlet_flow          NUMERIC(12,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fresh_water_mt          NUMERIC(12,3)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feed_water_mt           NUMERIC(12,3)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS condensate_water_mt     NUMERIC(12,3)  DEFAULT 0;
