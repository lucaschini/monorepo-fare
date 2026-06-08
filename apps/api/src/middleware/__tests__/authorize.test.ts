import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { authMiddleware, authorize } from "../auth";

process.env.JWT_SECRET = "test-secret";

function makeApp(roles: string[]) {
  const app = express();
  app.get(
    "/protected",
    authMiddleware,
    authorize(...roles),
    (_req, res) => { res.json({ ok: true }); },
  );
  return app;
}

function tokenWithRole(role: string) {
  return jwt.sign({ id: 1, role }, "test-secret");
}

describe("authorize middleware", () => {
  it("permite acesso quando role está na lista", async () => {
    const app = makeApp(["admin"]);
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${tokenWithRole("admin")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("retorna 403 quando role não está na lista", async () => {
    const app = makeApp(["admin"]);
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${tokenWithRole("operador")}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Sem permissão para esta ação" });
  });

  it("permite acesso com qualquer role listado (múltiplos)", async () => {
    const app = makeApp(["admin", "supervisor"]);
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${tokenWithRole("supervisor")}`);
    expect(res.status).toBe(200);
  });

  it("retorna 403 quando token não tem role (token legado sem role)", async () => {
    const app = makeApp(["admin"]);
    const tokenSemRole = jwt.sign({ id: 1 }, "test-secret");
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${tokenSemRole}`);
    expect(res.status).toBe(403);
  });
});
