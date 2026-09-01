from decimal import Decimal

from app.utils.stats import median


def test_median_odd_and_even():
    assert median([Decimal(3), Decimal(1), Decimal(2)]) == Decimal(2)
    assert median([Decimal(1), Decimal(2), Decimal(3), Decimal(4)]) == Decimal("2.5")
