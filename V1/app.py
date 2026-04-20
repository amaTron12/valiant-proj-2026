from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Iterable

import pandas as pd

from config import COLUMNS, HIGH_VALUE_THRESHOLD, SORT_LABELS, STATUS_COLORS
from data import load_data, next_claim_id, save_data


def main() -> None:
    """
    Starts the local desktop application (no Streamlit, no server).
    """

    from PySide6 import QtCore, QtGui, QtWidgets

    try:
        from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg as FigureCanvas
        from matplotlib.figure import Figure
    except Exception as e:  # pragma: no cover
        raise RuntimeError(
            "Matplotlib is required for charts. Install: pip install matplotlib"
        ) from e

    def _dt_or_none(x: Any) -> datetime | None:
        if x is None or (isinstance(x, float) and pd.isna(x)) or pd.isna(x):
            return None
        if isinstance(x, datetime):
            return x
        try:
            return pd.to_datetime(x, errors="coerce").to_pydatetime()
        except Exception:
            return None

    def _qdate_to_date(d: QtCore.QDate) -> date:
        return date(d.year(), d.month(), d.day())

    def _money(x: Any) -> str:
        try:
            return f"${float(x):,.2f}"
        except Exception:
            return "$0.00"

    @dataclass(frozen=True)
    class Filters:
        start: date
        end: date
        status: str  # "All" or status value
        types: tuple[str, ...]
        search: str
        sort_by: str
        ascending: bool

    class ClaimsTableModel(QtCore.QAbstractTableModel):
        def __init__(self, df: pd.DataFrame):
            super().__init__()
            self._df = df

        def set_df(self, df: pd.DataFrame) -> None:
            self.beginResetModel()
            self._df = df
            self.endResetModel()

        def rowCount(self, parent: QtCore.QModelIndex = QtCore.QModelIndex()) -> int:
            if parent.isValid():
                return 0
            return 0 if self._df is None else len(self._df)

        def columnCount(self, parent: QtCore.QModelIndex = QtCore.QModelIndex()) -> int:
            if parent.isValid():
                return 0
            return 0 if self._df is None else len(self._df.columns)

        def headerData(self, section: int, orientation: QtCore.Qt.Orientation, role: int = QtCore.Qt.DisplayRole):
            if role != QtCore.Qt.DisplayRole or self._df is None:
                return None
            if orientation == QtCore.Qt.Horizontal:
                try:
                    return str(self._df.columns[section])
                except Exception:
                    return None
            return str(section + 1)

        def data(self, index: QtCore.QModelIndex, role: int = QtCore.Qt.DisplayRole):
            if not index.isValid() or self._df is None:
                return None
            row = index.row()
            col = index.column()
            col_name = self._df.columns[col]
            val = self._df.iat[row, col]

            if role == QtCore.Qt.DisplayRole:
                if col_name in {"medicine_cost", "service_cost", "total_amount_paid"}:
                    return _money(val)
                if col_name in {"created_at", "updated_at"}:
                    dt = _dt_or_none(val)
                    return dt.strftime("%Y-%m-%d %H:%M") if dt else ""
                return "" if pd.isna(val) else str(val)

            if role == QtCore.Qt.TextAlignmentRole:
                if col_name in {"medicine_cost", "service_cost", "total_amount_paid"}:
                    return int(QtCore.Qt.AlignVCenter | QtCore.Qt.AlignRight)
                return int(QtCore.Qt.AlignVCenter | QtCore.Qt.AlignLeft)

            if role == QtCore.Qt.BackgroundRole:
                if col_name == "total_amount_paid":
                    try:
                        if float(val) >= HIGH_VALUE_THRESHOLD:
                            return QtGui.QBrush(QtGui.QColor("#fffbeb"))
                    except Exception:
                        pass
            return None

    class ChartCard(QtWidgets.QGroupBox):
        def __init__(self, title: str):
            super().__init__(title)
            self.setStyleSheet("QGroupBox{font-weight:600;}")
            self._fig = Figure(figsize=(4, 3), dpi=100)
            self._canvas = FigureCanvas(self._fig)
            layout = QtWidgets.QVBoxLayout(self)
            layout.setContentsMargins(10, 10, 10, 10)
            layout.addWidget(self._canvas)

        def draw(self, draw_fn) -> None:
            self._fig.clear()
            ax = self._fig.add_subplot(111)
            draw_fn(ax)
            self._fig.tight_layout()
            self._canvas.draw_idle()

    class KPIChip(QtWidgets.QFrame):
        def __init__(self, label: str, color: str):
            super().__init__()
            self._label = QtWidgets.QLabel(label)
            self._value = QtWidgets.QLabel("—")
            self._value.setStyleSheet("font-size:18px;font-weight:700;color:#0f172a;")
            self._label.setStyleSheet("font-size:11px;font-weight:600;color:#64748b;")

            dot = QtWidgets.QLabel()
            dot.setFixedSize(10, 10)
            dot.setStyleSheet(f"background:{color};border-radius:5px;")

            top = QtWidgets.QHBoxLayout()
            top.setContentsMargins(0, 0, 0, 0)
            top.addWidget(dot)
            top.addSpacing(6)
            top.addWidget(self._label)
            top.addStretch(1)

            layout = QtWidgets.QVBoxLayout(self)
            layout.setContentsMargins(12, 10, 12, 10)
            layout.addLayout(top)
            layout.addWidget(self._value)

            self.setStyleSheet(
                "QFrame{background:white;border:1px solid #e8ecf2;border-radius:10px;}"
            )

        def set_value(self, text: str) -> None:
            self._value.setText(text)

    class ClaimForm(QtWidgets.QWidget):
        """
        Shared create/update form widget.
        """

        def __init__(self):
            super().__init__()
            self.widgets: dict[str, QtWidgets.QWidget] = {}

            layout = QtWidgets.QGridLayout(self)
            layout.setHorizontalSpacing(12)
            layout.setVerticalSpacing(10)

            def add_row(r: int, label: str, w: QtWidgets.QWidget, key: str):
                layout.addWidget(QtWidgets.QLabel(label), r, 0)
                layout.addWidget(w, r, 1)
                self.widgets[key] = w

            # Basic set (kept compact; still writes full schema)
            self.client_name = QtWidgets.QLineEdit()
            self.pet_name = QtWidgets.QLineEdit()
            self.client_age = QtWidgets.QSpinBox()
            self.client_age.setRange(0, 120)
            self.client_gender = QtWidgets.QComboBox()
            self.client_gender.addItems(["Male", "Female", "Other"])
            self.location = QtWidgets.QLineEdit()

            self.species = QtWidgets.QComboBox()
            self.species.addItems(["Dog", "Cat", "Bird", "Rabbit", "Other"])
            self.breed = QtWidgets.QLineEdit()
            self.breed_type = QtWidgets.QComboBox()
            self.breed_type.addItems(["Purebred", "Mixed", "Unknown"])
            self.pet_gender = QtWidgets.QComboBox()
            self.pet_gender.addItems(["Male", "Female"])
            self.neutering_status = QtWidgets.QComboBox()
            self.neutering_status.addItems(["Neutered", "Intact", "Unknown"])
            self.color = QtWidgets.QLineEdit()
            self.pet_age = QtWidgets.QDoubleSpinBox()
            self.pet_age.setRange(0.0, 50.0)
            self.pet_age.setDecimals(1)
            self.weight = QtWidgets.QDoubleSpinBox()
            self.weight.setRange(0.0, 300.0)
            self.weight.setDecimals(1)

            self.place_of_loss = QtWidgets.QLineEdit()
            self.diagnosis = QtWidgets.QPlainTextEdit()
            self.diagnosis.setFixedHeight(60)
            self.medications = QtWidgets.QPlainTextEdit()
            self.medications.setFixedHeight(50)
            self.medicine_cost = QtWidgets.QDoubleSpinBox()
            self.medicine_cost.setRange(0.0, 1_000_000.0)
            self.medicine_cost.setDecimals(2)
            self.service_cost = QtWidgets.QDoubleSpinBox()
            self.service_cost.setRange(0.0, 1_000_000.0)
            self.service_cost.setDecimals(2)
            self.veterinary_services = QtWidgets.QPlainTextEdit()
            self.veterinary_services.setFixedHeight(50)
            self.vet_clinic = QtWidgets.QLineEdit()
            self.claim_type = QtWidgets.QComboBox()
            self.claim_type.addItems(["Accident", "Illness", "Wellness"])
            self.status = QtWidgets.QComboBox()
            self.status.addItems(["Open", "Pending", "Approved", "Denied"])
            self.missing_documents = QtWidgets.QLineEdit()
            self.stage = QtWidgets.QComboBox()
            self.stage.addItems(["Intake", "Review", "Assessment", "Approval", "Payment", "Closed"])

            r = 0
            add_row(r, "Client Name*", self.client_name, "client_name"); r += 1
            add_row(r, "Pet Name*", self.pet_name, "pet_name"); r += 1
            add_row(r, "Client Age", self.client_age, "client_age"); r += 1
            add_row(r, "Client Gender", self.client_gender, "client_gender"); r += 1
            add_row(r, "Location", self.location, "location_of_residence"); r += 1
            add_row(r, "Species", self.species, "species"); r += 1
            add_row(r, "Breed", self.breed, "breed"); r += 1
            add_row(r, "Breed Type", self.breed_type, "breed_type"); r += 1
            add_row(r, "Pet Gender", self.pet_gender, "gender"); r += 1
            add_row(r, "Neutering", self.neutering_status, "neutering_status"); r += 1
            add_row(r, "Color", self.color, "color"); r += 1
            add_row(r, "Pet Age (yrs)", self.pet_age, "age"); r += 1
            add_row(r, "Weight (kg)", self.weight, "weight"); r += 1
            add_row(r, "Place of Loss", self.place_of_loss, "place_of_loss"); r += 1
            add_row(r, "Diagnosis", self.diagnosis, "diagnosis"); r += 1
            add_row(r, "Medications", self.medications, "medications"); r += 1
            add_row(r, "Medicine Cost ($)", self.medicine_cost, "medicine_cost"); r += 1
            add_row(r, "Service Cost ($)", self.service_cost, "service_cost"); r += 1
            add_row(r, "Veterinary Services", self.veterinary_services, "veterinary_services"); r += 1
            add_row(r, "Vet Clinic", self.vet_clinic, "vet_clinic"); r += 1
            add_row(r, "Claim Type", self.claim_type, "claim_type"); r += 1
            add_row(r, "Status", self.status, "status"); r += 1
            add_row(r, "Missing Documents", self.missing_documents, "missing_documents"); r += 1
            add_row(r, "Stage", self.stage, "stage"); r += 1

            layout.setRowStretch(r, 1)
            layout.setColumnStretch(1, 1)

        def to_row(self) -> dict[str, Any]:
            def text(w: QtWidgets.QWidget) -> str:
                if isinstance(w, QtWidgets.QLineEdit):
                    return w.text().strip()
                if isinstance(w, QtWidgets.QPlainTextEdit):
                    return w.toPlainText().strip()
                if isinstance(w, QtWidgets.QComboBox):
                    return w.currentText()
                return ""

            def num(w: QtWidgets.QWidget) -> float | int:
                if isinstance(w, QtWidgets.QSpinBox):
                    return int(w.value())
                if isinstance(w, QtWidgets.QDoubleSpinBox):
                    return float(w.value())
                return 0

            out: dict[str, Any] = {}
            for k, w in self.widgets.items():
                if isinstance(w, (QtWidgets.QSpinBox, QtWidgets.QDoubleSpinBox)):
                    out[k] = num(w)
                else:
                    out[k] = text(w)
            return out

        def load_row(self, row: dict[str, Any]) -> None:
            def set_text(w: QtWidgets.QWidget, v: Any) -> None:
                if isinstance(w, QtWidgets.QLineEdit):
                    w.setText("" if v is None or pd.isna(v) else str(v))
                elif isinstance(w, QtWidgets.QPlainTextEdit):
                    w.setPlainText("" if v is None or pd.isna(v) else str(v))
                elif isinstance(w, QtWidgets.QComboBox):
                    txt = "" if v is None or pd.isna(v) else str(v)
                    i = w.findText(txt)
                    if i >= 0:
                        w.setCurrentIndex(i)

            def set_num(w: QtWidgets.QWidget, v: Any) -> None:
                if v is None or pd.isna(v):
                    v = 0
                try:
                    if isinstance(w, QtWidgets.QSpinBox):
                        w.setValue(int(float(v)))
                    elif isinstance(w, QtWidgets.QDoubleSpinBox):
                        w.setValue(float(v))
                except Exception:
                    pass

            for k, w in self.widgets.items():
                v = row.get(k)
                if isinstance(w, (QtWidgets.QSpinBox, QtWidgets.QDoubleSpinBox)):
                    set_num(w, v)
                else:
                    set_text(w, v)

    class MainWindow(QtWidgets.QMainWindow):
        def __init__(self):
            super().__init__()
            self.setWindowTitle("Pet Health Insurance Claims")
            self.resize(1440, 900)

            self._df_all = load_data()
            self._df_view = self._df_all.copy()

            app = QtWidgets.QApplication.instance()
            if app:
                app.setStyle("Fusion")

            central = QtWidgets.QWidget()
            self.setCentralWidget(central)
            outer = QtWidgets.QHBoxLayout(central)
            outer.setContentsMargins(10, 10, 10, 10)
            outer.setSpacing(10)

            # Sidebar
            sidebar = QtWidgets.QFrame()
            sidebar.setFixedWidth(320)
            sidebar.setStyleSheet("QFrame{background:white;border:1px solid #e8ecf2;border-radius:10px;}")
            sb = QtWidgets.QVBoxLayout(sidebar)
            sb.setContentsMargins(12, 12, 12, 12)
            sb.setSpacing(10)

            brand = QtWidgets.QLabel("Pet Insurance\nClaims Dashboard")
            brand.setStyleSheet("font-weight:800;font-size:16px;color:#0f172a;")
            sb.addWidget(brand)

            sb.addWidget(QtWidgets.QLabel("Filters"))
            self.start_date = QtWidgets.QDateEdit()
            self.start_date.setCalendarPopup(True)
            self.end_date = QtWidgets.QDateEdit()
            self.end_date.setCalendarPopup(True)
            self.status_filter = QtWidgets.QComboBox()
            self.status_filter.addItems(["All", "Open", "Pending", "Approved", "Denied"])

            self.type_list = QtWidgets.QListWidget()
            self.type_list.setMaximumHeight(86)
            for t in ["Accident", "Illness", "Wellness"]:
                it = QtWidgets.QListWidgetItem(t)
                it.setFlags(it.flags() | QtCore.Qt.ItemIsUserCheckable)
                it.setCheckState(QtCore.Qt.Checked)
                self.type_list.addItem(it)

            sb.addWidget(QtWidgets.QLabel("Start date"))
            sb.addWidget(self.start_date)
            sb.addWidget(QtWidgets.QLabel("End date"))
            sb.addWidget(self.end_date)
            sb.addWidget(QtWidgets.QLabel("Claim status"))
            sb.addWidget(self.status_filter)
            sb.addWidget(QtWidgets.QLabel("Claim type"))
            sb.addWidget(self.type_list)

            sb.addSpacing(6)
            self.summary = QtWidgets.QLabel("")
            self.summary.setStyleSheet("color:#475569;")
            sb.addWidget(self.summary)
            sb.addStretch(1)

            # Main area
            main = QtWidgets.QVBoxLayout()
            main.setContentsMargins(0, 0, 0, 0)
            main.setSpacing(10)

            header = QtWidgets.QFrame()
            header.setStyleSheet("QFrame{background:white;border:1px solid #e8ecf2;border-radius:10px;}")
            hl = QtWidgets.QHBoxLayout(header)
            hl.setContentsMargins(14, 12, 14, 12)
            title = QtWidgets.QLabel("Pet Health Insurance — Claims Dashboard")
            title.setStyleSheet("font-weight:800;font-size:16px;color:#0f172a;")
            self.last_updated = QtWidgets.QLabel("")
            self.last_updated.setStyleSheet("color:#64748b;")
            hl.addWidget(title)
            hl.addStretch(1)
            hl.addWidget(self.last_updated)
            main.addWidget(header)

            # KPI row
            kpi_row = QtWidgets.QHBoxLayout()
            kpi_row.setSpacing(10)
            self.kpis = {
                "Total Claims": KPIChip("TOTAL CLAIMS", "#6366f1"),
                "Open": KPIChip("OPEN", STATUS_COLORS["Open"]),
                "Pending": KPIChip("PENDING", STATUS_COLORS["Pending"]),
                "Approved": KPIChip("APPROVED", STATUS_COLORS["Approved"]),
                "Denied": KPIChip("DENIED", STATUS_COLORS["Denied"]),
                "Avg Claim": KPIChip("AVG CLAIM", "#8b5cf6"),
                "Total Payout": KPIChip("TOTAL PAYOUT", "#0ea5e9"),
            }
            for k in ["Total Claims", "Open", "Pending", "Approved", "Denied", "Avg Claim", "Total Payout"]:
                kpi_row.addWidget(self.kpis[k], 1)
            main.addLayout(kpi_row)

            # Charts
            charts = QtWidgets.QHBoxLayout()
            charts.setSpacing(10)
            self.chart_status = ChartCard("Claims by Status")
            self.chart_trend = ChartCard("Avg Claim Value by Month")
            self.chart_type = ChartCard("Claims by Type")
            charts.addWidget(self.chart_status, 1)
            charts.addWidget(self.chart_trend, 1)
            charts.addWidget(self.chart_type, 1)
            main.addLayout(charts)

            # Table + controls
            controls = QtWidgets.QHBoxLayout()
            self.search = QtWidgets.QLineEdit()
            self.search.setPlaceholderText("Search by client name or claim ID")
            self.sort_by = QtWidgets.QComboBox()
            self.sort_by.addItems(list(SORT_LABELS.values()))
            self.ascending = QtWidgets.QCheckBox("Ascending")
            self.export_btn = QtWidgets.QPushButton("Export CSV")
            controls.addWidget(self.search, 3)
            controls.addWidget(self.sort_by, 2)
            controls.addWidget(self.ascending, 1)
            controls.addWidget(self.export_btn, 1)
            main.addLayout(controls)

            self.table = QtWidgets.QTableView()
            self.table.setAlternatingRowColors(True)
            self.table.setSelectionBehavior(QtWidgets.QAbstractItemView.SelectRows)
            self.table.setSelectionMode(QtWidgets.QAbstractItemView.SingleSelection)
            self.table.setSortingEnabled(False)
            main.addWidget(self.table, 4)

            # CRUD tabs
            self.tabs = QtWidgets.QTabWidget()
            main.addWidget(self.tabs, 3)

            # Create
            create = QtWidgets.QWidget()
            cl = QtWidgets.QVBoxLayout(create)
            self.create_form = ClaimForm()
            self.create_submit = QtWidgets.QPushButton("Submit Claim")
            self.create_submit.setStyleSheet("font-weight:700;")
            cl.addWidget(self.create_form)
            cl.addWidget(self.create_submit)
            self.tabs.addTab(create, "Create")

            # Update
            update = QtWidgets.QWidget()
            ul = QtWidgets.QVBoxLayout(update)
            top = QtWidgets.QHBoxLayout()
            self.update_select = QtWidgets.QComboBox()
            self.update_reload = QtWidgets.QPushButton("Reload")
            top.addWidget(QtWidgets.QLabel("Select Claim"))
            top.addWidget(self.update_select, 1)
            top.addWidget(self.update_reload)
            ul.addLayout(top)
            self.update_form = ClaimForm()
            self.update_submit = QtWidgets.QPushButton("Save Changes")
            self.update_submit.setStyleSheet("font-weight:700;")
            ul.addWidget(self.update_form)
            ul.addWidget(self.update_submit)
            self.tabs.addTab(update, "Update")

            # Delete
            delete = QtWidgets.QWidget()
            dl = QtWidgets.QVBoxLayout(delete)
            self.delete_select = QtWidgets.QComboBox()
            self.delete_btn = QtWidgets.QPushButton("Confirm Delete")
            self.delete_btn.setStyleSheet("font-weight:700;")
            dl.addWidget(QtWidgets.QLabel("Select Claim"))
            dl.addWidget(self.delete_select)
            dl.addWidget(self.delete_btn)
            dl.addStretch(1)
            self.tabs.addTab(delete, "Delete")

            outer.addWidget(sidebar)
            outer.addLayout(main, 1)

            # Signals
            self.start_date.dateChanged.connect(self.refresh_view)
            self.end_date.dateChanged.connect(self.refresh_view)
            self.status_filter.currentIndexChanged.connect(self.refresh_view)
            self.type_list.itemChanged.connect(self.refresh_view)
            self.search.textChanged.connect(self.refresh_view)
            self.sort_by.currentIndexChanged.connect(self.refresh_view)
            self.ascending.stateChanged.connect(self.refresh_view)
            self.export_btn.clicked.connect(self.export_csv)

            self.create_submit.clicked.connect(self.create_claim)
            self.update_reload.clicked.connect(self.load_selected_for_update)
            self.update_select.currentIndexChanged.connect(self.load_selected_for_update)
            self.update_submit.clicked.connect(self.update_claim)
            self.delete_btn.clicked.connect(self.delete_claim)

            # Initial date bounds
            self._init_date_range()
            self._bind_models()
            self.refresh_view()

        def _init_date_range(self) -> None:
            if not self._df_all.empty and not self._df_all["created_at"].isna().all():
                mn = self._df_all["created_at"].dropna().min().date()
                mx = self._df_all["created_at"].dropna().max().date()
            else:
                mx = date.today()
                mn = date(mx.year - 1, mx.month, mx.day)
            self.start_date.setDate(QtCore.QDate(mn.year, mn.month, mn.day))
            self.end_date.setDate(QtCore.QDate(mx.year, mx.month, mx.day))

        def _filters(self) -> Filters:
            types: list[str] = []
            for i in range(self.type_list.count()):
                it = self.type_list.item(i)
                if it.checkState() == QtCore.Qt.Checked:
                    types.append(it.text())

            sort_display = self.sort_by.currentText()
            sort_key = next((k for k, v in SORT_LABELS.items() if v == sort_display), "created_at")

            return Filters(
                start=_qdate_to_date(self.start_date.date()),
                end=_qdate_to_date(self.end_date.date()),
                status=self.status_filter.currentText(),
                types=tuple(types),
                search=self.search.text().strip(),
                sort_by=sort_key,
                ascending=bool(self.ascending.isChecked()),
            )

        def _bind_models(self) -> None:
            self.model = ClaimsTableModel(self._df_view)
            self.table.setModel(self.model)
            self.table.horizontalHeader().setStretchLastSection(True)
            self.table.setWordWrap(False)

        def _apply_filters(self, df_all: pd.DataFrame, f: Filters) -> pd.DataFrame:
            df = df_all.copy()

            if "created_at" in df.columns:
                dt = pd.to_datetime(df["created_at"], errors="coerce")
                df["_created_date"] = dt.dt.date
                mask = df["_created_date"].between(f.start, f.end) | df["_created_date"].isna()
                df = df[mask].drop(columns=["_created_date"], errors="ignore")

            if f.status != "All" and "status" in df.columns:
                df = df[df["status"] == f.status]

            if f.types and "claim_type" in df.columns:
                df = df[df["claim_type"].isin(list(f.types))]

            if f.search:
                s = f.search
                cn = df["client_name"].astype(str) if "client_name" in df.columns else pd.Series([], dtype=str)
                ci = df["claim_id"].astype(str) if "claim_id" in df.columns else pd.Series([], dtype=str)
                mask = cn.str.contains(s, case=False, na=False) | ci.str.contains(s, case=False, na=False)
                df = df[mask]

            if f.sort_by in df.columns:
                df = df.sort_values(f.sort_by, ascending=f.ascending)

            return df

        def refresh_view(self) -> None:
            self._df_all = load_data()
            f = self._filters()
            self._df_view = self._apply_filters(self._df_all, f)

            self.last_updated.setText(f"Last updated: {datetime.now().strftime('%b %d, %Y  %I:%M %p')}")
            self.summary.setText(f"Showing {len(self._df_view)} of {len(self._df_all)} claims")

            self.model.set_df(self._df_view.reset_index(drop=True))
            self._refresh_kpis()
            self._refresh_charts()
            self._refresh_claim_picklists()

        def _refresh_kpis(self) -> None:
            df = self._df_view
            self.kpis["Total Claims"].set_value(f"{len(df):,}")
            self.kpis["Open"].set_value(f"{len(df[df['status'] == 'Open']):,}" if "status" in df.columns else "0")
            self.kpis["Pending"].set_value(f"{len(df[df['status'] == 'Pending']):,}" if "status" in df.columns else "0")
            self.kpis["Approved"].set_value(f"{len(df[df['status'] == 'Approved']):,}" if "status" in df.columns else "0")
            self.kpis["Denied"].set_value(f"{len(df[df['status'] == 'Denied']):,}" if "status" in df.columns else "0")

            avg_val = float(df["total_amount_paid"].mean()) if (not df.empty and "total_amount_paid" in df.columns) else 0.0
            sum_val = float(df["total_amount_paid"].sum()) if (not df.empty and "total_amount_paid" in df.columns) else 0.0
            self.kpis["Avg Claim"].set_value(f"${avg_val:,.0f}")
            self.kpis["Total Payout"].set_value(f"${sum_val:,.0f}")

        def _refresh_charts(self) -> None:
            df = self._df_view

            def draw_status(ax):
                ax.set_facecolor("white")
                if df.empty or "status" not in df.columns:
                    ax.text(0.5, 0.5, "No data", ha="center", va="center", color="#64748b")
                    ax.set_axis_off()
                    return
                counts = df["status"].value_counts()
                xs = list(counts.index)
                ys = list(counts.values)
                colors = [STATUS_COLORS.get(x, "#94a3b8") for x in xs]
                ax.bar(xs, ys, color=colors)
                ax.tick_params(axis="x", rotation=25)
                ax.grid(axis="y", color="#f1f5f9")

            def draw_trend(ax):
                ax.set_facecolor("white")
                if df.empty or "created_at" not in df.columns or df["created_at"].isna().all():
                    ax.text(0.5, 0.5, "No date data", ha="center", va="center", color="#64748b")
                    ax.set_axis_off()
                    return
                tmp = df.copy()
                tmp["created_at"] = pd.to_datetime(tmp["created_at"], errors="coerce")
                tmp = tmp.dropna(subset=["created_at"])
                if tmp.empty:
                    ax.text(0.5, 0.5, "No date data", ha="center", va="center", color="#64748b")
                    ax.set_axis_off()
                    return
                tmp["month"] = tmp["created_at"].dt.to_period("M").astype(str)
                monthly = tmp.groupby("month").agg(avg_paid=("total_amount_paid", "mean")).reset_index()
                ax.plot(monthly["month"], monthly["avg_paid"], marker="o", color="#3B82F6", linewidth=2.2)
                ax.tick_params(axis="x", rotation=25)
                ax.grid(axis="y", color="#f1f5f9")
                ax.set_ylabel("Avg Amount ($)")

            def draw_type(ax):
                ax.set_facecolor("white")
                if df.empty or "claim_type" not in df.columns:
                    ax.text(0.5, 0.5, "No data", ha="center", va="center", color="#64748b")
                    ax.set_axis_off()
                    return
                counts = df["claim_type"].value_counts()
                labels = list(counts.index)
                values = list(counts.values)
                colors = ["#3B82F6", "#10B981", "#F59E0B", "#94a3b8"]
                ax.pie(values, labels=labels, autopct="%1.0f%%", colors=colors[: len(values)])

            self.chart_status.draw(draw_status)
            self.chart_trend.draw(draw_trend)
            self.chart_type.draw(draw_type)

        def _refresh_claim_picklists(self) -> None:
            ids = [] if self._df_all.empty else [str(x) for x in self._df_all["claim_id"].dropna().tolist()]
            current_u = self.update_select.currentText()
            current_d = self.delete_select.currentText()

            self.update_select.blockSignals(True)
            self.delete_select.blockSignals(True)
            self.update_select.clear()
            self.delete_select.clear()
            self.update_select.addItems(ids)
            self.delete_select.addItems(ids)
            if current_u:
                i = self.update_select.findText(current_u)
                if i >= 0:
                    self.update_select.setCurrentIndex(i)
            if current_d:
                i = self.delete_select.findText(current_d)
                if i >= 0:
                    self.delete_select.setCurrentIndex(i)
            self.update_select.blockSignals(False)
            self.delete_select.blockSignals(False)

            self.load_selected_for_update()

        def _selected_claim_id(self) -> str | None:
            cid = self.update_select.currentText().strip()
            return cid or None

        def load_selected_for_update(self) -> None:
            cid = self._selected_claim_id()
            if not cid or self._df_all.empty:
                return
            row = self._df_all[self._df_all["claim_id"] == cid]
            if row.empty:
                return
            self.update_form.load_row(row.iloc[0].to_dict())

        def create_claim(self) -> None:
            from PySide6 import QtWidgets

            fields = self.create_form.to_row()
            if not fields.get("client_name") or not fields.get("pet_name"):
                QtWidgets.QMessageBox.warning(self, "Missing required fields", "Client Name and Pet Name are required.")
                return

            df = load_data()
            now = datetime.now().isoformat()
            new_id = next_claim_id(df)
            row = {
                **{c: None for c in COLUMNS},
                **fields,
                "claim_id": new_id,
                "total_amount_paid": float(fields.get("medicine_cost", 0.0)) + float(fields.get("service_cost", 0.0)),
                "created_at": now,
                "updated_at": now,
            }
            save_data(pd.concat([df, pd.DataFrame([row])], ignore_index=True))
            QtWidgets.QMessageBox.information(self, "Created", f"Claim {new_id} created successfully.")
            self.refresh_view()

        def update_claim(self) -> None:
            from PySide6 import QtWidgets

            cid = self._selected_claim_id()
            if not cid:
                QtWidgets.QMessageBox.information(self, "No claim selected", "Select a claim to update.")
                return
            df = load_data()
            idxs = df.index[df["claim_id"] == cid].tolist()
            if not idxs:
                QtWidgets.QMessageBox.warning(self, "Not found", "The selected claim was not found.")
                return
            i = idxs[0]
            fields = self.update_form.to_row()
            for k, v in fields.items():
                df.at[i, k] = v
            df.at[i, "total_amount_paid"] = float(fields.get("medicine_cost", 0.0)) + float(fields.get("service_cost", 0.0))
            df.at[i, "updated_at"] = datetime.now().isoformat()
            save_data(df)
            QtWidgets.QMessageBox.information(self, "Updated", f"Claim {cid} updated successfully.")
            self.refresh_view()

        def delete_claim(self) -> None:
            from PySide6 import QtWidgets

            cid = self.delete_select.currentText().strip()
            if not cid:
                QtWidgets.QMessageBox.information(self, "No claim selected", "Select a claim to delete.")
                return
            df = load_data()
            if df.empty or cid not in df["claim_id"].astype(str).tolist():
                QtWidgets.QMessageBox.warning(self, "Not found", "The selected claim was not found.")
                return
            resp = QtWidgets.QMessageBox.question(
                self,
                "Confirm delete",
                f"Delete claim {cid}? This will rewrite claims.csv.",
                QtWidgets.QMessageBox.Yes | QtWidgets.QMessageBox.No,
            )
            if resp != QtWidgets.QMessageBox.Yes:
                return
            save_data(df[df["claim_id"] != cid])
            QtWidgets.QMessageBox.information(self, "Deleted", f"Claim {cid} has been deleted.")
            self.refresh_view()

        def export_csv(self) -> None:
            from PySide6 import QtWidgets

            path, _ = QtWidgets.QFileDialog.getSaveFileName(
                self,
                "Export filtered claims",
                f"claims_{date.today().isoformat()}.csv",
                "CSV Files (*.csv)",
            )
            if not path:
                return
            self._df_view.to_csv(path, index=False)

    app = QtWidgets.QApplication([])
    app.setApplicationName("Pet Claims Dashboard")
    win = MainWindow()
    win.show()
    raise SystemExit(app.exec())


if __name__ == "__main__":  # pragma: no cover
    main()
