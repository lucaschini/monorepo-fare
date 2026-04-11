import { Router, Response } from "express";
import { query, pool } from "../db/connection";
import { AuthRequest, authMiddleware } from "../middleware/auth";
import { StatusPedido } from "@erp/shared";

const router = Router();
router.use(authMiddleware);

// Listar pedidos
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { cliente_id, status, busca, numero } = req.query;
    let sql = `
      SELECT p.*, c.nome_razao AS cliente_nome
      FROM pedidos p
      JOIN clientes c ON c.id = p.cliente_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let i = 1;

    if (numero) {
      sql += ` AND p.id = $${i++}`;
      params.push(numero);
    }
    if (cliente_id) {
      sql += ` AND p.cliente_id = $${i++}`;
      params.push(cliente_id);
    }
    if (status) {
      sql += ` AND p.status = $${i++}`;
      params.push(status);
    }
    if (busca) {
      sql += ` AND c.nome_razao ILIKE $${i++}`;
      params.push(`%${busca}%`);
    }

    sql += " ORDER BY p.created_at DESC";

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar pedidos:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Buscar por ID (com itens)
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const ped = await query(
      `SELECT p.*, c.nome_razao AS cliente_nome
       FROM pedidos p
       JOIN clientes c ON c.id = p.cliente_id
       WHERE p.id = $1`,
      [req.params.id],
    );

    if (ped.rows.length === 0) {
      res.status(404).json({ error: "Pedido não encontrado" });
      return;
    }

    const itens = await query(
      `SELECT pi.*, cat.nome AS catalogo_nome, cat.tipo AS catalogo_tipo, cat.unidade AS catalogo_unidade
       FROM pedido_itens pi
       JOIN catalogo cat ON cat.id = pi.catalogo_id
       WHERE pi.pedido_id = $1
       ORDER BY pi.id`,
      [req.params.id],
    );

    res.json({ ...ped.rows[0], itens: itens.rows });
  } catch (error) {
    console.error("Erro ao buscar pedido:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Criar pedido direto (sem orçamento)
router.post("/", async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { cliente_id, prazo_entrega, observacoes, itens } = req.body;

    if (!cliente_id || !itens || !Array.isArray(itens) || itens.length === 0) {
      res
        .status(400)
        .json({
          error: "Campos obrigatórios: cliente_id, itens (array não vazio)",
        });
      return;
    }

    const clienteCheck = await client.query(
      "SELECT id FROM clientes WHERE id = $1",
      [cliente_id],
    );
    if (clienteCheck.rows.length === 0) {
      res.status(400).json({ error: "Cliente não encontrado" });
      return;
    }

    await client.query("BEGIN");

    let valorTotal = 0;
    for (const item of itens) {
      valorTotal += (item.quantidade || 1) * (item.preco_unitario || 0);
    }

    const ped = await client.query(
      `INSERT INTO pedidos (cliente_id, prazo_entrega, observacoes, valor_total)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [cliente_id, prazo_entrega || null, observacoes || null, valorTotal],
    );

    const pedidoId = ped.rows[0].id;

    for (const item of itens) {
      const subtotal = (item.quantidade || 1) * (item.preco_unitario || 0);
      await client.query(
        `INSERT INTO pedido_itens (pedido_id, catalogo_id, quantidade, preco_unitario, subtotal, especificacoes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          pedidoId,
          item.catalogo_id,
          item.quantidade || 1,
          item.preco_unitario || 0,
          subtotal,
          item.especificacoes || null,
        ],
      );
    }

    await client.query("COMMIT");

    const result = await query(
      `SELECT p.*, c.nome_razao AS cliente_nome FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE p.id = $1`,
      [pedidoId],
    );
    const itensResult = await query(
      `SELECT pi.*, cat.nome AS catalogo_nome, cat.tipo AS catalogo_tipo, cat.unidade AS catalogo_unidade
       FROM pedido_itens pi JOIN catalogo cat ON cat.id = pi.catalogo_id
       WHERE pi.pedido_id = $1 ORDER BY pi.id`,
      [pedidoId],
    );

    res.status(201).json({ ...result.rows[0], itens: itensResult.rows });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erro ao criar pedido:", error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

// Alterar status
router.put("/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const valid = Object.values(StatusPedido);

    if (!status || !valid.includes(status)) {
      res.status(400).json({ error: `Status deve ser: ${valid.join(", ")}` });
      return;
    }

    const ped = await query("SELECT * FROM pedidos WHERE id = $1", [
      req.params.id,
    ]);
    if (ped.rows.length === 0) {
      res.status(404).json({ error: "Pedido não encontrado" });
      return;
    }

    const current = ped.rows[0].status;
    const transitions: Record<string, string[]> = {
      aberto: ["em_producao"],
      em_producao: ["aguardando_material", "pronto"],
      aguardando_material: ["em_producao"],
      pronto: ["entregue"],
      entregue: ["faturado"],
      faturado: [],
    };

    if (!transitions[current]?.includes(status)) {
      res
        .status(400)
        .json({
          error: `Não é possível mudar de "${current}" para "${status}"`,
        });
      return;
    }

    const result = await query(
      `UPDATE pedidos SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id],
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao alterar status:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Atualizar pedido (prazo, observações)
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { prazo_entrega, observacoes } = req.body;

    const ped = await query("SELECT * FROM pedidos WHERE id = $1", [
      req.params.id,
    ]);
    if (ped.rows.length === 0) {
      res.status(404).json({ error: "Pedido não encontrado" });
      return;
    }

    const result = await query(
      `UPDATE pedidos SET
        prazo_entrega = COALESCE($1, prazo_entrega),
        observacoes = COALESCE($2, observacoes),
        updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [prazo_entrega, observacoes, req.params.id],
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar pedido:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Deletar pedido (só aberto)
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const ped = await query("SELECT * FROM pedidos WHERE id = $1", [
      req.params.id,
    ]);
    if (ped.rows.length === 0) {
      res.status(404).json({ error: "Pedido não encontrado" });
      return;
    }

    if (ped.rows[0].status !== "aberto") {
      res
        .status(400)
        .json({ error: "Só é possível excluir pedidos com status 'aberto'" });
      return;
    }

    await query("DELETE FROM pedidos WHERE id = $1", [req.params.id]);
    res.json({ message: "Pedido removido com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar pedido:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
