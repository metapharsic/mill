# Physical Testing & Verification Guide: Daily Stock Rollover & Zero-Reset Engine

**Target Screen**: **Materials / Master Data** (`http://localhost:3333/materials`)  
**Target Module**: Store & Master Inventory Subsystem  
**Purpose**: Step-by-step guide for store managers and plant heads to physically test and verify the daily stock rollover and new-day zero reset logic on screen.

---

## 1. Where to Find the Updates in the UI

When you open **Materials / Master Data** from the left navigation sidebar, look at the following 5 distinct areas:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [1] TOP KPI CARDS                                                                                      │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐ ┌─────────────────────────┐ │
│ │ 📦 Opening (Y'day)   │ │ 📥 Received (Today)  │ │ 📤 Issued (Today)    │ │ 💰 Closing Valuation   │ │
│ │ 68,759.515 Units     │ │ +0.000 Units (Reset) │ │ -0.000 Units (Reset) │ │ ₹63,49,101.74         │ │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘ └─────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Area 1: Top 4 KPI Metric Cards (Above Table)
* **Card 1 (`📦 Opening Stock (Yesterday)`)**: Displays the sum of yesterday's closing balances across all materials in the selected filter.
* **Card 2 (`📥 Received (Today)`)**: Displays today's incoming GRN receipts. **Starts at `+0.000 Units`** at the beginning of every new calendar day.
* **Card 3 (`📤 Issued (Today)`)**: Displays today's plant/department issues. **Starts at `-0.000 Units`** at the beginning of every new calendar day.
* **Card 4 (`💰 Closing Valuation`)**: Displays the live total monetary valuation of on-hand inventory.

---

### Area 2: Main Data Table Columns (Columns 9 to 12)
Look at the table headers in the main grid:

| Col # | Column Header | What It Represents | Behavior on New Day |
| :--- | :--- | :--- | :--- |
| **9** | **Opening Stock (Yesterday)** | Stock on hand at 23:59:59 yesterday | Equals previous day closing balance |
| **10** | **Received (Today)** | Total GRN quantity received *today* | **Starts at `+0.000`** (Green badge) |
| **11** | **Issued (Today)** | Total quantity issued to plant *today* | **Starts at `-0.000`** (Red badge) |
| **12** | **Closing Balance** | $\text{Opening} + \text{Received} - \text{Issued}$ | Equals live current stock |

---

### Area 3: Live Mathematical Formula Banner (Direct Entry Bar)
Directly beneath the search filters, the live formula badge states:
$$\text{Formula: } \mathbf{Opening\ (Yesterday)} + \mathbf{Received\ (Today)} - \mathbf{Issued\ (Today)} = \mathbf{Closing\ Balance}$$

---

### Area 4: Product Details Modal (`👁 Details` Button)
Clicking on any material code or the **`👁 Details`** button opens the comprehensive product modal:
* At the top of the modal, a highlighted banner displays the 4-stat daily breakdown:
  * 📦 **Opening (Yesterday)**: `X.XXX`
  * 📥 **Received (Today)**: `+Y.YYY`
  * 📤 **Issued (Today)**: `-Z.ZZZ`
  * 💰 **Closing Balance**: `Current Stock`
* Includes the badge: `🔄 Day-to-Day Rollover Active`.

---

## 2. Step-by-Step Hands-On Live Test Procedure (3-Minute Test)

Follow these steps to physically test the logic on your system:

### Step 1: Start the System & Log In
1. Double-click **`Start MK Paper Mill.vbs`** (or run **`start.bat`** in terminal).
2. Open your web browser at **`http://localhost:3333`**.
3. Log in with Store Manager or Admin credentials:
   * **Email**: `head.store@mkpapermill.com` | **Password**: `Head@1234`  
   *(or `admin@mkpapermill.com` / `Admin@123`)*

---

### Step 2: Observe the Starting State on a Fresh Day
1. Click **`Materials / Master Data`** in the left sidebar.
2. Observe that for items that have not yet had transactions today:
   * **`Received (Today)`** is **`+0.000`**
   * **`Issued (Today)`** is **`-0.000`**
   * **`Opening Stock (Yesterday)`** is **identical to `Closing Balance`**!

---

### Step 3: Test Outward Issue Flow (e.g. Issue 5 Units)
1. Pick any item from the table (for example, code `OS0017` which has 25 units).
2. Click **`⚡ Fast Ops`** (or click `👁 Details` $\rightarrow$ go to **`⚡ Fast Inward / Issue Desks`** $\rightarrow$ **Quick Issue**).
3. Enter:
   * **Quantity**: `5`
   * **Department**: *Mechanical Maintenance*
   * **Purpose**: *Routine Servicing*
4. Click **`Submit Outward Issue`**.
5. **Verify the Table Immediately Updates**:
   * `Opening Stock (Yesterday)`: Stays **`25.000`** (Unchanged opening balance)
   * `Received (Today)`: **`+0.000`**
   * `Issued (Today)`: Shows **`-5.000`** (Recorded today's issue)
   * `Closing Balance`: Shows **`20.000`** ($25 - 5 = 20$)

---

### Step 4: Test Inward Receipt Flow (e.g. Receive 10 Units via GRN)
1. In the same item modal (or via **Store $\rightarrow$ Fast Inward**):
2. Enter:
   * **Quantity**: `10`
   * **Unit Price**: *As auto-populated*
   * **Vendor**: *Any supplier*
   * **Remarks**: *Testing Daily Inward*
3. Click **`Submit Fast Inward`**.
4. **Verify the Table Immediately Updates**:
   * `Opening Stock (Yesterday)`: Stays **`25.000`**
   * `Received (Today)`: Updates to **`+10.000`**
   * `Issued (Today)`: Stays **`-5.000`**
   * `Closing Balance`: Updates to **`30.000`** ($25 + 10 - 5 = \mathbf{30}$)

---

### Step 5: Verify New Day Rollover Continuity
* **End of Today**: Closing Balance is **`30.000`**.
* **Tomorrow Morning**:
  * `Opening Stock (Yesterday)` starts at **`30.000`**.
  * `Received (Today)` resets to **`+0.000`**.
  * `Issued (Today)` resets to **`-0.000`**.
  * `Closing Balance` starts at **`30.000`** ($30 + 0 - 0 = 30$).

---

## 3. Mathematical Proof & Invariant Summary

$$\begin{aligned}
\text{Today's Closing Stock} &= \text{Opening Stock} + \text{Today's Inward} - \text{Today's Outward} \\
\text{Tomorrow's Opening Stock} &\equiv \text{Today's Closing Stock}
\end{aligned}$$

Every stock movement in MK Paper Mill is backed by PostgreSQL transactions with atomic balance tracking, zero negative stock enforcement, and midnight date reset.
