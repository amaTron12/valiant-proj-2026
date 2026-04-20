"""
Local (offline) desktop launcher.

This project previously used Streamlit + a local webview wrapper. It now runs as a
pure local PySide6 desktop application (no server, no browser, no Streamlit).
"""

from app import main


if __name__ == "__main__":
    main()
