import React from 'react'
import {
  Factory, BadgeCheck, Wrench, Zap, Package, Boxes, Store as StoreIcon,
  ClipboardList, Recycle, ShoppingCart, Briefcase, Truck, Wallet,
  PackageCheck, Warehouse, UsersRound, ShieldCheck, Microscope, HardHat,
  BarChart3, Settings, UserCog, LayoutDashboard,
} from 'lucide-react'

const MODULE_INFO = {
  production:  { title: 'Production',          desc: 'Shift entry, reel tracking, downtime, speed, GSM, efficiency',                    icon: Factory },
  quality:     { title: 'Quality Control',      desc: 'GSM, moisture, burst factor, cobb value, incoming/process/final inspection',      icon: BadgeCheck },
  maintenance: { title: 'Maintenance',          desc: 'Preventive, breakdown, lubrication, MTTR, MTBF, spare parts',                    icon: Wrench },
  utility:     { title: 'Utility',              desc: 'Steam, boiler, power, DG, water plant, ETP, hourly readings',                    icon: Zap },
  rawmaterial: { title: 'Raw Material Store',   desc: 'Waste paper, pulp, chemicals, GRN, batch tracking, lot management',              icon: Package },
  inventory:   { title: 'Inventory',            desc: 'Stock ledger, FIFO/FEFO, ABC analysis, bin location, reorder alerts',            icon: Boxes },
  store:       { title: 'Store Management',     desc: 'Material receipt, issue, return, transfer, physical verification',               icon: StoreIcon },
  indent:      { title: 'Indent Management',    desc: 'Department indent → store verify → purchase approval → PO → GRN',               icon: ClipboardList },
  scrap:       { title: 'Scrap Management',     desc: 'Waste paper, rejected rolls, trim waste, chemical waste, scrap sale',            icon: Recycle },
  purchase:    { title: 'Purchase',             desc: 'Vendor management, RFQ, quotation comparison, PO, delivery tracking',            icon: ShoppingCart },
  sales:       { title: 'Sales',                desc: 'Orders, production allocation, dispatch planning, customer complaints',          icon: Briefcase },
  dispatch:    { title: 'Dispatch',             desc: 'Finished goods, truck loading, invoice, e-way bill, transport tracking',         icon: Truck },
  finance:     { title: 'Finance',              desc: 'Purchase/sales bills, costing, production cost, profit analysis',                icon: Wallet },
  packing:     { title: 'Packing',              desc: 'Packing entry, pallet, barcode, label printing',                                 icon: PackageCheck },
  fgwarehouse: { title: 'FG Warehouse',         desc: 'Location, rack, FIFO, dispatch planning',                                        icon: Warehouse },
  hr:          { title: 'HR & Payroll',         desc: 'Attendance, shift, leave, salary, contract labour, skill matrix',                icon: UsersRound },
  security:    { title: 'Security',             desc: 'Vehicle entry, visitor, material gate pass, outgoing material',                  icon: ShieldCheck },
  laboratory:  { title: 'Laboratory',           desc: 'Chemical testing, paper testing, raw material testing',                          icon: Microscope },
  ehs:         { title: 'EHS',                  desc: 'Safety, accidents, permits, PPE, incident reporting',                            icon: HardHat },
  admin:       { title: 'Administration',       desc: 'Approvals, audit logs, reports, system configuration',                          icon: Settings },
  users:       { title: 'User Management',      desc: 'Add users, assign roles and departments, manage access',                         icon: UserCog },
}

export default function Placeholder({ module, onNavigate }) {
  const info = MODULE_INFO[module] || { title: module, desc: 'Module under development', icon: BarChart3 }
  const Icon = info.icon || BarChart3

  return (
    <div style={styles.page}>
      <div style={styles.card} className="lift">
        <div style={styles.iconWrap}>
          <Icon size={40} strokeWidth={1.5} style={{ color: '#f4c84b' }} />
        </div>
        <h2 style={styles.title}>{info.title}</h2>
        <p style={styles.desc}>{info.desc}</p>
        <div style={styles.badge}>Module Under Development</div>
        <p style={styles.note}>
          This module is part of the MK Paper Mill ERP platform. Full implementation is in progress.
          Contact your administrator if you need access.
        </p>
        {onNavigate && (
          <button style={styles.btn} onClick={() => onNavigate('dashboard')}>
            <LayoutDashboard size={14} />
            Go to Dashboard
          </button>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: {
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  card: {
    background: '#fff',
    borderRadius: '28px',
    padding: '48px',
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 1px 2px rgba(20,20,20,.04), 0 16px 40px rgba(20,20,20,.08)',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    background: '#18181b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
    boxShadow: '0 8px 24px rgba(244,200,75,.2)',
  },
  title: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#1b1b1d',
    letterSpacing: '-.02em',
    marginBottom: '10px',
  },
  desc: {
    fontSize: '13.5px',
    color: '#71717a',
    lineHeight: 1.6,
    marginBottom: '20px',
  },
  badge: {
    display: 'inline-block',
    padding: '6px 14px',
    borderRadius: '999px',
    fontSize: '11.5px',
    fontWeight: '700',
    marginBottom: '18px',
    background: '#1b1b1d',
    color: '#f4c84b',
    letterSpacing: '.02em',
  },
  note: {
    fontSize: '12px',
    color: '#a1a1aa',
    lineHeight: 1.65,
    marginBottom: 24,
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 22px',
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    background: '#f4c84b',
    color: '#18181b',
    fontSize: 13.5,
    fontWeight: 700,
  },
}
