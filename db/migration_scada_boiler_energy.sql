-- ============================================================
-- Migration: SCADA, Boiler & Energy Fulfillment (Ph25)
-- ============================================================

CREATE TABLE IF NOT EXISTS boiler_performance_logs (
  id                  SERIAL PRIMARY KEY,
  log_time            TIMESTAMPTZ NOT NULL,
  steam_flow_kgh      NUMERIC(10,2) NOT NULL,
  steam_pressure_bar  NUMERIC(6,2) NOT NULL,
  feedwater_temp_c    NUMERIC(5,2) NOT NULL,
  flue_gas_temp_c     NUMERIC(5,2),
  husk_consumed_kg    NUMERIC(10,2) NOT NULL,
  blowdown_rate_pct   NUMERIC(4,2) DEFAULT 0,
  efficiency_pct      NUMERIC(5,2),
  logged_by           INTEGER REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(log_time)
);

CREATE TABLE IF NOT EXISTS section_energy_allocations (
  id                  SERIAL PRIMARY KEY,
  allocated_date      DATE NOT NULL,
  section_id          INTEGER REFERENCES sections(id),
  power_kwh           NUMERIC(12,2) DEFAULT 0,
  steam_mt            NUMERIC(10,2) DEFAULT 0,
  water_kl            NUMERIC(10,2) DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(allocated_date, section_id)
);
