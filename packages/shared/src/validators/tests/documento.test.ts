import { describe, it, expect } from "vitest";
import {
  validarCPF,
  validarCNPJ,
  validarDocumento,
  formatarCPF,
  formatarCNPJ,
} from "../documento";

describe("validarCPF", () => {
  it("aceita CPF válido", () => {
    expect(validarCPF("529.982.247-25")).toBe(true);
    expect(validarCPF("52998224725")).toBe(true);
  });

  it("rejeita CPF com dígitos repetidos", () => {
    expect(validarCPF("111.111.111-11")).toBe(false);
    expect(validarCPF("000.000.000-00")).toBe(false);
  });

  it("rejeita CPF com tamanho errado", () => {
    expect(validarCPF("123")).toBe(false);
    expect(validarCPF("")).toBe(false);
    expect(validarCPF("1234567890123")).toBe(false);
  });

  it("rejeita CPF com dígito verificador inválido", () => {
    expect(validarCPF("529.982.247-26")).toBe(false);
  });
});

describe("validarCNPJ", () => {
  it("aceita CNPJ válido", () => {
    expect(validarCNPJ("11.222.333/0001-81")).toBe(true);
    expect(validarCNPJ("11222333000181")).toBe(true);
  });

  it("rejeita CNPJ com dígitos repetidos", () => {
    expect(validarCNPJ("11.111.111/1111-11")).toBe(false);
  });

  it("rejeita CNPJ com tamanho errado", () => {
    expect(validarCNPJ("123")).toBe(false);
    expect(validarCNPJ("")).toBe(false);
  });

  it("rejeita CNPJ com dígito verificador inválido", () => {
    expect(validarCNPJ("11.222.333/0001-82")).toBe(false);
  });
});

describe("validarDocumento", () => {
  it("delega para validarCPF quando tipo é PF", () => {
    expect(validarDocumento("52998224725", "PF")).toBe(true);
    expect(validarDocumento("00000000000", "PF")).toBe(false);
  });

  it("delega para validarCNPJ quando tipo é PJ", () => {
    expect(validarDocumento("11222333000181", "PJ")).toBe(true);
    expect(validarDocumento("00000000000000", "PJ")).toBe(false);
  });
});

describe("formatarCPF", () => {
  it("formata CPF corretamente", () => {
    expect(formatarCPF("52998224725")).toBe("529.982.247-25");
  });
});

describe("formatarCNPJ", () => {
  it("formata CNPJ corretamente", () => {
    expect(formatarCNPJ("11222333000181")).toBe("11.222.333/0001-81");
  });
});
