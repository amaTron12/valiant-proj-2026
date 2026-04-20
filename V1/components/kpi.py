"""
Deprecated Streamlit KPI module.

KPIs are now rendered as native Qt widgets in the PySide6 app.
"""

from __future__ import annotations

from typing import Any


def kpi_row(*_args: Any, **_kwargs: Any) -> None:
    raise RuntimeError("Streamlit UI has been removed. Use the PySide6 desktop app via launcher.py.")
