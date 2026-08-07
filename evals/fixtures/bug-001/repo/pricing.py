from decimal import Decimal

def cents(total: str) -> int:
    return int(round(float(total) * 100))
