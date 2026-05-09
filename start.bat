@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

:: ══════════════════════════════════════════════════════
::  ERP Gráfica — Script de inicialização
::  Uso: duplo clique ou execute no terminal
:: ══════════════════════════════════════════════════════

title ERP Grafica - Iniciando...

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║        ERP Grafica — Inicializacao           ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: ──────────────────────────────────────────────────────
:: 1. Verificar se o Docker está instalado
:: ──────────────────────────────────────────────────────
echo [1/7] Verificando Docker...

where docker >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo  ❌ Docker nao encontrado!
    echo.
    echo  O Docker Desktop e necessario para rodar o banco de dados.
    echo  Baixe em: https://www.docker.com/products/docker-desktop/
    echo  Apos instalar, reinicie o computador e execute este script novamente.
    echo.
    pause
    exit /b 1
)

echo     ✓ Docker instalado

:: ──────────────────────────────────────────────────────
:: 2. Verificar se o Docker está rodando
:: ──────────────────────────────────────────────────────
echo [2/7] Verificando se o Docker esta rodando...

docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo  ⚠  Docker esta instalado, mas nao esta rodando.
    echo.
    echo  Abra o Docker Desktop e aguarde ele iniciar completamente
    echo  (o icone na bandeja do sistema fica verde quando esta pronto).
    echo  Depois execute este script novamente.
    echo.
    pause
    exit /b 1
)

echo     ✓ Docker rodando

:: ──────────────────────────────────────────────────────
:: 3. Verificar Node.js e pnpm
:: ──────────────────────────────────────────────────────
echo [3/7] Verificando Node.js e pnpm...

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo  ❌ Node.js nao encontrado!
    echo.
    echo  Instale o Node.js 18 ou superior: https://nodejs.org
    echo  Escolha a versao LTS (recomendada).
    echo  Apos instalar, feche e reabra o terminal e execute novamente.
    echo.
    pause
    exit /b 1
)

for /f "tokens=1 delims=v" %%a in ('node -v') do set NODE_RAW=%%a
for /f "tokens=1 delims=." %%a in ('node -v') do set NODE_MAJOR=%%a
set NODE_MAJOR=%NODE_MAJOR:v=%

if %NODE_MAJOR% LSS 18 (
    echo.
    echo  ❌ Node.js muito antigo! Versao atual: v%NODE_MAJOR%
    echo     Versao minima necessaria: v18
    echo.
    echo  Atualize em: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo     ✓ Node.js encontrado

where pnpm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo  ⚠  pnpm nao encontrado. Instalando automaticamente...
    npm install -g pnpm >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo.
        echo  ❌ Falha ao instalar o pnpm.
        echo     Tente manualmente: npm install -g pnpm
        echo.
        pause
        exit /b 1
    )
    echo     ✓ pnpm instalado com sucesso
) else (
    echo     ✓ pnpm encontrado
)

:: ──────────────────────────────────────────────────────
:: 4. Subir o banco de dados PostgreSQL via Docker
:: ──────────────────────────────────────────────────────
echo [4/7] Configurando banco de dados PostgreSQL...

:: Verifica se o container já existe
docker ps -a --format "{{.Names}}" | findstr /x "erp-postgres" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    :: Container existe, verifica se está rodando
    docker ps --format "{{.Names}}" | findstr /x "erp-postgres" >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        echo     ✓ PostgreSQL ja esta rodando
    ) else (
        echo     Iniciando container existente...
        docker start erp-postgres >nul 2>&1
        if %ERRORLEVEL% neq 0 (
            echo.
            echo  ❌ Falha ao iniciar o container do PostgreSQL.
            echo     Tente: docker start erp-postgres
            echo.
            pause
            exit /b 1
        )
        echo     ✓ PostgreSQL iniciado
    )
) else (
    :: Container não existe, cria um novo
    echo     Criando container PostgreSQL...
    docker run -d ^
        --name erp-postgres ^
        -e POSTGRES_PASSWORD=postgres ^
        -e POSTGRES_DB=erp_grafica ^
        -p 5432:5432 ^
        postgres:16 >nul 2>&1

    if %ERRORLEVEL% neq 0 (
        echo.
        echo  ❌ Falha ao criar o container do PostgreSQL.
        echo.
        echo  Possiveis causas:
        echo    - A porta 5432 ja esta em uso por outro servico
        echo    - Sem permissao para criar containers
        echo.
        echo  Tente: docker run -d --name erp-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=erp_grafica -p 5432:5432 postgres:16
        echo.
        pause
        exit /b 1
    )

    echo     ✓ PostgreSQL criado
    echo     Aguardando banco ficar pronto...

    :: Aguarda o PostgreSQL aceitar conexões (max 30s)
    set RETRIES=0
    :wait_pg
    if !RETRIES! geq 15 (
        echo.
        echo  ❌ PostgreSQL nao ficou pronto em 30 segundos.
        echo     Verifique com: docker logs erp-postgres
        echo.
        pause
        exit /b 1
    )
    timeout /t 2 /nobreak >nul
    docker exec erp-postgres pg_isready -U postgres >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        set /a RETRIES+=1
        goto wait_pg
    )
    echo     ✓ PostgreSQL pronto para conexoes
)

:: Cria banco de teste se não existir
docker exec erp-postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'erp_grafica_test'" | findstr "1" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo     Criando banco de testes...
    docker exec erp-postgres psql -U postgres -c "CREATE DATABASE erp_grafica_test;" >nul 2>&1
    echo     ✓ Banco de testes criado
)

:: ──────────────────────────────────────────────────────
:: 5. Instalar dependências
:: ──────────────────────────────────────────────────────
echo [5/7] Instalando dependencias do projeto...

call pnpm install >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo  ❌ Falha ao instalar dependencias.
    echo.
    echo  Tente manualmente:
    echo    pnpm install
    echo.
    echo  Se o erro persistir, delete a pasta node_modules e tente novamente:
    echo    rmdir /s /q node_modules
    echo    pnpm install
    echo.
    pause
    exit /b 1
)

echo     ✓ Dependencias instaladas

:: ──────────────────────────────────────────────────────
:: 6. Configurar variáveis de ambiente
:: ──────────────────────────────────────────────────────
echo [6/7] Configurando variaveis de ambiente...

if not exist "apps\api\.env" (
    if exist "apps\api\.env.example" (
        copy "apps\api\.env.example" "apps\api\.env" >nul
        echo     ✓ apps\api\.env criado a partir do exemplo
    ) else (
        (
            echo PORT=3001
            echo DATABASE_URL=postgresql://postgres:postgres@localhost:5432/erp_grafica
            echo JWT_SECRET=dev-secret-troque-em-producao
        ) > "apps\api\.env"
        echo     ✓ apps\api\.env criado com valores padrao
    )
) else (
    echo     ✓ apps\api\.env ja existe
)

if not exist "apps\api\.env.test" (
    (
        echo PORT=3002
        echo DATABASE_URL=postgresql://postgres:postgres@localhost:5432/erp_grafica_test
        echo JWT_SECRET=test-secret
    ) > "apps\api\.env.test"
    echo     ✓ apps\api\.env.test criado
) else (
    echo     ✓ apps\api\.env.test ja existe
)

if not exist "apps\web\.env.local" (
    if exist "apps\web\.env.example" (
        copy "apps\web\.env.example" "apps\web\.env.local" >nul
        echo     ✓ apps\web\.env.local criado a partir do exemplo
    ) else (
        (
            echo NEXT_PUBLIC_API_URL=http://localhost:3001
            echo API_URL=http://localhost:3001
            echo AUTH_SECRET=dev-auth-secret-troque-em-producao-min-32chars
        ) > "apps\web\.env.local"
        echo     ✓ apps\web\.env.local criado com valores padrao
    )
) else (
    echo     ✓ apps\web\.env.local ja existe
)

:: ──────────────────────────────────────────────────────
:: 7. Rodar migrations e seed
:: ──────────────────────────────────────────────────────
echo [7/7] Executando migrations e seed do banco...

call pnpm db:migrate 2>&1 | findstr /i "erro error falha" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo     ⚠  Migrations executadas com avisos (pode ser normal na re-execucao)
) else (
    echo     ✓ Migrations executadas
)

call pnpm db:seed >nul 2>&1
echo     ✓ Seed executado (admin@erp.local / admin123)

:: ──────────────────────────────────────────────────────
:: Pronto! Subir o projeto
:: ──────────────────────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║         ✓ Tudo pronto! Subindo o ERP         ║
echo  ╠══════════════════════════════════════════════╣
echo  ║                                              ║
echo  ║  Frontend:  http://localhost:3000             ║
echo  ║  API:       http://localhost:3001             ║
echo  ║                                              ║
echo  ║  Login:     admin@erp.local                   ║
echo  ║  Senha:     admin123                          ║
echo  ║                                              ║
echo  ║  Pressione Ctrl+C para parar                  ║
echo  ║                                              ║
echo  ╚══════════════════════════════════════════════╝
echo.

title ERP Grafica - Rodando

call pnpm dev
