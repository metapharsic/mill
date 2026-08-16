# MK Paper Mill ERP — Product Roadmap

> This document outlines the commercial and technical product roadmap for the ERP platform. 
> Use these guidelines when planning future features, architectural changes, or integrations.

---

## Product Vision
To build a highly reliable, real-time, event-driven Mill Operations Operating System (MOS) that bridges the gap between raw plant telemetry (PLC/SCADA) and commercial management systems (ERP/OMS).

---

## 📈 Roadmap Overview

```
 ┌──────────────────────────────────────────────────────────────────────┐
 │                           PRODUCT ROADMAP                            │
 │                                                                      │
 │  Phase 1 (Current)   ──► Stable core ERP, manual logging, Kafka event│
 │                          bus baseline, multi-level approvals.        │
 │                                                                      │
 │  Phase 2 (0-6 Mo)    ──► Real-time SCADA/PLC integrations, offline-   │
 │                          first Mobile App for shop-floor inspections.│
 │                                                                      │
 │  Phase 3 (6-12 Mo)   ──► Multi-tenant multi-mill cloud hosting, AI-  │
 │                          driven predictive maintenance alert models. │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Phase 2: Live Integrations & Mobile (0 - 6 Months)

### 1. Automated SCADA & PLC Telemetry Ingestion
*   **Objective:** Eliminate manual utility and plant section data logging by connecting OPC-UA / Modbus telemetry agents directly to Node.js backend endpoints.
*   **Scope:**
    *   Deploy lightweight python OPC-UA edge collectors in local machine subnet.
    *   Stream live tags directly to `/api/telemetry` endpoints.
    *   Configure Kafka streaming logic to aggregate readings on-the-fly and update `section_kpi_snapshots`.

### 2. Mobile App (Offline-First)
*   **Objective:** Empower floor technicians, quality testers, and security guards to log readings, upload scan photos, and verify visitors via tablet/phone.
*   **Scope:**
    *   Build React Native companion application.
    *   Enable offline caching for bearing checklist scans, EHS incident logs, and warehouse locations.
    *   Synchronize buffered data back to `backend/src/routes/` endpoints when WiFi connection re-establishes.

---

## Phase 3: Scaling & Analytics (6 - 12 Months)

### 1. Multi-Tenant Multi-Mill Support
*   **Objective:** Scale the single-tenant codebase into a cloud-hosted SaaS capable of managing multiple paper mills under a single corporate umbrella.
*   **Scope:**
    *   Add `tenant_id` or `mill_id` columns to all core tables (reels, materials, purchase orders, indents).
    *   Implement Row Level Security (RLS) policies in PostgreSQL.
    *   Update Auth tokens to payload a `mill_id` scope to filter client queries automatically.

### 2. AI-Driven Predictive Maintenance & Anomaly Models
*   **Objective:** Transition maintenance tasks from schedule-based (preventive) to anomaly-driven (predictive), using historical bearing temperature and vibration signals.
*   **Scope:**
    *   Build an isolated Python-based microservice that subscribes to `mkpm.telemetry.readings` Kafka events.
    *   Train machine learning models (Isolation Forests, LSTM autoencoders) on historical bearing telemetry data.
    *   Publish anomalous logs directly as `critical` events to `mkpm.events.critical` to automatically trigger preventive maintenance logs.
