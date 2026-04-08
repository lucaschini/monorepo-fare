import { Router, Response } from "express";
import { query } from "../db/connection";
import { AuthRequest, authMiddleware } from "../middleware/auth";
import { validarDocumento, TipoCliente } from "@erp/shared";

const router = Router();

router.use(authMiddleware);

// Listar clientes (com busca)
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { busca, tipo } = req.query;
    let sql = "SELECT * FROM clientes WHERE 1=1";
    const params: unknown[] = [];
    let paramIndex = 1;

    if (busca) {
      sql += ` AND (nome_razao ILIKE $${paramIndex} OR cpf_cnpj ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
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

// Buscar cliente por ID
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await query("SELECT * FROM clientes WHERE id = $1", [req.params.id]);

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

// Criar cliente
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const {
      tipo, nome_razao, cpf_cnpj, inscricao_estadual,
      email, telefone, cep, logradouro, numero,
      complemento, bairro, cidade, uf,
    } = req.body;

    // Validações
    if (!tipo || !nome_razao || !cpf_cnpj || !cep || !logradouro || !numero || !bairro || !cidade || !uf) {
      res.status(400).json({ error: "Campos obrigatórios: tipo, nome_razao, cpf_cnpj, cep, logradouro, numero, bairro, cidade, uf" });
      return;
    }

    if (!Object.values(TipoCliente).includes(tipo)) {
      res.status(400).json({ error: "Tipo deve ser PF ou PJ" });
      return;
    }

    if (!validarDocumento(cpf_cnpj, tipo)) {
      res.status(400).json({ error: `${tipo === "PF" ? "CPF" : "CNPJ"} inválido` });
      return;
    }

    const result = await query(
      `INSERT INTO clientes (tipo, nome_razao, cpf_cnpj, inscricao_estadual, email, telefone, cep, logradouro, numero, complemento, bairro, cidade, uf)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [tipo, nome_razao, cpf_cnpj, inscricao_estadual, email, telefone, cep, logradouro, numero, complemento, bairro, cidade, uf]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === "23505") {
      res.status(409).json({ error: "CPF/CNPJ já cadastrado" });
      return;
    }
    console.error("Erro ao criar cliente:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Atualizar cliente
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const {
      tipo, nome_razao, cpf_cnpj, inscricao_estadual,
      email, telefone, cep, logradouro, numero,
      complemento, bairro, cidade, uf,
    } = req.body;

    if (tipo && cpf_cnpj && !validarDocumento(cpf_cnpj, tipo)) {
      res.status(400).json({ error: `${tipo === "PF" ? "CPF" : "CNPJ"} inválido` });
      return;
    }

    const result = await query(
      `UPDATE clientes SET
        tipo = COALESCE($1, tipo),
        nome_razao = COALESCE($2, nome_razao),
        cpf_cnpj = COALESCE($3, cpf_cnpj),
        inscricao_estadual = COALESCE($4, inscricao_estadual),
        email = COALESCE($5, email),
        telefone = COALESCE($6, telefone),
        cep = COALESCE($7, cep),
        logradouro = COALESCE($8, logradouro),
        numero = COALESCE($9, numero),
        complemento = COALESCE($10, complemento),
        bairro = COALESCE($11, bairro),
        cidade = COALESCE($12, cidade),
        uf = COALESCE($13, uf),
        updated_at = NOW()
       WHERE id = $14
       RETURNING *`,
      [tipo, nome_razao, cpf_cnpj, inscricao_estadual, email, telefone, cep, logradouro, numero, complemento, bairro, cidade, uf, req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Cliente não encontrado" });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === "23505") {
      res.status(409).json({ error: "CPF/CNPJ já cadastrado" });
      return;
    }
    console.error("Erro ao atualizar cliente:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Deletar cliente
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const result = await query("DELETE FROM clientes WHERE id = $1 RETURNING id", [req.params.id]);

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
