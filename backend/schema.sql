-- Reference schema (equivalent to Alembic revision 0001).
CREATE TABLE IF NOT EXISTS stock_items (
    id              SERIAL PRIMARY KEY,
    supplier        VARCHAR(120) NOT NULL,
    product_type    VARCHAR(120) NOT NULL,
    location        VARCHAR(120) NOT NULL,
    quantity        NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    purchase_price  NUMERIC(14,4) NOT NULL CHECK (purchase_price >= 0),
    currency        CHAR(3) NOT NULL,
    received_date   DATE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_stock_items_supplier ON stock_items (supplier);
CREATE INDEX IF NOT EXISTS ix_stock_items_product_type ON stock_items (product_type);
CREATE INDEX IF NOT EXISTS ix_stock_items_location ON stock_items (location);
CREATE INDEX IF NOT EXISTS ix_stock_items_received_date ON stock_items (received_date);
CREATE INDEX IF NOT EXISTS ix_stock_items_type_currency_date
    ON stock_items (product_type, currency, received_date);

-- Supports the duplicate check performed before every insert (Alembic revision 0002).
CREATE INDEX IF NOT EXISTS ix_stock_items_natural_key
    ON stock_items (supplier, product_type, location, quantity, purchase_price, currency, received_date);
