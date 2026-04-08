import { up as up001 } from "./migrations/001_initial";
import { up as up002 } from "./migrations/002_clientes_optional_fields";
import { pool } from "./connection";

async function migrate() {
  try {
    await up001();
    await up002();
    console.log("✅ Todas as migrations executadas com sucesso");
  } catch (error) {
    console.error("❌ Erro ao executar migrations:", error);
  } finally {
    await pool.end();
  }
}

migrate();
