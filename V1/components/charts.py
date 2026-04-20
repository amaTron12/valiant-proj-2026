"""
Deprecated Streamlit/Plotly charts module.

Charts are now rendered locally inside the PySide6 app (via matplotlib).
This file remains for compatibility with older imports.
"""

from __future__ import annotations

from typing import Any


def _removed(*_args: Any, **_kwargs: Any) -> None:
    raise RuntimeError("Streamlit UI has been removed. Charts are now rendered in the PySide6 app.")


def chart_status_bar(*args: Any, **kwargs: Any) -> None:
    _removed(*args, **kwargs)


def chart_trend_line(*args: Any, **kwargs: Any) -> None:
    _removed(*args, **kwargs)


def chart_type_pie(*args: Any, **kwargs: Any) -> None:
    _removed(*args, **kwargs)
