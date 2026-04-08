import { Router, Response } from "express";
import { query } from "../db/connection";
import { AuthRequest, authMiddleware } from "../middleware/auth";
import { validarDocumento, TipoCliente } from "@erp/shared";

const router = Router();

router.use(authMiddleware);

// Listar clientes
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { busca, tipo } = req.query;
    let sql = "SELECT * FROM clientes WHERE 1=1";
    const params: unknown[] = [];
    let paramIndex = 1;

    if (busca) {
      sql += ` AND (nome_razao ILIKE $${paramIndex} OR cpf_cnpj ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR telefone ILIKE $${paramIndex})`;
      params.push(`%${busca}%`);
      paramIndex++;
    }

    if (tipo && (tipo === "PF" || tipo === "PJ")) {
      sql += ` AND tipo = $${paramIndex}`;
      params.push(tipo);
      paramIndex++;
    }

    sql += " ORDER BY nome_razao ASC";

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar clientes:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Buscar por ID
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await query("SELECT * FROM clientes WHERE id = $1", [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Cliente não encontrado" });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao buscar cliente:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Criar cliente (dados básicos)
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { nome_razao, telefone, email } = req.body;

    if (!nome_razao) {
      res.status(400).json({ error: "Campo obrigatório: nome_razao" });
      return;
    }

    const result = await query(
      `INSERT INTO clientes (nome_razao, telefone, email)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [nome_razao, telefone || null, email || null],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao criar cliente:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Atualizar dados básicos
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { nome_razao, telefone, email } = req.body;

    const result = await query(
      `UPDATE clientes SET
        nome_razao = COALESCE($1, nome_razao),
        telefone = COALESCE($2, telefone),
        email = COALESCE($3, email),
        updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [nome_razao, telefone, email, req.params.id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Cliente não encontrado" });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar cliente:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Salvar dados fiscais
router.put("/:id/fiscal", async (req: AuthRequest, res: Response) => {
  try {
    const {
      tipo,
      cpf_cnpj,
      inscricao_estadual,
      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      uf,
    } = req.body;

    if (
      !tipo ||
      !cpf_cnpj ||
      !cep ||
      !logradouro ||
      !numero ||
      !bairro ||
      !cidade ||
      !uf
    ) {
      res.status(400).json({
        error:
          "Dados fiscais obrigatórios: tipo, cpf_cnpj, cep, logradouro, numero, bairro, cidade, uf",
      });
      return;
    }

    if (!Object.values(TipoCliente).includes(tipo)) {
      res.status(400).json({ error: "Tipo deve ser PF ou PJ" });
      return;
    }

    if (!validarDocumento(cpf_cnpj, tipo)) {
      res
        .status(400)
        .json({ error: `${tipo === "PF" ? "CPF" : "CNPJ"} inválido` });
      return;
    }

    const result = await query(
      `UPDATE clientes SET
        tipo = $1, cpf_cnpj = $2, inscricao_estadual = $3,
        cep = $4, logradouro = $5, numero = $6, complemento = $7,
        bairro = $8, cidade = $9, uf = $10, updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        tipo,
        cpf_cnpj,
        inscricao_estadual || null,
        cep,
        logradouro,
        numero,
        complemento || null,
        bairro,
        cidade,
        uf,
        req.params.id,
      ],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Cliente não encontrado" });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === "23505") {
      res
        .status(409)
        .json({ error: "CPF/CNPJ já cadastrado para outro cliente" });
      return;
    }
    console.error("Erro ao salvar dados fiscais:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Deletar cliente
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      "DELETE FROM clientes WHERE id = $1 RETURNING id",
      [req.params.id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Cliente não encontrado" });
      return;
    }
    res.json({ message: "Cliente removido com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar cliente:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
