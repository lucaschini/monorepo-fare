import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";

// Mock the db query and auth middleware
vi.mock("../../db/connection", () => ({
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [{ current_database: "test_db" }] }),
    end: vi.fn().mockResolvedValue(undefined),
  },
  query: vi.fn(),
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: vi.fn().mockReturnValue({ id: 1, role: "admin" }),
  },
}));

import { query } from "../../db/connection";

const mockQuery = vi.mocked(query);

const authHeader = { Authorization: "Bearer fake-token" };

const validBody = {
  tipo: "receita",
  descricao: "Venda de produto",
  valor: "150.75",
  metodo_pagamento: "pix",
  status: "pendente",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockQuery.mockResolvedValue({ rows: [{ id: 1 }] } as any);
});

describe("POST /financeiro", () => {
  it("passa valorNum (float parseado) como terceiro parâmetro da query", async () => {
    await request(app)
      .post("/financeiro")
      .set(authHeader)
      .send(validBody);

    const callArgs = mockQuery.mock.calls.find(([sql]) =>
      (sql as string).includes("INSERT INTO transacoes_financeiras"),
    );
    expect(callArgs).toBeDefined();
    const params = callArgs![1] as unknown[];
    // $3 deve ser o float 150.75, não a string "150.75"
    expect(params[2]).toBe(150.75);
    expect(typeof params[2]).toBe("number");
  });

  it("passa pedidoIdNum (inteiro) como oitavo parâmetro quando pedido_id é fornecido", async () => {
    await request(app)
      .post("/financeiro")
      .set(authHeader)
      .send({ ...validBody, pedido_id: "42" });

    const callArgs = mockQuery.mock.calls.find(([sql]) =>
      (sql as string).includes("INSERT INTO transacoes_financeiras"),
    );
    expect(callArgs).toBeDefined();
    const params = callArgs![1] as unknown[];
    // $8 deve ser o inteiro 42
    expect(params[7]).toBe(42);
    expect(typeof params[7]).toBe("number");
  });

  it("passa null como oitavo parâmetro quando pedido_id não é fornecido", async () => {
    await request(app)
      .post("/financeiro")
      .set(authHeader)
      .send(validBody);

    const callArgs = mockQuery.mock.calls.find(([sql]) =>
      (sql as string).includes("INSERT INTO transacoes_financeiras"),
    );
    expect(callArgs).toBeDefined();
    const params = callArgs![1] as unknown[];
    // $8 deve ser null
    expect(params[7]).toBeNull();
  });
});
