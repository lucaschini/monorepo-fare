// apps/api/src/services/fiscal/__tests__/certificate.test.ts

import { describe, it, expect } from "vitest";
import { encryptPassword, decryptPassword } from "../certificate";

describe("encryptPassword / decryptPassword", () => {
  it("criptografa e descriptografa corretamente", () => {
    const original = "minha-senha-super-secreta-123";
    const encrypted = encryptPassword(original);
    const decrypted = decryptPassword(encrypted);
    expect(decrypted).toBe(original);
  });

  it("gera ciphertext diferente para a mesma senha (IV aleatório)", () => {
    const senha = "mesma-senha";
    const enc1 = encryptPassword(senha);
    const enc2 = encryptPassword(senha);
    expect(enc1).not.toBe(enc2);
    // Mas ambos descriptografam para o mesmo valor
    expect(decryptPassword(enc1)).toBe(senha);
    expect(decryptPassword(enc2)).toBe(senha);
  });

  it("rejeita formato de ciphertext inválido", () => {
    expect(() => decryptPassword("dados-invalidos")).toThrow(/inválido/);
  });

  it("rejeita ciphertext adulterado", () => {
    const encrypted = encryptPassword("teste");
    // Altera um byte do ciphertext
    const parts = encrypted.split(":");
    parts[2] = "ff" + parts[2].substring(2);
    expect(() => decryptPassword(parts.join(":"))).toThrow();
  });

  it("lida com caracteres especiais na senha", () => {
    const senhas = ["p@$$w0rd!#%^&*()", "ñ日本語中文العربية", "   espaços   "];
    for (const senha of senhas) {
      const encrypted = encryptPassword(senha);
      expect(decryptPassword(encrypted)).toBe(senha);
    }
  });
});
