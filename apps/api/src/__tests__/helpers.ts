import { pool } from "../db/connection";

/**
 * Limpa todas as tabelas na ordem correta (filhas → pais).
 * Ao adicionar novas tabelas, atualize só aqui.
 */
export async function cleanDatabase() {
  await pool.query(`
    DELETE FROM movimentacoes_estoque;
    DELETE FROM pedido_itens;
    DELETE FROM orcamento_itens;
    DELETE FROM pedidos;
    DELETE FROM orcamentos;
    DELETE FROM catalogo;
    DELETE FROM clientes;
  `);
}
