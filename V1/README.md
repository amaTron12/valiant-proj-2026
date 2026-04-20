# 🐾 Pet Health Insurance Claims Dashboard

A Python desktop application for managing and visualizing pet health insurance claims.  
Runs as a **native desktop window** — no browser, no server, no internet required.

---

## Project Files

| File | Purpose |
|---|---|
| `launcher.py` | **Entry point** — run this to open the app as a desktop window |
| `app.py` | PySide6 desktop UI (filters, charts, table, CRUD) |
| `claims.csv` | Live data store — all claims are read from and written to this file |
| `README.md` | This file |
| `venv/` | Python virtual environment — created during setup, do not edit manually |

> **`claims.csv` is the single source of truth.** Every Create / Update / Delete writes to it immediately. No database required.

---

## How It Works

`launcher.py` starts a local **PySide6** desktop application. The UI reads from and writes to `claims.csv` directly (no web server, no browser wrapper).

---

## Setup (first time only)

Open a terminal in the project folder.

### 1. Create a virtual environment

```bash
python3 -m venv venv
```

### 2. Activate it

```bash
source venv/bin/activate
```

Your prompt will show `(venv)` when it's active.

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

---

## Running the App

```bash
source venv/bin/activate
python3 launcher.py
```

A desktop window will open after a few seconds. The app runs entirely locally — no internet connection needed.

> Every time you open a new terminal session, run `source venv/bin/activate` first.

---

## Features

### Dashboard
- **KPI cards** — Total Claims, Open, Pending, Approved, Denied, Avg Claim Value, Total Payout
- **Bar chart** — Claims by status
- **Line chart** — Average claim value over time
- **Donut chart** — Claims by type

### Sidebar Filters
- Date range, Claim status, Claim type
- All filters update KPI cards, charts, and table simultaneously

### Claims Table
- Search by client name or Claim ID
- Sort by any column
- ⭐ High-value flag on claims ≥ $5,000
- Export filtered results to CSV

### CRUD Tabs
| Tab | What it does |
|---|---|
| ➕ Create | New claim form — auto-generates `CLM-XXXX` ID, appends to `claims.csv` |
| ✏️ Update | Pick a claim, edit any field, overwrites `claims.csv` on save |
| 🗑️ Delete | Pick a claim, confirm, rewrites `claims.csv` without the deleted row |

---

## Data Schema

```
claim_id, client_name, client_age, client_gender, location_of_residence,
pet_name, species, breed, breed_type, gender, neutering_status, color, age, weight,
place_of_loss, diagnosis, medications, medicine_cost, veterinary_services, service_cost,
vet_clinic, claim_type, status, missing_documents, stage, total_amount_paid,
created_at, updated_at
```

If `claims.csv` does not exist on startup, it is created automatically with the correct headers.

---

## Status Color Codes

| Status | Color |
|---|---|
| Open | Blue |
| Pending | Yellow |
| Approved | Green |
| Denied | Red |

---

## Notes

- To reset to a clean state: delete `claims.csv` and relaunch — it will be recreated empty.
- To pre-load data: edit `claims.csv` in Excel, keeping the column headers intact.
- Run `python3 launcher.py` to start the desktop app.
