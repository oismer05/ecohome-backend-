-- =====================================================================
-- EcoHome Store · Esquema de base de datos (PostgreSQL)
-- Unidad 1: users y products  ·  Unidad 2: messages (chat interno)
-- Es idempotente: se puede ejecutar varias veces sin perder datos y
-- también actualiza una base de datos creada en la unidad 1.
-- =====================================================================

-- ---------- users ----------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL        PRIMARY KEY,
    name          VARCHAR(100)  NOT NULL,
    email         VARCHAR(150)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,              -- hash bcrypt, nunca texto plano
    role          VARCHAR(20)   NOT NULL DEFAULT 'cliente',
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

-- ---------- roles (unidad 2: personal interno por área) --------------
-- admin y los roles de área (ventas, logistica, soporte) usan el chat interno;
-- cliente no. Se recrea la restricción para actualizar bases de la unidad 1.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'ventas', 'logistica', 'soporte', 'cliente'));

-- ---------- messages (unidad 2: chat interno) -----------------------
CREATE TABLE IF NOT EXISTS messages (
    id          SERIAL        PRIMARY KEY,
    user_id     INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text        VARCHAR(500)  NOT NULL CHECK (char_length(btrim(text)) > 0),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);
