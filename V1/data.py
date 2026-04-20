import os

import pandas as pd

from config import COLUMNS, CSV_FILE


def load_data() -> pd.DataFrame:
    if not os.path.exists(CSV_FILE):
        df = pd.DataFrame(columns=COLUMNS)
        df.to_csv(CSV_FILE, index=False)
        return df

    df = pd.read_csv(CSV_FILE)

    for col in COLUMNS:
        if col not in df.columns:
            df[col] = None

    df["medicine_cost"]     = pd.to_numeric(df["medicine_cost"],     errors="coerce").fillna(0)
    df["service_cost"]      = pd.to_numeric(df["service_cost"],      errors="coerce").fillna(0)
    df["total_amount_paid"] = pd.to_numeric(df["total_amount_paid"], errors="coerce").fillna(0)
    df["created_at"]        = pd.to_datetime(df["created_at"],       errors="coerce")
    df["updated_at"]        = pd.to_datetime(df["updated_at"],       errors="coerce")
    return df


def save_data(df: pd.DataFrame) -> None:
    df.to_csv(CSV_FILE, index=False)


def next_claim_id(df: pd.DataFrame) -> str:
    if df.empty:
        return "CLM-0001"
    nums = df["claim_id"].dropna().str.extract(r"CLM-(\d+)")[0].astype(float)
    return f"CLM-{int(nums.max()) + 1:04d}"
