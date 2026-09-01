"""create stock_items

Revision ID: 0001
Revises:
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stock_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("supplier", sa.String(120), nullable=False),
        sa.Column("product_type", sa.String(120), nullable=False),
        sa.Column("location", sa.String(120), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("purchase_price", sa.Numeric(14, 4), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("received_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("quantity > 0", name="ck_stock_items_quantity_positive"),
        sa.CheckConstraint("purchase_price >= 0", name="ck_stock_items_price_non_negative"),
    )
    op.create_index("ix_stock_items_supplier", "stock_items", ["supplier"])
    op.create_index("ix_stock_items_product_type", "stock_items", ["product_type"])
    op.create_index("ix_stock_items_location", "stock_items", ["location"])
    op.create_index("ix_stock_items_received_date", "stock_items", ["received_date"])
    op.create_index(
        "ix_stock_items_type_currency_date",
        "stock_items",
        ["product_type", "currency", "received_date"],
    )


def downgrade() -> None:
    op.drop_table("stock_items")
