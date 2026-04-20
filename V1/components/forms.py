"""
Deprecated Streamlit UI module.

The project no longer uses Streamlit. This file is kept only to avoid breaking
older imports; the functions raise with a clear message.
"""

from __future__ import annotations

from typing import Any


# ── Shared field layout ────────────────────────────────────────────────────────

def _removed(*_args: Any, **_kwargs: Any) -> None:
    raise RuntimeError("Streamlit UI has been removed. Use the PySide6 desktop app via launcher.py.")


# ── CRUD tabs ─────────────────────────────────────────────────────────────────

def tab_create(*args: Any, **kwargs: Any) -> None:
    _removed(*args, **kwargs)


def tab_update(*args: Any, **kwargs: Any) -> None:
    _removed(*args, **kwargs)


def tab_delete(*args: Any, **kwargs: Any) -> None:
    _removed(*args, **kwargs)
