import { pool } from "../connection";

export async function up() {
  await pool.query(`
    -- Expande os status válidos de pedido para incluir sinal (parcial) e pago
    ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;
    ALTER TABLE pedidos ADD CONSTRAINT pedidos_status_check
      CHECK (status IN (
        'criando_arte', 'em_aberto', 'em_producao', 'aguardando_retirada',
        'em_transporte', 'entregue', 'aguardando_pagamento', 'sinal', 'pago'
      ));

    -- Coluna para rastrear quanto já foi pago no pedido
    ALTER TABLE pedidos
      ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(12,2) NOT NULL DEFAULT 0;

    -- Vincula transações financeiras ao pedido de origem (opcional)
    ALTER TABLE transacoes_financeiras
      ADD COLUMN IF NOT EXISTS pedido_id INTEGER REFERENCES pedidos(id);

    CREATE INDEX IF NOT EXISTS idx_transacoes_pedido
      ON transacoes_financeiras(pedido_id)
      WHERE pedido_id IS NOT NULL;
  `);

  console.log(
    "✅ Migration 009: status sinal/pago em pedidos, valor_pago e pedido_id em transações",
  );
}
