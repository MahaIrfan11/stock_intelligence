"""index for duplicate detection

Revision ID: 0002
Revises: 0001
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_stock_items_natural_key",
        "stock_items",
        ["supplier", "product_type", "location", "quantity", "purchase_price", "currency", "received_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_stock_items_natural_key", table_name="stock_items")
