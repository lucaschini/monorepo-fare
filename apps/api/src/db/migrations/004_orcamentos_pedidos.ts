import { pool } from "../connection";

export async function up() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orcamentos (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      status VARCHAR(20) NOT NULL DEFAULT 'rascunho'
        CHECK (status IN ('rascunho', 'enviado', 'aprovado', 'recusado')),
      valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
      validade DATE,
      observacoes TEXT,
      pedido_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orcamento_itens (
      id SERIAL PRIMARY KEY,
      orcamento_id INTEGER NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
      catalogo_id INTEGER NOT NULL REFERENCES catalogo(id),
      quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
      preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
      subtotal NUMERIC(12,2) NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      orcamento_id INTEGER REFERENCES orcamentos(id),
      status VARCHAR(30) NOT NULL DEFAULT 'aberto'
        CHECK (status IN ('aberto', 'em_producao', 'aguardando_material', 'pronto', 'entregue', 'faturado')),
      valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
      prazo_entrega DATE,
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pedido_itens (
      id SERIAL PRIMARY KEY,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
      catalogo_id INTEGER NOT NULL REFERENCES catalogo(id),
      quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
      preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
      subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
      especificacoes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente ON orcamentos(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON orcamentos(status);
    CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
  `);

  console.log(
    "✅ Migration 004: tabelas orcamentos, orcamento_itens, pedidos e pedido_itens criadas",
  );
}
