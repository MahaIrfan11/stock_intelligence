from decimal import Decimal


def median(values: list[Decimal]) -> Decimal:
    """Median of a non-empty list of Decimals."""
    ordered = sorted(values)
    n = len(ordered)
    mid = n // 2
    if n % 2:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / Decimal(2)
