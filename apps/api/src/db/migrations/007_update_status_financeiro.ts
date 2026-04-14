import { pool } from "../connection";

export async function up() {
  await pool.query(`
    -- Remove constraint antiga de status do pedido
    ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;

    -- Migra valores antigos para novos
    UPDATE pedidos SET status = 'em_aberto' WHERE status = 'aberto';
    UPDATE pedidos SET status = 'aguardando_retirada' WHERE status = 'pronto';
    UPDATE pedidos SET status = 'aguardando_pagamento' WHERE status = 'faturado';
    UPDATE pedidos SET status = 'em_producao' WHERE status = 'aguardando_material';

    -- Nova constraint com os novos status
    ALTER TABLE pedidos ADD CONSTRAINT pedidos_status_check
      CHECK (status IN ('criando_arte', 'em_aberto', 'em_producao', 'aguardando_retirada', 'em_transporte', 'entregue', 'aguardando_pagamento'));

    -- Atualiza default
    ALTER TABLE pedidos ALTER COLUMN status SET DEFAULT 'em_aberto';

    -- Tabela financeira
    CREATE TABLE IF NOT EXISTS transacoes_financeiras (
      id SERIAL PRIMARY KEY,
      tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('receita', 'despesa')),
      descricao VARCHAR(255) NOT NULL,
      valor NUMERIC(12,2) NOT NULL,
      metodo_pagamento VARCHAR(30),
      status VARCHAR(20) NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pendente', 'pago')),
      vencimento DATE,
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_transacoes_tipo ON transacoes_financeiras(tipo);
    CREATE INDEX IF NOT EXISTS idx_transacoes_status ON transacoes_financeiras(status);
  `);

  console.log(
    "✅ Migration 007: status de pedidos atualizados + tabela transacoes_financeiras criada",
  );
}
