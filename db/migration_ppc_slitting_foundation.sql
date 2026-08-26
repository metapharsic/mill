-- ============================================================================
-- Migration: PPC Planning & Slitting-Rewinding Foundation (Phases 1 & 2)
-- Description: Creates 6 normalized tables for 2-stage paper manufacturing,
-- dynamic N-cut positions, mother-child genealogy, and ±0.5% mass balance gate.
-- ============================================================================

-- 1. PPC Master Production Plans
CREATE TABLE IF NOT EXISTS ppc_production_plans (
    id                  BIGSERIAL PRIMARY KEY,
    plan_number         VARCHAR(50) UNIQUE NOT NULL,       -- e.g. 'PPC-20260826-001'
    machine_id          INTEGER NOT NULL REFERENCES machines(id),
    target_date         DATE NOT NULL,
    grade_id            INTEGER NOT NULL REFERENCES grades(id),
    target_gsm          NUMERIC(6,2) NOT NULL,
    target_bf           NUMERIC(6,2) NOT NULL,
    usable_deckle_mm    NUMERIC(8,2) NOT NULL,             -- Max usable PM trim width (e.g. 2650.00)
    planned_tonnage_mt  NUMERIC(10,3) NOT NULL,
    status              VARCHAR(30) DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'OPTIMIZED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    created_by          INTEGER REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. PPC Slitting Patterns (Pattern Header)
CREATE TABLE IF NOT EXISTS ppc_slitting_patterns (
    id                  BIGSERIAL PRIMARY KEY,
    plan_id             BIGINT NOT NULL REFERENCES ppc_production_plans(id) ON DELETE CASCADE,
    pattern_number      INTEGER NOT NULL,                  -- Sequence within plan (1, 2, 3...)
    total_cut_width_mm  NUMERIC(8,2) NOT NULL,             -- Sum of all child cuts in this pattern
    planned_trim_mm     NUMERIC(8,2) NOT NULL,             -- usable_deckle_mm - total_cut_width_mm
    trim_percentage     NUMERIC(5,2) NOT NULL,             -- (planned_trim_mm / usable_deckle_mm) * 100
    sets_planned        INTEGER NOT NULL DEFAULT 1,        -- How many jumbo rolls/sets run this pattern
    sets_completed      INTEGER NOT NULL DEFAULT 0,
    status              VARCHAR(20) DEFAULT 'QUEUED'
                        CHECK (status IN ('QUEUED', 'ACTIVE', 'COMPLETED')),
    UNIQUE (plan_id, pattern_number)
);

-- 3. Dynamic N-Cut Positions (Child Table — Eliminates Fixed 5-Cut Limit)
CREATE TABLE IF NOT EXISTS ppc_pattern_cuts (
    id                  BIGSERIAL PRIMARY KEY,
    pattern_id          BIGINT NOT NULL REFERENCES ppc_slitting_patterns(id) ON DELETE CASCADE,
    cut_position        SMALLINT NOT NULL,                 -- Knife index: 1, 2, 3 ... N
    width_mm            NUMERIC(8,2) NOT NULL,             -- Customer cut width
    sales_order_id      INTEGER REFERENCES sales_orders(id),
    sales_order_item_id INTEGER,
    remarks             VARCHAR(150),
    UNIQUE (pattern_id, cut_position)
);

-- 4. Jumbo Reels (Mother Rolls Off Paper Machine)
CREATE TABLE IF NOT EXISTS jumbo_reels (
    id                  BIGSERIAL PRIMARY KEY,
    jumbo_number        VARCHAR(60) UNIQUE NOT NULL,       -- e.g. 'MK-JMB-20260826-PM1-001'
    machine_id          INTEGER NOT NULL REFERENCES machines(id),
    shift_id            INTEGER REFERENCES shifts(id),
    grade_id            INTEGER NOT NULL REFERENCES grades(id),
    gsm_actual          NUMERIC(6,2) NOT NULL,
    bf_actual           NUMERIC(6,2) NOT NULL,
    deckle_width_mm     NUMERIC(8,2) NOT NULL,
    gross_weight_kg     NUMERIC(10,3) NOT NULL,            -- Scale weighed off Pope Reel
    core_tare_weight_kg NUMERIC(8,3) DEFAULT 0.000,
    net_weight_kg       NUMERIC(10,3) GENERATED ALWAYS AS (gross_weight_kg - core_tare_weight_kg) STORED,
    speed_mpm           NUMERIC(8,2),
    moisture_pct        NUMERIC(5,2),
    status              VARCHAR(30) DEFAULT 'PRODUCED'
                        CHECK (status IN ('PRODUCED', 'MOUNTED_ON_REWINDER', 'SLIT_COMPLETED', 'REJECTED')),
    reconciliation_status VARCHAR(20) DEFAULT 'OPEN'
                        CHECK (reconciliation_status IN ('OPEN', 'BALANCED', 'VARIANCE_HELD', 'OVERRIDDEN')),
    variance_pct        NUMERIC(5,2),
    override_reason     TEXT,
    override_by         INTEGER REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Slit Reels (Finished Customer Reels Off Rewinder)
CREATE TABLE IF NOT EXISTS slit_reels (
    id                  BIGSERIAL PRIMARY KEY,
    reel_number         VARCHAR(70) UNIQUE NOT NULL,       -- e.g. 'MK-FIN-20260826-001-A'
    jumbo_reel_id       BIGINT NOT NULL REFERENCES jumbo_reels(id),
    pattern_id          BIGINT REFERENCES ppc_slitting_patterns(id),
    cut_position        SMALLINT NOT NULL,                 -- 1..N position across the deckle
    sales_order_id      INTEGER REFERENCES sales_orders(id),
    width_mm            NUMERIC(8,2) NOT NULL,
    diameter_cm         NUMERIC(6,2),
    planned_weight_kg   NUMERIC(10,3),                     -- Calculated via GSM * Area
    actual_weight_kg    NUMERIC(10,3) NOT NULL,            -- SCALE AUTHORITY (Weighbridge reading)
    weight_variance_kg  NUMERIC(10,3) GENERATED ALWAYS AS (actual_weight_kg - planned_weight_kg) STORED,
    barcode             VARCHAR(100) UNIQUE NOT NULL,
    quality_status      VARCHAR(30) DEFAULT 'PENDING'
                        CHECK (quality_status IN ('PENDING', 'APPROVED', 'REJECTED', 'HOLD')),
    rack_location       VARCHAR(50),
    dispatched          BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Rewinder Mass Balance & Waste Log
CREATE TABLE IF NOT EXISTS slitting_waste_log (
    id                  BIGSERIAL PRIMARY KEY,
    jumbo_reel_id       BIGINT UNIQUE NOT NULL REFERENCES jumbo_reels(id),
    edge_trim_kg        NUMERIC(10,3) NOT NULL DEFAULT 0.000, -- Physical Edge Trim (T)
    rewinder_broke_kg   NUMERIC(10,3) NOT NULL DEFAULT 0.000, -- Surface tears / splice broke
    core_waste_kg       NUMERIC(10,3) NOT NULL DEFAULT 0.000, -- Paper left on spool
    total_waste_kg      NUMERIC(10,3) GENERATED ALWAYS AS (edge_trim_kg + rewinder_broke_kg + core_waste_kg) STORED,
    credited_to_scrap   BOOLEAN DEFAULT FALSE,                -- Auto-credited back to hydrapulper
    logged_by           INTEGER REFERENCES users(id),
    logged_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Indexes for High-Performance Queries
CREATE INDEX IF NOT EXISTS idx_ppc_plans_date ON ppc_production_plans(target_date);
CREATE INDEX IF NOT EXISTS idx_ppc_patterns_plan ON ppc_slitting_patterns(plan_id);
CREATE INDEX IF NOT EXISTS idx_ppc_cuts_pattern ON ppc_pattern_cuts(pattern_id);
CREATE INDEX IF NOT EXISTS idx_jumbo_reels_date ON jumbo_reels(created_at);
CREATE INDEX IF NOT EXISTS idx_jumbo_reels_status ON jumbo_reels(status);
CREATE INDEX IF NOT EXISTS idx_slit_reels_jumbo ON slit_reels(jumbo_reel_id);
CREATE INDEX IF NOT EXISTS idx_slit_reels_order ON slit_reels(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_slit_reels_barcode ON slit_reels(barcode);

-- 8. Automated Mass Balance Trigger Function (±0.5% Tolerance Gate)
CREATE OR REPLACE FUNCTION fn_reconcile_jumbo_mass_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_jumbo_net_kg    NUMERIC(10,3);
    v_total_slit_kg   NUMERIC(10,3);
    v_total_waste_kg  NUMERIC(10,3);
    v_difference_kg   NUMERIC(10,3);
    v_tolerance_kg    NUMERIC(10,3);
    v_edge_trim_kg    NUMERIC(10,3);
BEGIN
    -- 1. Fetch Jumbo Net Weight
    SELECT net_weight_kg INTO v_jumbo_net_kg 
    FROM jumbo_reels WHERE id = NEW.jumbo_reel_id;

    -- 2. Sum Actual Finished Slit Reels
    SELECT COALESCE(SUM(actual_weight_kg), 0) INTO v_total_slit_kg 
    FROM slit_reels WHERE jumbo_reel_id = NEW.jumbo_reel_id;

    -- 3. Sum Rewinder Waste & Trim
    SELECT COALESCE(total_waste_kg, 0), COALESCE(edge_trim_kg, 0)
    INTO v_total_waste_kg, v_edge_trim_kg
    FROM slitting_waste_log WHERE jumbo_reel_id = NEW.jumbo_reel_id;

    -- 4. Calculate Absolute Difference & 0.5% Tolerance Band
    v_difference_kg := ABS(v_jumbo_net_kg - (v_total_slit_kg + v_total_waste_kg));
    v_tolerance_kg  := 0.005 * v_jumbo_net_kg;

    -- 5. Update Reconciliation Status
    IF v_difference_kg <= v_tolerance_kg THEN
        UPDATE jumbo_reels 
        SET reconciliation_status = 'BALANCED',
            variance_pct = ROUND((v_difference_kg / v_jumbo_net_kg) * 100, 2),
            status = 'SLIT_COMPLETED'
        WHERE id = NEW.jumbo_reel_id;

        -- 6. Auto-Credit Edge Trim to Scrap / Pulper Furnish Inventory
        IF v_edge_trim_kg > 0 AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scrap_inventory') THEN
            INSERT INTO scrap_inventory (scrap_type, weight_kg, source_module, reference_id, created_at)
            VALUES ('INTERNAL_EDGE_TRIM', v_edge_trim_kg, 'SLITTING_REWINDER', NEW.jumbo_reel_id, CURRENT_TIMESTAMP)
            ON CONFLICT DO NOTHING;
            
            UPDATE slitting_waste_log SET credited_to_scrap = TRUE WHERE jumbo_reel_id = NEW.jumbo_reel_id;
        END IF;
    ELSE
        UPDATE jumbo_reels 
        SET reconciliation_status = 'VARIANCE_HELD',
            variance_pct = ROUND((v_difference_kg / v_jumbo_net_kg) * 100, 2)
        WHERE id = NEW.jumbo_reel_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reconcile_slitting_waste ON slitting_waste_log;
CREATE TRIGGER trg_reconcile_slitting_waste
AFTER INSERT OR UPDATE ON slitting_waste_log
FOR EACH ROW EXECUTE FUNCTION fn_reconcile_jumbo_mass_balance();
