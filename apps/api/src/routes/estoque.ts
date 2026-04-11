import { Router, Response } from "express";
import { query, pool } from "../db/connection";
import { AuthRequest, authMiddleware } from "../middleware/auth";
import { TipoMovimentacao } from "@erp/shared";

const router = Router();
router.use(authMiddleware);

// ── INSUMOS ──

// Listar insumos
router.get("/insumos", async (req: AuthRequest, res: Response) => {
  try {
    const { busca } = req.query;
    let sql = "SELECT * FROM insumos WHERE 1=1";
    const params: unknown[] = [];
    let i = 1;

    if (busca) {
      sql += ` AND nome ILIKE $${i++}`;
      params.push(`%${busca}%`);
    }

    sql += " ORDER BY nome ASC";
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar insumos:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Buscar insumo por ID
router.get("/insumos/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await query("SELECT * FROM insumos WHERE id = $1", [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Insumo não encontrado" });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao buscar insumo:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Criar insumo
router.post("/insumos", async (req: AuthRequest, res: Response) => {
  try {
    const { nome, unidade_medida, estoque_minimo } = req.body;

    if (!nome || !unidade_medida) {
      res
        .status(400)
        .json({ error: "Campos obrigatórios: nome, unidade_medida" });
      return;
    }

    if (
      estoque_minimo !== undefined &&
      (isNaN(estoque_minimo) || estoque_minimo < 0)
    ) {
      res.status(400).json({ error: "Estoque mínimo deve ser um número >= 0" });
      return;
    }

    const result = await query(
      `INSERT INTO insumos (nome, unidade_medida, estoque_minimo)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [nome, unidade_medida, estoque_minimo || 0],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao criar insumo:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Atualizar insumo
router.put("/insumos/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { nome, unidade_medida, estoque_minimo } = req.body;

    if (
      estoque_minimo !== undefined &&
      (isNaN(estoque_minimo) || estoque_minimo < 0)
    ) {
      res.status(400).json({ error: "Estoque mínimo deve ser um número >= 0" });
      return;
    }

    const result = await query(
      `UPDATE insumos SET
        nome = COALESCE($1, nome),
        unidade_medida = COALESCE($2, unidade_medida),
        estoque_minimo = COALESCE($3, estoque_minimo),
        updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [nome, unidade_medida, estoque_minimo, req.params.id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Insumo não encontrado" });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar insumo:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Deletar insumo (só se não tiver movimentações)
router.delete("/insumos/:id", async (req: AuthRequest, res: Response) => {
  try {
    const movs = await query(
      "SELECT id FROM movimentacoes_estoque WHERE insumo_id = $1 LIMIT 1",
      [req.params.id],
    );
    if (movs.rows.length > 0) {
      res
        .status(400)
        .json({
          error: "Não é possível excluir insumo com movimentações registradas",
        });
      return;
    }

    const result = await query(
      "DELETE FROM insumos WHERE id = $1 RETURNING id",
      [req.params.id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Insumo não encontrado" });
      return;
    }

    res.json({ message: "Insumo removido com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar insumo:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ── ALERTAS ──

router.get("/alertas", async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      "SELECT * FROM insumos WHERE estoque_atual <= estoque_minimo AND estoque_minimo > 0 ORDER BY (estoque_atual - estoque_minimo) ASC",
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar alertas:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ── MOVIMENTAÇÕES ──

// Registrar movimentação
router.post("/movimentacoes", async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { insumo_id, pedido_id, tipo, quantidade, lote, observacao } =
      req.body;

    if (!insumo_id || !tipo || !quantidade) {
      res
        .status(400)
        .json({ error: "Campos obrigatórios: insumo_id, tipo, quantidade" });
      return;
    }

    if (!Object.values(TipoMovimentacao).includes(tipo)) {
      res.status(400).json({ error: "Tipo deve ser 'entrada' ou 'saida'" });
      return;
    }

    if (isNaN(quantidade) || quantidade <= 0) {
      res.status(400).json({ error: "Quantidade deve ser um número positivo" });
      return;
    }

    await client.query("BEGIN");

    // Verifica insumo
    const insumo = await client.query(
      "SELECT * FROM insumos WHERE id = $1 FOR UPDATE",
      [insumo_id],
    );
    if (insumo.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Insumo não encontrado" });
      return;
    }

    // Verifica pedido se informado
    if (pedido_id) {
      const pedido = await client.query(
        "SELECT id FROM pedidos WHERE id = $1",
        [pedido_id],
      );
      if (pedido.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Pedido não encontrado" });
        return;
      }
    }

    // Verifica saldo para saída
    const estoqueAtual = parseFloat(insumo.rows[0].estoque_atual);
    if (tipo === "saida" && estoqueAtual < quantidade) {
      await client.query("ROLLBACK");
      res.status(400).json({
        error: `Estoque insuficiente. Disponível: ${estoqueAtual} ${insumo.rows[0].unidade_medida}`,
      });
      return;
    }

    // Insere movimentação
    const mov = await client.query(
      `INSERT INTO movimentacoes_estoque (insumo_id, pedido_id, tipo, quantidade, lote, observacao)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        insumo_id,
        pedido_id || null,
        tipo,
        quantidade,
        lote || null,
        observacao || null,
      ],
    );

    // Atualiza estoque_atual
    const delta = tipo === "entrada" ? quantidade : -quantidade;
    await client.query(
      "UPDATE insumos SET estoque_atual = estoque_atual + $1, updated_at = NOW() WHERE id = $2",
      [delta, insumo_id],
    );

    await client.query("COMMIT");

    // Retorna movimentação com dados do insumo atualizados
    const updated = await query("SELECT * FROM insumos WHERE id = $1", [
      insumo_id,
    ]);
    res.status(201).json({
      movimentacao: mov.rows[0],
      insumo: updated.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erro ao registrar movimentação:", error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

// Extrato de movimentações por insumo
router.get("/insumos/:id/extrato", async (req: AuthRequest, res: Response) => {
  try {
    const { de, ate } = req.query;

    const insumo = await query("SELECT * FROM insumos WHERE id = $1", [
      req.params.id,
    ]);
    if (insumo.rows.length === 0) {
      res.status(404).json({ error: "Insumo não encontrado" });
      return;
    }

    let sql = `
      SELECT m.*, p.id AS pedido_numero
      FROM movimentacoes_estoque m
      LEFT JOIN pedidos p ON p.id = m.pedido_id
      WHERE m.insumo_id = $1
    `;
    const params: unknown[] = [req.params.id];
    let i = 2;

    if (de) {
      sql += ` AND m.created_at >= $${i++}`;
      params.push(de);
    }
    if (ate) {
      sql += ` AND m.created_at <= $${i++}::date + interval '1 day'`;
      params.push(ate);
    }

    sql += " ORDER BY m.created_at DESC";

    const movs = await query(sql, params);

    res.json({
      insumo: insumo.rows[0],
      movimentacoes: movs.rows,
    });
  } catch (error) {
    console.error("Erro ao buscar extrato:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Insumos alocados para um pedido
router.get("/pedido/:pedidoId", async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT m.*, i.nome AS insumo_nome, i.unidade_medida AS insumo_unidade
       FROM movimentacoes_estoque m
       JOIN insumos i ON i.id = m.insumo_id
       WHERE m.pedido_id = $1 AND m.tipo = 'saida'
       ORDER BY m.created_at DESC`,
      [req.params.pedidoId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar insumos do pedido:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Relatório de consumo por período
router.get("/relatorio/consumo", async (req: AuthRequest, res: Response) => {
  try {
    const { de, ate } = req.query;

    let sql = `
      SELECT
        i.id, i.nome, i.unidade_medida,
        COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE 0 END), 0) AS total_entradas,
        COALESCE(SUM(CASE WHEN m.tipo = 'saida' THEN m.quantidade ELSE 0 END), 0) AS total_saidas
      FROM insumos i
      LEFT JOIN movimentacoes_estoque m ON m.insumo_id = i.id
    `;
    const params: unknown[] = [];
    let i = 1;
    const conditions: string[] = [];

    if (de) {
      conditions.push(`m.created_at >= $${i++}`);
      params.push(de);
    }
    if (ate) {
      conditions.push(`m.created_at <= $${i++}::date + interval '1 day'`);
      params.push(ate);
    }

    if (conditions.length > 0) {
      sql += " AND " + conditions.join(" AND ");
    }

    sql +=
      " GROUP BY i.id, i.nome, i.unidade_medida ORDER BY total_saidas DESC";

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao gerar relatório de consumo:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
