-- ---------- users ----------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL        PRIMARY KEY,
    name          VARCHAR(100)  NOT NULL,
    email         VARCHAR(150)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,              -- hash bcrypt, nunca texto plano
    role          VARCHAR(20)   NOT NULL DEFAULT 'cliente'
                  CHECK (role IN ('admin', 'cliente')),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ---------- products -------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id          SERIAL         PRIMARY KEY,
    name        VARCHAR(150)   NOT NULL,
    price       NUMERIC(10, 2) NOT NULL CHECK (price > 0),   -- nada de productos "gratis"
    in_stock    BOOLEAN        NOT NULL DEFAULT TRUE,        -- FALSE = agotado
    created_by  INTEGER        REFERENCES users(id) ON DELETE SET NULL,
    updated_by  INTEGER        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
