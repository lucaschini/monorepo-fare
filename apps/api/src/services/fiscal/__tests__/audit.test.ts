// apps/api/src/services/fiscal/__tests__/audit.test.ts

import { describe, it, expect, beforeAll } from "vitest";
import { pool, query } from "../../../db/connection";
import { registrarAuditoria } from "../audit";

// Usa o setup global que garante banco de teste + migrations

describe("registrarAuditoria", () => {
  let notaId: number;
  let usuarioId: number;

  beforeAll(async () => {
    // Busca IDs existentes do setup do beforeAll global
    const usuario = await query("SELECT id FROM usuarios LIMIT 1");
    usuarioId = usuario.rows[0]?.id || 1;

    const nota = await query("SELECT id FROM notas_fiscais LIMIT 1");
    notaId = nota.rows[0]?.id;

    // Limpa auditorias anteriores
    if (notaId) {
      await pool.query("DELETE FROM audit_fiscal WHERE nota_id = $1", [notaId]);
    }
  });

  it("registra evento de auditoria com sucesso", async () => {
    if (!notaId) return; // Pula se não há notas no banco de teste

    await registrarAuditoria({
      nota_id: notaId,
      acao: "emissao",
      usuario_id: usuarioId,
      ip_origem: "127.0.0.1",
      request_payload: "<xml>teste</xml>",
      status_code: 200,
    });

    const result = await query(
      "SELECT * FROM audit_fiscal WHERE nota_id = $1 ORDER BY id DESC LIMIT 1",
      [notaId],
    );
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].acao).toBe("emissao");
    expect(result.rows[0].ip_origem).toBe("127.0.0.1");
    expect(result.rows[0].status_code).toBe(200);
  });

  it("sanitiza dados sensíveis do payload", async () => {
    if (!notaId) return;

    const payloadComSenha = `
      {"passphrase": "minha-senha-secreta", "data": "teste"}
      -----BEGIN PRIVATE KEY-----
      MIIEvgIBADANBg...chave-privada-aqui
      -----END PRIVATE KEY-----
    `;

    await registrarAuditoria({
      nota_id: notaId,
      acao: "emissao",
      usuario_id: usuarioId,
      ip_origem: "192.168.1.1",
      request_payload: payloadComSenha,
    });

    const result = await query(
      "SELECT request_payload FROM audit_fiscal WHERE nota_id = $1 ORDER BY id DESC LIMIT 1",
      [notaId],
    );

    const payload = result.rows[0].request_payload;
    expect(payload).not.toContain("minha-senha-secreta");
    expect(payload).toContain("[REDACTED]");
    expect(payload).not.toContain("MIIEvgIBADANBg");
    expect(payload).toContain("[CERTIFICATE_REDACTED]");
  });

  it("trunca payloads muito grandes", async () => {
    if (!notaId) return;

    const payloadGigante = "x".repeat(20000);

    await registrarAuditoria({
      nota_id: notaId,
      acao: "consulta",
      usuario_id: usuarioId,
      ip_origem: "10.0.0.1",
      request_payload: payloadGigante,
    });

    const result = await query(
      "SELECT request_payload FROM audit_fiscal WHERE nota_id = $1 ORDER BY id DESC LIMIT 1",
      [notaId],
    );

    expect(result.rows[0].request_payload.length).toBeLessThan(15000);
    expect(result.rows[0].request_payload).toContain("[TRUNCADO]");
  });

  it("registra erro sem payload", async () => {
    if (!notaId) return;

    await registrarAuditoria({
      nota_id: notaId,
      acao: "cancelamento",
      usuario_id: usuarioId,
      ip_origem: "10.0.0.1",
      erro: "Certificado expirado",
    });

    const result = await query(
      "SELECT * FROM audit_fiscal WHERE nota_id = $1 AND acao = 'cancelamento' ORDER BY id DESC LIMIT 1",
      [notaId],
    );
    expect(result.rows[0].erro).toBe("Certificado expirado");
    expect(result.rows[0].request_payload).toBeNull();
    expect(result.rows[0].response_payload).toBeNull();
  });
});
