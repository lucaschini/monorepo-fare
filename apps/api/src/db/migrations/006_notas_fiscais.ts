import { pool } from "../connection";

export async function up() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notas_fiscais (
      id SERIAL PRIMARY KEY,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      tipo VARCHAR(5) NOT NULL CHECK (tipo IN ('nfe', 'nfse')),
      status VARCHAR(20) NOT NULL DEFAULT 'aguardando'
        CHECK (status IN ('aguardando', 'autorizada', 'rejeitada', 'cancelada')),
      numero_nota VARCHAR(50),
      valor NUMERIC(12,2) NOT NULL DEFAULT 0,
      xml_envio TEXT,
      xml_retorno TEXT,
      protocolo VARCHAR(100),
      danfe_pdf_url TEXT,
      mensagem_erro TEXT,
      justificativa_cancelamento TEXT,
      emitida_em TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_notas_pedido ON notas_fiscais(pedido_id);
    CREATE INDEX IF NOT EXISTS idx_notas_cliente ON notas_fiscais(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_notas_status ON notas_fiscais(status);
  `);

  console.log("✅ Migration 006: tabela notas_fiscais criada");
}
