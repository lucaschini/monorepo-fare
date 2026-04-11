import { Router, Response } from "express";
import { query, pool } from "../db/connection";
import { AuthRequest, authMiddleware } from "../middleware/auth";
import { StatusOrcamento } from "@erp/shared";

const router = Router();
router.use(authMiddleware);

// Listar orçamentos
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { cliente_id, status, busca } = req.query;
    let sql = `
      SELECT o.*, c.nome_razao AS cliente_nome
      FROM orcamentos o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let i = 1;

    if (cliente_id) {
      sql += ` AND o.cliente_id = $${i++}`;
      params.push(cliente_id);
    }
    if (status) {
      sql += ` AND o.status = $${i++}`;
      params.push(status);
    }
    if (busca) {
      sql += ` AND c.nome_razao ILIKE $${i++}`;
      params.push(`%${busca}%`);
    }

    sql += " ORDER BY o.created_at DESC";

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar orçamentos:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Buscar por ID (com itens)
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orc = await query(
      `SELECT o.*, c.nome_razao AS cliente_nome
       FROM orcamentos o
       JOIN clientes c ON c.id = o.cliente_id
       WHERE o.id = $1`,
      [req.params.id],
    );

    if (orc.rows.length === 0) {
      res.status(404).json({ error: "Orçamento não encontrado" });
      return;
    }

    const itens = await query(
      `SELECT oi.*, cat.nome AS catalogo_nome, cat.tipo AS catalogo_tipo, cat.unidade AS catalogo_unidade
       FROM orcamento_itens oi
       JOIN catalogo cat ON cat.id = oi.catalogo_id
       WHERE oi.orcamento_id = $1
       ORDER BY oi.id`,
      [req.params.id],
    );

    res.json({ ...orc.rows[0], itens: itens.rows });
  } catch (error) {
    console.error("Erro ao buscar orçamento:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Criar orçamento
router.post("/", async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { cliente_id, validade, observacoes, itens } = req.body;

    if (!cliente_id || !itens || !Array.isArray(itens) || itens.length === 0) {
      res
        .status(400)
        .json({
          error: "Campos obrigatórios: cliente_id, itens (array não vazio)",
        });
      return;
    }

    // Verifica se cliente existe
    const clienteCheck = await client.query(
      "SELECT id FROM clientes WHERE id = $1",
      [cliente_id],
    );
    if (clienteCheck.rows.length === 0) {
      res.status(400).json({ error: "Cliente não encontrado" });
      return;
    }

    await client.query("BEGIN");

    // Calcula valor total
    let valorTotal = 0;
    for (const item of itens) {
      const subtotal = (item.quantidade || 1) * (item.preco_unitario || 0);
      valorTotal += subtotal;
    }

    // Cria orçamento
    const orc = await client.query(
      `INSERT INTO orcamentos (cliente_id, validade, observacoes, valor_total)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [cliente_id, validade || null, observacoes || null, valorTotal],
    );

    const orcamentoId = orc.rows[0].id;

    // Insere itens
    for (const item of itens) {
      const subtotal = (item.quantidade || 1) * (item.preco_unitario || 0);
      await client.query(
        `INSERT INTO orcamento_itens (orcamento_id, catalogo_id, quantidade, preco_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          orcamentoId,
          item.catalogo_id,
          item.quantidade || 1,
          item.preco_unitario || 0,
          subtotal,
        ],
      );
    }

    await client.query("COMMIT");

    // Retorna completo
    const result = await query(
      `SELECT o.*, c.nome_razao AS cliente_nome
       FROM orcamentos o JOIN clientes c ON c.id = o.cliente_id
       WHERE o.id = $1`,
      [orcamentoId],
    );
    const itensResult = await query(
      `SELECT oi.*, cat.nome AS catalogo_nome, cat.tipo AS catalogo_tipo, cat.unidade AS catalogo_unidade
       FROM orcamento_itens oi JOIN catalogo cat ON cat.id = oi.catalogo_id
       WHERE oi.orcamento_id = $1 ORDER BY oi.id`,
      [orcamentoId],
    );

    res.status(201).json({ ...result.rows[0], itens: itensResult.rows });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erro ao criar orçamento:", error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

// Atualizar orçamento (só se rascunho)
router.put("/:id", async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const orc = await client.query("SELECT * FROM orcamentos WHERE id = $1", [
      req.params.id,
    ]);
    if (orc.rows.length === 0) {
      res.status(404).json({ error: "Orçamento não encontrado" });
      return;
    }

    if (orc.rows[0].status !== "rascunho") {
      res
        .status(400)
        .json({ error: "Só é possível editar orçamentos em rascunho" });
      return;
    }

    const { validade, observacoes, itens } = req.body;

    await client.query("BEGIN");

    if (itens && Array.isArray(itens)) {
      // Recalcula
      let valorTotal = 0;
      for (const item of itens) {
        valorTotal += (item.quantidade || 1) * (item.preco_unitario || 0);
      }

      // Remove itens antigos e insere novos
      await client.query(
        "DELETE FROM orcamento_itens WHERE orcamento_id = $1",
        [req.params.id],
      );

      for (const item of itens) {
        const subtotal = (item.quantidade || 1) * (item.preco_unitario || 0);
        await client.query(
          `INSERT INTO orcamento_itens (orcamento_id, catalogo_id, quantidade, preco_unitario, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            req.params.id,
            item.catalogo_id,
            item.quantidade || 1,
            item.preco_unitario || 0,
            subtotal,
          ],
        );
      }

      await client.query(
        `UPDATE orcamentos SET validade = COALESCE($1, validade), observacoes = COALESCE($2, observacoes), valor_total = $3, updated_at = NOW() WHERE id = $4`,
        [validade, observacoes, valorTotal, req.params.id],
      );
    } else {
      await client.query(
        `UPDATE orcamentos SET validade = COALESCE($1, validade), observacoes = COALESCE($2, observacoes), updated_at = NOW() WHERE id = $3`,
        [validade, observacoes, req.params.id],
      );
    }

    await client.query("COMMIT");

    // Retorna atualizado
    const result = await query(
      `SELECT o.*, c.nome_razao AS cliente_nome FROM orcamentos o JOIN clientes c ON c.id = o.cliente_id WHERE o.id = $1`,
      [req.params.id],
    );
    const itensResult = await query(
      `SELECT oi.*, cat.nome AS catalogo_nome, cat.tipo AS catalogo_tipo, cat.unidade AS catalogo_unidade
       FROM orcamento_itens oi JOIN catalogo cat ON cat.id = oi.catalogo_id
       WHERE oi.orcamento_id = $1 ORDER BY oi.id`,
      [req.params.id],
    );

    res.json({ ...result.rows[0], itens: itensResult.rows });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erro ao atualizar orçamento:", error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

// Alterar status
router.put("/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const valid = Object.values(StatusOrcamento);

    if (!status || !valid.includes(status)) {
      res.status(400).json({ error: `Status deve ser: ${valid.join(", ")}` });
      return;
    }

    const orc = await query("SELECT * FROM orcamentos WHERE id = $1", [
      req.params.id,
    ]);
    if (orc.rows.length === 0) {
      res.status(404).json({ error: "Orçamento não encontrado" });
      return;
    }

    // Regras de transição
    const current = orc.rows[0].status;
    const transitions: Record<string, string[]> = {
      rascunho: ["enviado"],
      enviado: ["aprovado", "recusado"],
      aprovado: [],
      recusado: ["rascunho"],
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
      `UPDATE orcamentos SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id],
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao alterar status:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Converter em pedido
router.post("/:id/converter", async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const orc = await client.query("SELECT * FROM orcamentos WHERE id = $1", [
      req.params.id,
    ]);

    if (orc.rows.length === 0) {
      res.status(404).json({ error: "Orçamento não encontrado" });
      return;
    }

    if (orc.rows[0].status !== "aprovado") {
      res
        .status(400)
        .json({ error: "Só é possível converter orçamentos aprovados" });
      return;
    }

    if (orc.rows[0].pedido_id) {
      res
        .status(400)
        .json({ error: "Este orçamento já foi convertido em pedido" });
      return;
    }

    const orcamento = orc.rows[0];

    await client.query("BEGIN");

    // Cria pedido
    const pedido = await client.query(
      `INSERT INTO pedidos (cliente_id, orcamento_id, valor_total, observacoes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        orcamento.cliente_id,
        orcamento.id,
        orcamento.valor_total,
        orcamento.observacoes,
      ],
    );

    const pedidoId = pedido.rows[0].id;

    // Copia itens
    await client.query(
      `INSERT INTO pedido_itens (pedido_id, catalogo_id, quantidade, preco_unitario, subtotal)
       SELECT $1, catalogo_id, quantidade, preco_unitario, subtotal
       FROM orcamento_itens
       WHERE orcamento_id = $2`,
      [pedidoId, orcamento.id],
    );

    // Marca orçamento como convertido
    await client.query(
      "UPDATE orcamentos SET pedido_id = $1, updated_at = NOW() WHERE id = $2",
      [pedidoId, orcamento.id],
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Pedido criado com sucesso",
      pedido_id: pedidoId,
      orcamento_id: orcamento.id,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erro ao converter orçamento:", error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

// Deletar orçamento (só rascunho)
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orc = await query("SELECT * FROM orcamentos WHERE id = $1", [
      req.params.id,
    ]);
    if (orc.rows.length === 0) {
      res.status(404).json({ error: "Orçamento não encontrado" });
      return;
    }

    if (orc.rows[0].status !== "rascunho") {
      res
        .status(400)
        .json({ error: "Só é possível excluir orçamentos em rascunho" });
      return;
    }

    await query("DELETE FROM orcamentos WHERE id = $1", [req.params.id]);
    res.json({ message: "Orçamento removido com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar orçamento:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
