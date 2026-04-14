import { Router, Response } from "express";
import { query } from "../db/connection";
import { AuthRequest, authMiddleware } from "../middleware/auth";
import { TipoTransacao, StatusTransacao, MetodoPagamento } from "@erp/shared";

const router = Router();
router.use(authMiddleware);

// Listar transações
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { tipo, status, de, ate } = req.query;
    let sql = "SELECT * FROM transacoes_financeiras WHERE 1=1";
    const params: unknown[] = [];
    let i = 1;

    if (tipo) {
      sql += ` AND tipo = $${i++}`;
      params.push(tipo);
    }
    if (status) {
      sql += ` AND status = $${i++}`;
      params.push(status);
    }
    if (de) {
      sql += ` AND created_at >= $${i++}`;
      params.push(de);
    }
    if (ate) {
      sql += ` AND created_at <= $${i++}::date + interval '1 day'`;
      params.push(ate);
    }

    sql += " ORDER BY created_at DESC";
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar transações:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Criar transação
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const {
      tipo,
      descricao,
      valor,
      metodo_pagamento,
      status,
      vencimento,
      observacoes,
    } = req.body;

    if (!tipo || !descricao || valor === undefined) {
      res
        .status(400)
        .json({ error: "Campos obrigatórios: tipo, descricao, valor" });
      return;
    }

    if (!Object.values(TipoTransacao).includes(tipo)) {
      res.status(400).json({ error: "Tipo deve ser 'receita' ou 'despesa'" });
      return;
    }

    if (isNaN(valor) || valor <= 0) {
      res.status(400).json({ error: "Valor deve ser um número positivo" });
      return;
    }

    if (
      metodo_pagamento &&
      !Object.values(MetodoPagamento).includes(metodo_pagamento)
    ) {
      res.status(400).json({ error: "Método de pagamento inválido" });
      return;
    }

    const result = await query(
      `INSERT INTO transacoes_financeiras (tipo, descricao, valor, metodo_pagamento, status, vencimento, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        tipo,
        descricao,
        valor,
        metodo_pagamento || null,
        status || "pendente",
        vencimento || null,
        observacoes || null,
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao criar transação:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Atualizar status para pago
router.put("/:id/pagar", async (req: AuthRequest, res: Response) => {
  try {
    const { metodo_pagamento } = req.body;
    const result = await query(
      `UPDATE transacoes_financeiras SET status = 'pago', metodo_pagamento = COALESCE($1, metodo_pagamento), updated_at = NOW() WHERE id = $2 RETURNING *`,
      [metodo_pagamento, req.params.id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Transação não encontrada" });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao pagar transação:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Deletar transação
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      "DELETE FROM transacoes_financeiras WHERE id = $1 RETURNING id",
      [req.params.id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Transação não encontrada" });
      return;
    }
    res.json({ message: "Transação removida com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar transação:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Resumo financeiro
router.get("/resumo", async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo = 'receita' AND status = 'pago' THEN valor ELSE 0 END), 0) AS receitas_pagas,
        COALESCE(SUM(CASE WHEN tipo = 'despesa' AND status = 'pago' THEN valor ELSE 0 END), 0) AS despesas_pagas,
        COALESCE(SUM(CASE WHEN tipo = 'receita' AND status = 'pendente' THEN valor ELSE 0 END), 0) AS receitas_pendentes,
        COALESCE(SUM(CASE WHEN tipo = 'despesa' AND status = 'pendente' THEN valor ELSE 0 END), 0) AS despesas_pendentes
      FROM transacoes_financeiras
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao buscar resumo:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
