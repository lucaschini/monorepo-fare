import { Router, Response } from "express";
import { query, pool } from "../db/connection";
import { AuthRequest, authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

// Listar notas (com filtros)
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { cliente_id, pedido_id, tipo, status, de, ate } = req.query;
    let sql = `
      SELECT nf.*, c.nome_razao AS cliente_nome, nf.pedido_id AS pedido_numero
      FROM notas_fiscais nf
      JOIN clientes c ON c.id = nf.cliente_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let i = 1;

    if (cliente_id) {
      sql += ` AND nf.cliente_id = $${i++}`;
      params.push(cliente_id);
    }
    if (pedido_id) {
      sql += ` AND nf.pedido_id = $${i++}`;
      params.push(pedido_id);
    }
    if (tipo) {
      sql += ` AND nf.tipo = $${i++}`;
      params.push(tipo);
    }
    if (status) {
      sql += ` AND nf.status = $${i++}`;
      params.push(status);
    }
    if (de) {
      sql += ` AND nf.created_at >= $${i++}`;
      params.push(de);
    }
    if (ate) {
      sql += ` AND nf.created_at <= $${i++}::date + interval '1 day'`;
      params.push(ate);
    }

    sql += " ORDER BY nf.created_at DESC";

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar notas:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Buscar nota por ID
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT nf.*, c.nome_razao AS cliente_nome
       FROM notas_fiscais nf
       JOIN clientes c ON c.id = nf.cliente_id
       WHERE nf.id = $1`,
      [req.params.id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Nota não encontrada" });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao buscar nota:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Histórico de notas por cliente
router.get("/cliente/:clienteId", async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT nf.*, nf.pedido_id AS pedido_numero
       FROM notas_fiscais nf
       WHERE nf.cliente_id = $1
       ORDER BY nf.created_at DESC`,
      [req.params.clienteId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
