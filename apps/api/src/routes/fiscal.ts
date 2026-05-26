// apps/api/src/routes/fiscal.ts

import { Router, Response } from "express";
import { query } from "../db/connection";
import { AuthRequest, authMiddleware } from "../middleware/auth";

// Import estático APENAS do certificate (não depende de xml-crypto)
import { encryptPassword } from "../services/fiscal/certificate";

const router = Router();
router.use(authMiddleware);

// ══════════════════════════════════════════════════════
// Helper: carrega o serviço fiscal sob demanda
// Se xml-crypto ou outra dependência falhar, o erro
// é capturado no handler, não no carregamento do módulo
// ══════════════════════════════════════════════════════

async function loadFiscalService() {
  try {
    return await import("../services/fiscal");
  } catch (err: any) {
    throw new Error(
      `Módulo fiscal não disponível: ${err.message}. Verifique se xml-crypto e uuid estão instalados.`,
    );
  }
}

// ══════════════════════════════════════════════════════
// Configuração do emitente (não depende do serviço fiscal)
// ══════════════════════════════════════════════════════

router.get("/config", async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      "SELECT * FROM config_fiscal ORDER BY id LIMIT 1",
    );
    if (result.rows.length === 0) {
      res.json(null);
      return;
    }
    const config = { ...result.rows[0] };
    delete config.certificado_senha_enc;
    config.certificado_configurado = !!result.rows[0].certificado_senha_enc;
    res.json(config);
  } catch (error) {
    console.error("Erro ao buscar config fiscal:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.put("/config", async (req: AuthRequest, res: Response) => {
  try {
    const {
      cnpj,
      razao_social,
      nome_fantasia,
      inscricao_municipal,
      regime_tributario,
      cnae_principal,
      codigo_municipio,
      uf,
      aliquota_iss,
      certificado_path,
      certificado_senha,
      ambiente,
      serie_dps,
    } = req.body;

    if (!cnpj || !razao_social || !inscricao_municipal) {
      res.status(400).json({
        error: "Campos obrigatórios: cnpj, razao_social, inscricao_municipal",
      });
      return;
    }

    let senhaCriptografada = null;
    if (certificado_senha) {
      senhaCriptografada = encryptPassword(certificado_senha);
    }

    const existing = await query("SELECT id FROM config_fiscal LIMIT 1");

    if (existing.rows.length > 0) {
      let sql = `UPDATE config_fiscal SET
        cnpj = $1, razao_social = $2, nome_fantasia = $3,
        inscricao_municipal = $4, regime_tributario = $5,
        cnae_principal = $6, codigo_municipio = $7, uf = $8,
        aliquota_iss = $9, ambiente = $10, updated_at = NOW()`;
      const params: any[] = [
        cnpj,
        razao_social,
        nome_fantasia || null,
        inscricao_municipal,
        regime_tributario || "simples_nacional",
        cnae_principal || null,
        codigo_municipio || "3525904",
        uf || "SP",
        aliquota_iss || 5.0,
        ambiente || "homologacao",
      ];

      let paramIdx = 11;
      if (certificado_path) {
        sql += `, certificado_path = $${paramIdx++}`;
        params.push(certificado_path);
      }
      if (senhaCriptografada) {
        sql += `, certificado_senha_enc = $${paramIdx++}`;
        params.push(senhaCriptografada);
      }
      if (serie_dps) {
        sql += `, serie_dps = $${paramIdx++}`;
        params.push(serie_dps);
      }

      sql += ` WHERE id = $${paramIdx} RETURNING *`;
      params.push(existing.rows[0].id);

      const result = await query(sql, params);
      const config = { ...result.rows[0] };
      delete config.certificado_senha_enc;
      res.json(config);
    } else {
      const result = await query(
        `INSERT INTO config_fiscal
         (cnpj, razao_social, nome_fantasia, inscricao_municipal,
          regime_tributario, cnae_principal, codigo_municipio, uf,
          aliquota_iss, certificado_path, certificado_senha_enc,
          ambiente, serie_dps)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [
          cnpj,
          razao_social,
          nome_fantasia || null,
          inscricao_municipal,
          regime_tributario || "simples_nacional",
          cnae_principal || null,
          codigo_municipio || "3525904",
          uf || "SP",
          aliquota_iss || 5.0,
          certificado_path || null,
          senhaCriptografada,
          ambiente || "homologacao",
          serie_dps || "900",
        ],
      );
      const config = { ...result.rows[0] };
      delete config.certificado_senha_enc;
      res.status(201).json(config);
    }
  } catch (error) {
    console.error("Erro ao salvar config fiscal:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ══════════════════════════════════════════════════════
// Operações fiscais (import dinâmico)
// ══════════════════════════════════════════════════════
router.post(
  "/notas/from-pedido/:pedidoId",
  async (req: AuthRequest, res: Response) => {
    const pedidoId = parseInt(req.params.pedidoId, 10);
    if (isNaN(pedidoId) || pedidoId <= 0) {
      res.status(400).json({ error: "ID de pedido inválido" });
      return;
    }

    try {
      const existing = await query(
        `SELECT * FROM notas_fiscais
       WHERE pedido_id = $1 AND status != 'cancelada'
       ORDER BY id DESC LIMIT 1`,
        [pedidoId],
      );

      if (existing.rows.length > 0) {
        res.json(existing.rows[0]);
        return;
      }

      const pedResult = await query(
        `SELECT p.*, c.id AS cid
       FROM pedidos p
       JOIN clientes c ON c.id = p.cliente_id
       WHERE p.id = $1`,
        [pedidoId],
      );

      if (pedResult.rows.length === 0) {
        res.status(404).json({ error: "Pedido não encontrado" });
        return;
      }

      const pedido = pedResult.rows[0];

      if (pedido.status !== "pago") {
        res.status(400).json({
          error:
            "O pedido precisa estar com status 'pago' para emitir nota fiscal",
        });
        return;
      }

      const notaResult = await query(
        `INSERT INTO notas_fiscais (pedido_id, cliente_id, tipo, valor)
       VALUES ($1, $2, 'nfse', $3)
       RETURNING *`,
        [pedidoId, pedido.cliente_id, pedido.valor_total],
      );

      res.status(201).json(notaResult.rows[0]);
    } catch (error) {
      console.error("Erro ao criar nota a partir do pedido:", error);
      res.status(500).json({ error: "Erro interno" });
    }
  },
);

router.post("/notas/:id/emitir", async (req: AuthRequest, res: Response) => {
  try {
    const fiscal = await loadFiscalService();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const resultado = await fiscal.emitirNFSe(
      Number(req.params.id),
      req.userId!,
      ip,
    );

    if (resultado.sucesso) {
      res.json({ message: "NFS-e emitida com sucesso", ...resultado });
    } else {
      res.status(422).json({
        error: "Falha na emissão da NFS-e",
        mensagem: resultado.mensagem_erro,
      });
    }
  } catch (error: any) {
    const msg = error.message || "Erro desconhecido";
    const isValidation =
      msg.includes("não encontrad") ||
      msg.includes("não possui") ||
      msg.includes("já foi") ||
      msg.includes("foi cancelada") ||
      msg.includes("apenas NFS-e") ||
      msg.includes("Configure") ||
      msg.includes("ertificado") ||
      msg.includes("Módulo fiscal");

    if (isValidation) {
      res.status(400).json({ error: msg });
      return;
    }
    console.error("Erro ao emitir NFS-e:", error);
    res.status(500).json({ error: "Erro interno na emissão" });
  }
});

router.get("/notas/:id/consultar", async (req: AuthRequest, res: Response) => {
  try {
    const fiscal = await loadFiscalService();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const resultado = await fiscal.consultarNFSe(
      Number(req.params.id),
      req.userId!,
      ip,
    );
    res.json(resultado);
  } catch (error: any) {
    const msg = error.message || "Erro desconhecido";
    const isValidation =
      msg.includes("não encontrad") ||
      msg.includes("chave de acesso") ||
      msg.includes("ertificado") ||
      msg.includes("Módulo fiscal");

    if (isValidation) {
      res.status(400).json({ error: msg });
      return;
    }
    console.error("Erro ao consultar NFS-e:", error);
    res.status(500).json({ error: "Erro interno na consulta" });
  }
});

router.post("/notas/:id/cancelar", async (req: AuthRequest, res: Response) => {
  try {
    const fiscal = await loadFiscalService();
    const { justificativa } = req.body;
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    const resultado = await fiscal.cancelarNFSe(
      Number(req.params.id),
      justificativa,
      req.userId!,
      ip,
    );

    if (resultado.sucesso) {
      res.json({ message: "NFS-e cancelada com sucesso", ...resultado });
    } else {
      res.status(422).json({
        error: "Falha no cancelamento",
        mensagem: resultado.mensagem_erro,
      });
    }
  } catch (error: any) {
    const msg = error.message || "Erro desconhecido";
    const isValidation =
      msg.includes("15 caracteres") ||
      msg.includes("não encontrad") ||
      msg.includes("autorizada") ||
      msg.includes("chave de acesso") ||
      msg.includes("Módulo fiscal");

    if (isValidation) {
      res.status(400).json({ error: msg });
      return;
    }
    console.error("Erro ao cancelar NFS-e:", error);
    res.status(500).json({ error: "Erro interno no cancelamento" });
  }
});

router.post("/notas/reprocessar", async (req: AuthRequest, res: Response) => {
  try {
    const fiscal = await loadFiscalService();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const resultado = await fiscal.reprocessarRejeitadas(req.userId!, ip);
    res.json(resultado);
  } catch (error: any) {
    const msg = error.message || "Erro desconhecido";
    if (msg.includes("Módulo fiscal")) {
      res.status(400).json({ error: msg });
      return;
    }
    console.error("Erro ao reprocessar:", error);
    res.status(500).json({ error: msg });
  }
});

// ══════════════════════════════════════════════════════
// Consultas simples (não dependem do serviço fiscal)
// ══════════════════════════════════════════════════════

router.get("/notas", async (req: AuthRequest, res: Response) => {
  try {
    const { cliente_id, pedido_id, tipo, status, de, ate } = req.query;
    let sql = `
      SELECT nf.*, c.nome_razao AS cliente_nome
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
    res.json((await query(sql, params)).rows);
  } catch (error) {
    console.error("Erro ao listar notas:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/notas/:id", async (req: AuthRequest, res: Response) => {
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

router.get(
  "/notas/cliente/:clienteId",
  async (req: AuthRequest, res: Response) => {
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
  },
);

router.get("/auditoria/:notaId", async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT af.*, u.nome AS usuario_nome
       FROM audit_fiscal af
       JOIN usuarios u ON u.id = af.usuario_id
       WHERE af.nota_id = $1
       ORDER BY af.created_at DESC`,
      [req.params.notaId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar auditoria:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
