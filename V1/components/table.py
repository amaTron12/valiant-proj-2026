"""
Deprecated Streamlit table module.

The PySide6 app uses a native Qt table view; Streamlit HTML table rendering is removed.
"""

from __future__ import annotations

from typing import Any


def claims_table(*args: Any, **kwargs: Any) -> None:
    raise RuntimeError("Streamlit UI has been removed. Use the PySide6 desktop app via launcher.py.")
