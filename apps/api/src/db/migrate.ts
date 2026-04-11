import { up as up001 } from "./migrations/001_initial";
import { up as up002 } from "./migrations/002_clientes_optional_fields";
import { up as up003 } from "./migrations/003_catalogo";
import { up as up004 } from "./migrations/004_orcamentos_pedidos";
import { up as up005 } from "./migrations/005_estoque";
import { pool } from "./connection";

async function migrate() {
  try {
    await up001();
    await up002();
    await up003();
    await up004();
    await up005();
    console.log("✅ Todas as migrations executadas com sucesso");
  } catch (error) {
    console.error("❌ Erro ao executar migrations:", error);
  } finally {
    await pool.end();
  }
}

migrate();
