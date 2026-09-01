from math import ceil

from app.core.config import get_settings


def normalize(page: int, page_size: int) -> tuple[int, int]:
    settings = get_settings()
    page = max(page, 1)
    page_size = min(max(page_size, 1), settings.max_page_size)
    return page, page_size


def page_count(total: int, page_size: int) -> int:
    return ceil(total / page_size) if page_size else 0
