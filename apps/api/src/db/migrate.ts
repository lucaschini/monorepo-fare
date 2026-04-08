import { up } from "./migrations/001_initial";
import { pool } from "./connection";

async function migrate() {
  try {
    await up();
    console.log("✅ Todas as migrations executadas com sucesso");
  } catch (error) {
    console.error("❌ Erro ao executar migrations:", error);
  } finally {
    await pool.end();
  }
}

migrate();
