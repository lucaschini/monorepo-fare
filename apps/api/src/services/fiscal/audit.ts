// apps/api/src/services/fiscal/audit.ts

import { query } from "../../db/connection";

// ══════════════════════════════════════════════════════════════
// SEGURANÇA: Log de auditoria imutável
//
// Toda operação fiscal é registrada com:
// - Quem fez (usuario_id)
// - De onde veio (IP)
// - O que foi enviado (request sanitizado)
// - O que voltou (response sanitizado)
//
// Esses registros são INSERT-only, sem UPDATE ou DELETE.
// Em produção, considere replicar para armazenamento externo
// (S3, CloudWatch) para compliance.
// ══════════════════════════════════════════════════════════════
import { CreateAuditFiscalDTO, AcaoFiscal } from "@erp/shared";

/**
 * Registra evento de auditoria fiscal
 *
 * SEGURANÇA: Sanitiza payloads para não armazenar dados
 * sensíveis como senha do certificado
 */
export async function registrarAuditoria(
  entry: CreateAuditFiscalDTO,
): Promise<void> {
  // Remove dados sensíveis antes de persistir
  const sanitizedRequest = sanitizePayload(entry.request_payload);
  const sanitizedResponse = sanitizePayload(entry.response_payload);

  await query(
    `INSERT INTO audit_fiscal
     (nota_id, acao, usuario_id, ip_origem, request_payload, response_payload, status_code, erro)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.nota_id,
      entry.acao,
      entry.usuario_id,
      entry.ip_origem,
      sanitizedRequest,
      sanitizedResponse,
      entry.status_code || null,
      entry.erro || null,
    ],
  );
}

/**
 * Remove dados sensíveis de payloads antes da persistência
 */
function sanitizePayload(payload?: string): string | null {
  if (!payload) return null;

  // Limita tamanho para evitar crescimento excessivo do banco
  const truncated =
    payload.length > 10000
      ? payload.substring(0, 10000) + "...[TRUNCADO]"
      : payload;

  // Remove possíveis senhas, tokens, chaves privadas
  return truncated
    .replace(/passphrase["\s:=]+[^\s"]+/gi, 'passphrase:"[REDACTED]"')
    .replace(/password["\s:=]+[^\s"]+/gi, 'password:"[REDACTED]"')
    .replace(/-----BEGIN[\s\S]*?END.*?-----/g, "[CERTIFICATE_REDACTED]");
}
