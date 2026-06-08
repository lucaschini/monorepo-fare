import { Router, Response } from "express";
import { query, pool } from "../db/connection";
import { AuthRequest, authMiddleware, authorize } from "../middleware/auth";
import { StatusPedido, MetodoPagamento } from "@erp/shared";

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
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const ped = await query(
      `SELECT p.*, c.nome_razao AS cliente_nome
       FROM pedidos p
       JOIN clientes c ON c.id = p.cliente_id
       WHERE p.id = $1`,
      [id],
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
      res.status(400).json({
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
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const { status } = req.body;
    const valid = Object.values(StatusPedido);

    if (!status || !valid.includes(status)) {
      res.status(400).json({ error: `Status deve ser: ${valid.join(", ")}` });
      return;
    }

    const ped = await query("SELECT * FROM pedidos WHERE id = $1", [id]);
    if (ped.rows.length === 0) {
      res.status(404).json({ error: "Pedido não encontrado" });
      return;
    }

    const current = ped.rows[0].status;
    const transitions: Record<string, string[]> = {
      criando_arte: ["em_aberto"],
      em_aberto: ["em_producao", "criando_arte"],
      em_producao: ["aguardando_retirada"],
      aguardando_retirada: ["em_transporte"],
      em_transporte: ["entregue"],
      entregue: ["aguardando_pagamento"],
      aguardando_pagamento: [],
      sinal: [],
      pago: [],
    };

    if (!transitions[current]?.includes(status)) {
      res.status(400).json({
        error: `Não é possível mudar de "${current}" para "${status}"`,
      });
      return;
    }

    const result = await query(
      `UPDATE pedidos SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id],
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

router.post(
  "/:id/registrar-pagamento",
  async (req: AuthRequest, res: Response) => {
    const pedidoId = parseInt(req.params.id, 10);
    if (isNaN(pedidoId) || pedidoId <= 0) {
      res.status(400).json({ error: "ID de pedido inválido" });
      return;
    }

    const { valor, metodo_pagamento, observacoes } = req.body;

    const valorPgto = parseFloat(valor);
    if (isNaN(valorPgto) || valorPgto <= 0) {
      res.status(400).json({ error: "Valor deve ser um número positivo" });
      return;
    }

    if (
      !metodo_pagamento ||
      !Object.values(MetodoPagamento).includes(metodo_pagamento)
    ) {
      res.status(400).json({ error: "Método de pagamento inválido" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const pedResult = await client.query(
        "SELECT * FROM pedidos WHERE id = $1 FOR UPDATE",
        [pedidoId],
      );

      if (pedResult.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Pedido não encontrado" });
        return;
      }

      const pedido = pedResult.rows[0];

      if (!["aguardando_pagamento", "sinal"].includes(pedido.status)) {
        await client.query("ROLLBACK");
        res.status(400).json({
          error: `Pedido com status "${pedido.status}" não está aguardando pagamento`,
        });
        return;
      }

      const valorTotal = parseFloat(pedido.valor_total);
      const valorJaPago = parseFloat(pedido.valor_pago ?? 0);
      const saldoDevedor = valorTotal - valorJaPago;

      if (valorPgto > saldoDevedor + 0.005) {
        await client.query("ROLLBACK");
        res.status(400).json({
          error: `Valor excede o saldo devedor de R$ ${saldoDevedor.toFixed(2)}`,
        });
        return;
      }

      await client.query(
        `INSERT INTO transacoes_financeiras
         (tipo, descricao, valor, metodo_pagamento, status, pedido_id, observacoes)
       VALUES ($1, $2, $3, $4, 'pago', $5, $6)`,
        [
          "receita",
          `Pagamento – Pedido #${pedidoId}`,
          valorPgto,
          metodo_pagamento,
          pedidoId,
          observacoes ?? null,
        ],
      );

      const novoValorPago = valorJaPago + valorPgto;
      const novoStatus = novoValorPago >= valorTotal - 0.005 ? "pago" : "sinal";

      await client.query(
        "UPDATE pedidos SET status = $1, valor_pago = $2, updated_at = NOW() WHERE id = $3",
        [novoStatus, novoValorPago, pedidoId],
      );

      await client.query("COMMIT");

      res.json({
        status: novoStatus,
        valor_pago: novoValorPago,
        valor_total: valorTotal,
        valor_restante: Math.max(0, valorTotal - novoValorPago),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Erro ao registrar pagamento:", error);
      res.status(500).json({ error: "Erro interno" });
    } finally {
      client.release();
    }
  },
);

// Deletar pedido (só aberto)
router.delete("/:id", authorize("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const ped = await query("SELECT * FROM pedidos WHERE id = $1", [
      req.params.id,
    ]);
    if (ped.rows.length === 0) {
      res.status(404).json({ error: "Pedido não encontrado" });
      return;
    }

    if (
      ped.rows[0].status !== "em_aberto" &&
      ped.rows[0].status !== "criando_arte"
    ) {
      res.status(400).json({
        error: "Só é possível excluir pedidos em 'em_aberto' ou 'criando_arte'",
      });
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
