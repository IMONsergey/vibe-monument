from decimal import Decimal, ROUND_HALF_UP

def cents(total: str) -> int:
    value = Decimal(total).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    return int(value * 100)
