BEGIN;

-- ============================================================================
-- 1. LINK GATE PASSES TO PURCHASE ORDERS AND VENDORS
-- ============================================================================
ALTER TABLE gate_passes 
  ADD COLUMN IF NOT EXISTS po_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS challan_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50);

-- ============================================================================
-- 2. LINK GRN TO INWARD GATE PASS
-- ============================================================================
ALTER TABLE grn 
  ADD COLUMN IF NOT EXISTS gate_pass_id INTEGER REFERENCES gate_passes(id) ON DELETE SET NULL;

-- ============================================================================
-- 3. VENDOR BILLS (ACCOUNTS PAYABLE)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_bills (
  id SERIAL PRIMARY KEY,
  bill_number VARCHAR(50) UNIQUE NOT NULL,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE RESTRICT,
  po_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
  grn_id INTEGER REFERENCES grn(id) ON DELETE SET NULL,
  vendor_invoice_number VARCHAR(50),
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT CURRENT_DATE + 30,
  taxable_amount NUMERIC(15,2) DEFAULT 0,
  cgst_amount NUMERIC(15,2) DEFAULT 0,
  sgst_amount NUMERIC(15,2) DEFAULT 0,
  igst_amount NUMERIC(15,2) DEFAULT 0,
  total_tax NUMERIC(15,2) DEFAULT 0,
  roundoff NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL,
  paid_amount NUMERIC(15,2) DEFAULT 0,
  balance_amount NUMERIC(15,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'Pending Approval',
  remarks TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 4. MATERIAL REJECTIONS & RETURN TO VENDOR (RTV) ENGINE
-- ============================================================================
CREATE TABLE IF NOT EXISTS material_rejections (
  id SERIAL PRIMARY KEY,
  rejection_number VARCHAR(50) UNIQUE NOT NULL,
  grn_id INTEGER REFERENCES grn(id) ON DELETE SET NULL,
  po_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  material_id INTEGER REFERENCES materials(id) ON DELETE RESTRICT,
  qc_test_id INTEGER REFERENCES quality_tests(id) ON DELETE SET NULL,
  rejected_qty NUMERIC(12,3) NOT NULL CHECK (rejected_qty > 0),
  uom VARCHAR(20) NOT NULL,
  unit_price NUMERIC(12,2) DEFAULT 0,
  debit_amount NUMERIC(15,2) DEFAULT 0,
  rejection_reason TEXT NOT NULL,
  action_required VARCHAR(50) DEFAULT 'Return to Vendor' CHECK (action_required IN ('Return to Vendor', 'Scrap On Site', 'Supplier Rework', 'Replacement Pending')),
  status VARCHAR(30) DEFAULT 'Pending RTV' CHECK (status IN ('Pending RTV', 'Debit Note Raised', 'Gate Pass Created', 'Dispatched Out', 'Closed')),
  outward_gate_pass_id INTEGER REFERENCES gate_passes(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 5. INTER-STORE TRANSFERS (STO)
-- ============================================================================
CREATE TABLE IF NOT EXISTS store_transfers (
  id SERIAL PRIMARY KEY,
  transfer_number VARCHAR(50) UNIQUE NOT NULL,
  from_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE RESTRICT,
  to_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE RESTRICT,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(30) DEFAULT 'Requested' CHECK (status IN ('Requested', 'Approved', 'In Transit', 'Completed', 'Cancelled')),
  requested_by INTEGER REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),
  dispatched_by INTEGER REFERENCES users(id),
  received_by INTEGER REFERENCES users(id),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_transfer_items (
  id SERIAL PRIMARY KEY,
  transfer_id INTEGER REFERENCES store_transfers(id) ON DELETE CASCADE,
  material_id INTEGER REFERENCES materials(id) ON DELETE RESTRICT,
  qty NUMERIC(12,3) NOT NULL CHECK (qty > 0),
  uom VARCHAR(20) NOT NULL,
  batch_number VARCHAR(50),
  remarks TEXT
);

-- ============================================================================
-- 6. STORE RETURN VOUCHERS (SRV)
-- ============================================================================
CREATE TABLE IF NOT EXISTS store_returns (
  id SERIAL PRIMARY KEY,
  return_number VARCHAR(50) UNIQUE NOT NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE RESTRICT,
  indent_id INTEGER REFERENCES indents(id) ON DELETE SET NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(30) DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Inspected', 'Restocked', 'Rejected')),
  returned_by INTEGER REFERENCES users(id),
  inspected_by INTEGER REFERENCES users(id),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_return_items (
  id SERIAL PRIMARY KEY,
  return_id INTEGER REFERENCES store_returns(id) ON DELETE CASCADE,
  material_id INTEGER REFERENCES materials(id) ON DELETE RESTRICT,
  qty NUMERIC(12,3) NOT NULL CHECK (qty > 0),
  uom VARCHAR(20) NOT NULL,
  condition_grade VARCHAR(30) DEFAULT 'Good' CHECK (condition_grade IN ('Good', 'Repairable', 'Scrap')),
  action_taken VARCHAR(50) DEFAULT 'Restocked to Store',
  remarks TEXT
);

-- ============================================================================
-- 7. PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_gate_passes_po ON gate_passes(po_id);
CREATE INDEX IF NOT EXISTS idx_gate_passes_vendor ON gate_passes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_grn_gate_pass ON grn(gate_pass_id);
CREATE INDEX IF NOT EXISTS idx_vendor_bills_vendor ON vendor_bills(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_bills_status ON vendor_bills(status);
CREATE INDEX IF NOT EXISTS idx_material_rejections_po ON material_rejections(po_id);
CREATE INDEX IF NOT EXISTS idx_material_rejections_vendor ON material_rejections(vendor_id);
CREATE INDEX IF NOT EXISTS idx_material_rejections_grn ON material_rejections(grn_id);
CREATE INDEX IF NOT EXISTS idx_store_transfers_status ON store_transfers(status);
CREATE INDEX IF NOT EXISTS idx_store_returns_dept ON store_returns(department_id);

COMMIT;
