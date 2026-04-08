import bcrypt from "bcryptjs";
import { pool } from "./connection";

async function seed() {
  try {
    const senhaHash = await bcrypt.hash("admin123", 10);

    await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      ["Administrador", "admin@erp.local", senhaHash]
    );

    console.log("✅ Seed executado com sucesso");
    console.log("   Email: admin@erp.local");
    console.log("   Senha: admin123");
  } catch (error) {
    console.error("❌ Erro ao executar seed:", error);
  } finally {
    await pool.end();
  }
}

seed();
