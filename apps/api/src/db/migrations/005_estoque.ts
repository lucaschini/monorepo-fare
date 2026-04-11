import { pool } from "../connection";

export async function up() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS insumos (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      unidade_medida VARCHAR(20) NOT NULL,
      estoque_atual NUMERIC(12,3) NOT NULL DEFAULT 0,
      estoque_minimo NUMERIC(12,3) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
      id SERIAL PRIMARY KEY,
      insumo_id INTEGER NOT NULL REFERENCES insumos(id),
      pedido_id INTEGER REFERENCES pedidos(id),
      tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
      quantidade NUMERIC(12,3) NOT NULL,
      lote VARCHAR(100),
      observacao TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_movimentacoes_insumo ON movimentacoes_estoque(insumo_id);
    CREATE INDEX IF NOT EXISTS idx_movimentacoes_pedido ON movimentacoes_estoque(pedido_id);
    CREATE INDEX IF NOT EXISTS idx_insumos_nome ON insumos(nome);
  `);

  console.log(
    "✅ Migration 005: tabelas insumos e movimentacoes_estoque criadas",
  );
}
