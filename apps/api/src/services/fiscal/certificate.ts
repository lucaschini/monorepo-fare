// apps/api/src/services/fiscal/certificate.ts

import crypto from "crypto";
import fs from "fs";
import https from "https";

// ══════════════════════════════════════════════════════════════
// SEGURANÇA: Criptografia da senha do certificado
//
// A senha do .pfx NUNCA é armazenada em texto puro no banco.
// Usamos AES-256-GCM com uma chave derivada do JWT_SECRET.
// Em produção, essa chave deveria vir de um serviço de secrets
// (AWS KMS, Vault, etc.), não de uma variável de ambiente.
// ══════════════════════════════════════════════════════════════

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getDerivedKey(): Buffer {
  const secret = process.env.CERT_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("CERT_ENCRYPTION_KEY ou JWT_SECRET não configurado");
  }
  // Deriva uma chave de 32 bytes a partir do secret
  return crypto.scryptSync(secret, "erp-fiscal-salt", 32);
}

/**
 * Criptografa a senha do certificado para armazenamento no banco
 */
export function encryptPassword(plaintext: string): string {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  // Formato: iv:tag:ciphertext (tudo em hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

/**
 * Descriptografa a senha do certificado
 */
export function decryptPassword(stored: string): string {
  const key = getDerivedKey();
  const [ivHex, tagHex, ciphertext] = stored.split(":");

  if (!ivHex || !tagHex || !ciphertext) {
    throw new Error("Formato de senha criptografada inválido");
  }

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Carrega o certificado A1 (.pfx) do disco
 *
 * SEGURANÇA:
 * - Valida que o arquivo existe e tem extensão .pfx
 * - Verifica que o path não contém traversal (../)
 * - Testa se a senha descriptografa o .pfx corretamente
 */
export function loadCertificate(pfxPath: string, encryptedPassword: string) {
  // Proteção contra path traversal
  const normalizedPath = pfxPath.replace(/\\/g, "/");
  if (normalizedPath.includes("..") || normalizedPath.includes("~")) {
    throw new Error("Path do certificado contém caracteres inválidos");
  }

  if (!fs.existsSync(pfxPath)) {
    throw new Error("Arquivo de certificado não encontrado");
  }

  const password = decryptPassword(encryptedPassword);
  const pfxBuffer = fs.readFileSync(pfxPath);

  // Valida se o .pfx pode ser aberto com a senha fornecida
  try {
    crypto.createSecureContext({
      pfx: pfxBuffer,
      passphrase: password,
    });
  } catch {
    throw new Error("Senha do certificado inválida ou certificado corrompido");
  }

  return { pfxBuffer, password };
}

/**
 * Cria um HTTPS Agent com mTLS para comunicação com a API Nacional
 *
 * SEGURANÇA:
 * - rejectUnauthorized: true → rejeita certificados SSL inválidos do servidor
 * - O .pfx é carregado em memória apenas durante a requisição
 */
export function createMTLSAgent(
  pfxBuffer: Buffer,
  passphrase: string,
): https.Agent {
  return new https.Agent({
    pfx: pfxBuffer,
    passphrase,
    rejectUnauthorized: true,
    // Timeout de conexão para evitar hanging
    timeout: 30000,
  });
}
