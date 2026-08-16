# Finance Module — Full Workflow & Rules

## Overview
Financial ledger, payment records, budget tracking, outstanding payables/receivables,
and basic P&L reporting. Finance module is gated at L3+ for view, L4+ for approve/post.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/finance.js` | Finance endpoints |
| `frontend/src/pages/Finance.jsx` | Finance UI |
| DB: `finance_ledger`, `payments` | Core tables |

## Database Tables
| Table | Purpose |
|---|---|
| `finance_ledger` | Journal entries / general ledger |
| `payments` | Payment records (in/out) |
| `account_heads` | Chart of accounts |

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/finance/ledger` | L3+ | Ledger entries (filter: from, to, account_head) |
| POST | `/finance/ledger` | L3+ | Create journal entry |
| GET | `/finance/payments` | L3+ | Payment records |
| POST | `/finance/payments` | L3+ | Record payment |
| PUT | `/finance/payments/:id/confirm` | L4+ | Confirm payment (Plant Head) |
| GET | `/finance/outstanding` | L3+ | Outstanding payables + receivables |
| GET | `/finance/summary` | L4+ | P&L summary (L4+ only) |

## Payment Record Fields
| Field | Description |
|---|---|
| `payment_date` | Date of payment |
| `amount` | Payment amount |
| `direction` | In (received) / Out (made) |
| `reference_type` | PO / Salary / Sales / Other |
| `reference_id` | FK to source document |
| `payment_mode` | Bank Transfer / Cheque / Cash |
| `bank_reference` | Transaction reference / cheque number |
| `remarks` | Notes |
| `status` | Pending / Confirmed |
| `confirmed_by` | L4+ user who confirmed |

## Journal Entry Fields
| Field | Description |
|---|---|
| `date` | Entry date |
| `debit_account` | Debit account head |
| `credit_account` | Credit account head |
| `amount` | Entry amount |
| `narration` | Description |
| `reference_type` | Source module |
| `reference_id` | Source document |

## Account Heads (examples)
| Head | Type |
|---|---|
| Raw Material | Expense |
| Chemicals | Expense |
| Power | Expense |
| Salary | Expense |
| Maintenance | Expense |
| Paper Sales | Income |
| Scrap Sales | Income |
| Sundry Payables | Liability |
| Sundry Receivables | Asset |

## Outstanding Payables
- POs in status Received/Sent but no payment confirmed
- HR payroll approved but not paid

## Outstanding Receivables  
- Sales Orders dispatched but not invoiced/paid
- Credit days overdue: `dispatch_date + credit_days < CURRENT_DATE`

## Rules
1. L3+ to create/view finance entries
2. L4+ (Plant Head) to confirm payments — strong financial control
3. All payments must reference a source document (PO, Payroll, SO)
4. Double-entry: every journal entry has matching debit/credit
5. Payment confirmation triggers PO status update to Closed (via integration)
6. Financial data NEVER exposed to L1/L2 — sensitive business information

## Payroll → Finance Integration
After payroll approval (HR module):
- Finance team creates payment record: `reference_type='Salary', reference_id=payroll.id`
- L4+ confirms salary payment
- Updates PF/ESIC liability accounts

## Purchase → Finance Integration
After GRN approval (inventory):
- Finance team records vendor payable: `reference_type='PO', reference_id=po.id`
- L4+ confirms payment on due date
- Updates vendor payables outstanding
