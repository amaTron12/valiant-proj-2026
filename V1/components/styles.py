"""
Deprecated Streamlit CSS module.

PySide6 uses native styling; Streamlit CSS injection is removed.
"""

from __future__ import annotations

from typing import Any


def inject_styles(*_args: Any, **_kwargs: Any) -> None:
    raise RuntimeError("Streamlit UI has been removed. Use the PySide6 desktop app via launcher.py.")
