import { Router, Response } from "express";
import { query, pool } from "../db/connection";
import { AuthRequest, authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

// Registrar entrega de um pedido
router.post("/:pedidoId/entregar", async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const pedido = await client.query(
      `SELECT p.*, c.nome_razao AS cliente_nome
       FROM pedidos p
       JOIN clientes c ON c.id = p.cliente_id
       WHERE p.id = $1`,
      [req.params.pedidoId],
    );

    if (pedido.rows.length === 0) {
      res.status(404).json({ error: "Pedido não encontrado" });
      return;
    }

    if (pedido.rows[0].status !== "entregue") {
      res.status(400).json({
        error: "Só é possível criar notas para pedidos com status 'entregue'",
      });
      return;
    }

    const ped = pedido.rows[0];

    await client.query("BEGIN");

    // Determina tipo de nota baseado nos itens do pedido
    const itens = await client.query(
      `SELECT DISTINCT cat.tipo
       FROM pedido_itens pi
       JOIN catalogo cat ON cat.id = pi.catalogo_id
       WHERE pi.pedido_id = $1`,
      [ped.id],
    );

    const tipos = itens.rows.map((r: any) => r.tipo);
    const notasCriadas: any[] = [];

    // Cria nota(s) com status "aguardando" (placeholder para Fase 6)
    if (tipos.includes("produto")) {
      const nota = await client.query(
        `INSERT INTO notas_fiscais (pedido_id, cliente_id, tipo, status, valor)
         VALUES ($1, $2, 'nfe', 'aguardando', $3)
         RETURNING *`,
        [ped.id, ped.cliente_id, ped.valor_total],
      );
      notasCriadas.push(nota.rows[0]);
    }

    if (tipos.includes("servico")) {
      const nota = await client.query(
        `INSERT INTO notas_fiscais (pedido_id, cliente_id, tipo, status, valor)
         VALUES ($1, $2, 'nfse', 'aguardando', $3)
         RETURNING *`,
        [ped.id, ped.cliente_id, ped.valor_total],
      );
      notasCriadas.push(nota.rows[0]);
    }

    await client.query("COMMIT");

    res.json({
      message: "Entrega registrada com sucesso",
      pedido_id: ped.id,
      status: "entregue",
      notas_pendentes: notasCriadas.length,
      notas: notasCriadas,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erro ao registrar entrega:", error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

export default router;
