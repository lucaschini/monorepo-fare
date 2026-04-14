import { pool } from "../db/connection";

export async function cleanDatabase() {
  await pool.query(`
    DELETE FROM transacoes_financeiras;
    DELETE FROM notas_fiscais;
    DELETE FROM movimentacoes_estoque;
    DELETE FROM pedido_itens;
    DELETE FROM orcamento_itens;
    DELETE FROM pedidos;
    DELETE FROM orcamentos;
    DELETE FROM catalogo;
    DELETE FROM clientes;
  `);
}
