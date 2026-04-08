import { Router, Response } from "express";
import { query } from "../db/connection";
import { AuthRequest, authMiddleware } from "../middleware/auth";
import { TipoItem } from "@erp/shared";

const router = Router();

router.use(authMiddleware);

// Listar itens (com busca e filtro por tipo)
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { busca, tipo } = req.query;
    let sql = "SELECT * FROM catalogo WHERE 1=1";
    const params: unknown[] = [];
    let paramIndex = 1;

    if (busca) {
      sql += ` AND (nome ILIKE $${paramIndex} OR descricao ILIKE $${paramIndex})`;
      params.push(`%${busca}%`);
      paramIndex++;
    }

    if (tipo && Object.values(TipoItem).includes(tipo as TipoItem)) {
      sql += ` AND tipo = $${paramIndex}`;
      params.push(tipo);
      paramIndex++;
    }

    sql += " ORDER BY nome ASC";

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar catálogo:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Buscar por ID
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await query("SELECT * FROM catalogo WHERE id = $1", [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Item não encontrado" });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao buscar item:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Criar item
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { nome, descricao, tipo, unidade, preco_unitario, codigo_fiscal } =
      req.body;

    if (!nome || !tipo || !unidade) {
      res
        .status(400)
        .json({ error: "Campos obrigatórios: nome, tipo, unidade" });
      return;
    }

    if (!Object.values(TipoItem).includes(tipo)) {
      res.status(400).json({ error: "Tipo deve ser 'produto' ou 'servico'" });
      return;
    }

    if (
      preco_unitario !== undefined &&
      (isNaN(preco_unitario) || preco_unitario < 0)
    ) {
      res
        .status(400)
        .json({ error: "Preço unitário deve ser um número positivo" });
      return;
    }

    const result = await query(
      `INSERT INTO catalogo (nome, descricao, tipo, unidade, preco_unitario, codigo_fiscal)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        nome,
        descricao || null,
        tipo,
        unidade,
        preco_unitario || 0,
        codigo_fiscal || null,
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao criar item:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Atualizar item
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { nome, descricao, tipo, unidade, preco_unitario, codigo_fiscal } =
      req.body;

    if (tipo && !Object.values(TipoItem).includes(tipo)) {
      res.status(400).json({ error: "Tipo deve ser 'produto' ou 'servico'" });
      return;
    }

    if (
      preco_unitario !== undefined &&
      (isNaN(preco_unitario) || preco_unitario < 0)
    ) {
      res
        .status(400)
        .json({ error: "Preço unitário deve ser um número positivo" });
      return;
    }

    const result = await query(
      `UPDATE catalogo SET
        nome = COALESCE($1, nome),
        descricao = COALESCE($2, descricao),
        tipo = COALESCE($3, tipo),
        unidade = COALESCE($4, unidade),
        preco_unitario = COALESCE($5, preco_unitario),
        codigo_fiscal = COALESCE($6, codigo_fiscal),
        updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        nome,
        descricao,
        tipo,
        unidade,
        preco_unitario,
        codigo_fiscal,
        req.params.id,
      ],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Item não encontrado" });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar item:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Deletar item
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      "DELETE FROM catalogo WHERE id = $1 RETURNING id",
      [req.params.id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Item não encontrado" });
      return;
    }
    res.json({ message: "Item removido com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar item:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
