"""
Deprecated Streamlit sidebar module.

Filters are now native Qt widgets inside the PySide6 app.
"""

from __future__ import annotations

from typing import Any


def build_sidebar(*args: Any, **kwargs: Any) -> None:

    raise RuntimeError("Streamlit UI has been removed. Use the PySide6 desktop app via launcher.py.")
