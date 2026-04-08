import { pool } from "../connection";

export async function up() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS catalogo (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      descricao TEXT,
      tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('produto', 'servico')),
      unidade VARCHAR(20) NOT NULL,
      preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
      codigo_fiscal VARCHAR(20),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_catalogo_tipo ON catalogo(tipo);
    CREATE INDEX IF NOT EXISTS idx_catalogo_nome ON catalogo(nome);
  `);

  console.log("✅ Migration 003: tabela catalogo criada");
}
