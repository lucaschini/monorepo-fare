# ERP Gráfica — Fase 1

Sistema integrado de gestão para gráficas com emissão fiscal (NF-e / NFS-e).

## Stack

| Camada | Tecnologia | Hospedagem |
|--------|-----------|------------|
| Frontend | Next.js 15 + Tailwind CSS | Vercel |
| Backend | Node.js + Express | Railway |
| Banco de dados | PostgreSQL | Railway |
| Monorepo | Turborepo + pnpm | — |
| Pacote compartilhado | TypeScript (tipos, validações, enums) | — |

## Estrutura do projeto

```
erp-grafica/
├── apps/
│   ├── api/                  # Express REST API
│   │   └── src/
│   │       ├── index.ts              # Entry point
│   │       ├── db/
│   │       │   ├── connection.ts     # Pool PostgreSQL
│   │       │   ├── migrate.ts        # Runner de migrations
│   │       │   ├── seed.ts           # Seed do admin
│   │       │   └── migrations/
│   │       │       └── 001_initial.ts
│   │       ├── middleware/
│   │       │   └── auth.ts           # JWT middleware
│   │       └── routes/
│   │           ├── auth.ts           # POST /auth/login
│   │           └── clientes.ts       # CRUD /clientes
│   └── web/                  # Next.js frontend
│       └── src/
│           ├── app/
│           │   ├── layout.tsx        # Root layout
│           │   ├── page.tsx          # Redirect → /login
│           │   ├── login/page.tsx    # Tela de login
│           │   └── (app)/            # Layout autenticado (com sidebar)
│           │       ├── layout.tsx
│           │       ├── dashboard/page.tsx
│           │       └── clientes/page.tsx
│           ├── components/
│           │   ├── Sidebar.tsx
│           │   └── Header.tsx
│           └── lib/
│               └── api.ts            # Fetch helper + auth
├── packages/
│   └── shared/               # Código compartilhado
│       └── src/
│           ├── index.ts
│           ├── types/                # Cliente, Usuario
│           ├── validators/           # CPF/CNPJ
│           └── enums/                # TipoCliente, StatusPedido, etc.
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Pré-requisitos

- **Node.js** >= 18
- **pnpm** >= 9 (`npm install -g pnpm`)
- **PostgreSQL** >= 14 rodando localmente (ou via Docker)

## Passo a passo da instalação

### 1. Clonar e instalar dependências

```bash
cd erp-grafica
pnpm install
```

### 2. Criar o banco de dados

```bash
# Via psql
psql -U postgres -c "CREATE DATABASE erp_grafica;"
```

Ou via Docker:

```bash
docker run -d \
  --name erp-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=erp_grafica \
  -p 5432:5432 \
  postgres:16
```

### 3. Configurar variáveis de ambiente

```bash
# Backend
cp apps/api/.env.example apps/api/.env
# Edite apps/api/.env se necessário (porta, DATABASE_URL, JWT_SECRET)

# Frontend
cp apps/web/.env.example apps/web/.env.local
# Edite apps/web/.env.local se necessário (NEXT_PUBLIC_API_URL)
```

### 4. Rodar migrations e seed

```bash
pnpm db:migrate
pnpm db:seed
```

Saída esperada:

```
✅ Migration 001: tabelas usuarios e clientes criadas
✅ Seed executado com sucesso
   Email: admin@erp.local
   Senha: admin123
```

### 5. Subir o projeto

```bash
pnpm dev
```

Isso sobe simultaneamente:
- **API** em `http://localhost:3001`
- **Frontend** em `http://localhost:3000`

### 6. Acessar o sistema

Abra `http://localhost:3000` e faça login com:

| Campo | Valor |
|-------|-------|
| E-mail | `admin@erp.local` |
| Senha | `admin123` |

## Endpoints da API (Fase 1)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| `POST` | `/auth/login` | Autenticação (retorna JWT) | Não |
| `GET` | `/clientes?busca=&tipo=` | Listar/buscar clientes | Sim |
| `GET` | `/clientes/:id` | Buscar cliente por ID | Sim |
| `POST` | `/clientes` | Criar cliente | Sim |
| `PUT` | `/clientes/:id` | Atualizar cliente | Sim |
| `DELETE` | `/clientes/:id` | Remover cliente | Sim |
| `GET` | `/health` | Health check | Não |

## Credenciais padrão

```
Email: admin@erp.local
Senha: admin123
```

> ⚠️ Altere o `JWT_SECRET` e a senha do admin antes de ir para produção.
