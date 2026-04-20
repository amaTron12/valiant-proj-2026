CSV_FILE = "claims.csv"

COLUMNS = [
    "claim_id", "client_name", "client_age", "client_gender",
    "location_of_residence", "pet_name", "species", "breed", "breed_type",
    "gender", "neutering_status", "color", "age", "weight", "place_of_loss",
    "diagnosis", "medications", "medicine_cost", "veterinary_services",
    "service_cost", "vet_clinic", "claim_type", "status", "missing_documents",
    "stage", "total_amount_paid", "created_at", "updated_at",
]

STATUS_COLORS = {
    "Open":     "#3B82F6",
    "Pending":  "#F59E0B",
    "Approved": "#10B981",
    "Denied":   "#EF4444",
}

SORT_LABELS = {
    "created_at":        "Date Created",
    "total_amount_paid": "Amount Paid",
    "client_name":       "Client Name",
    "status":            "Status",
    "claim_id":          "Claim ID",
}

HIGH_VALUE_THRESHOLD = 5_000
