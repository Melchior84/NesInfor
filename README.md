# NesInfor

Sistema de pedidos coletivos de cápsulas Nespresso (caixas fechadas de 50 unidades por sabor).

```
NesInfor/
├── backend/    NestJS 11 + mysql2 (queries parametrizadas) + Argon2id + JWT
└── frontend/   React + TypeScript + Vite + Tailwind CSS
```

## Frontend

```powershell
cd D:\Projetos\NesInfor\frontend
npm.cmd install                  # (já instalado)
npm.cmd run dev                  # http://localhost:5173 (proxy /api -> localhost:3000)
```

Para build de produção:

```powershell
npm.cmd run build
```

## Backend

### 1. Configurar

```powershell
cd D:\Projetos\NesInfor\backend
Copy-Item .env.example .env      # edite DB_USER, DB_PASSWORD e JWT_SECRET
npm.cmd install                  # (já instalado)
```

> No PowerShell use `npm.cmd` / `npx.cmd` (o `npm.ps1` está bloqueado pela Execution Policy).

Gere um `JWT_SECRET` forte:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

O banco `nespresso_coletivo` **não é criado** pela aplicação: ela só se conecta ao que já existe.

### 2. Subir a API

```powershell
npm.cmd run start:dev            # http://localhost:3000/api
```

### 3. Criar o primeiro ADMIN

O cadastro sempre cria perfil `USUARIO`. Para o primeiro admin:

```powershell
# promove um usuário que já se cadastrou
npm.cmd run create-admin -- admin@empresa.com
# ou cria um ADMIN novo
npm.cmd run create-admin -- admin@empresa.com "Administrador" "SenhaForte123"
```

Depois, ADMINs promovem outros em `PATCH /api/usuarios/:id`.

### 4. Testar

```powershell
# Testes unitários do cálculo de caixas
npm.cmd test

# Smoke test ponta a ponta (API no ar + um ADMIN existente)
powershell -ExecutionPolicy Bypass -File scripts/smoke-test.ps1 -AdminEmail admin@empresa.com -AdminSenha SenhaForte123
```

Também há [api-tests.http](backend/api-tests.http) para a extensão REST Client do VS Code.

Exemplo manual com `curl.exe`:

```powershell
curl.exe -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@empresa.com\",\"senha\":\"SenhaForte123\"}"
curl.exe http://localhost:3000/api/rodadas/ativa -H "Authorization: Bearer SEU_TOKEN"
```

## Endpoints (`/api`)

| Método | Rota | Permissão |
|---|---|---|
| POST | `/auth/register` `{nome,email,senha}` | pública |
| POST | `/auth/login` `{email,senha}` | pública |
| GET | `/auth/me` | logado |
| GET | `/capsulas` (`?ativos=true`) | logado (não-admin só vê ativas) |
| POST | `/capsulas` | ADMIN |
| PUT | `/capsulas/:id` | ADMIN (mudou o preço → `historico_precos` na mesma transação) |
| PATCH | `/capsulas/:id/ativo` `{ativo}` | ADMIN |
| GET | `/capsulas/:id/historico-precos` | ADMIN |
| GET | `/usuarios` · PATCH `/usuarios/:id` `{perfil?,ativo?}` | ADMIN |
| GET | `/rodadas` · `/rodadas/ativa` · `/rodadas/:id` | logado |
| POST | `/rodadas` `{titulo,assumirOrganizacao?}` | logado |
| POST | `/rodadas/:id/assumir` | logado (só se `organizador_id IS NULL`) |
| PATCH | `/rodadas/:id/status` `{status}` | organizador da rodada ou ADMIN |
| GET | `/rodadas/:id/painel-caixas` | logado (mostra quem pediu o quê) |
| GET | `/rodadas/:id/resumo-compra` | logado (só caixas fechadas) |
| GET | `/rodadas/:id/participantes` | organizador ou ADMIN |
| PATCH | `/rodadas/:id/participantes/:solicitacaoId/pagamento` `{status}` | organizador ou ADMIN |
| GET | `/rodadas/:id/meu-pedido` | logado |
| PUT | `/rodadas/:id/meu-pedido/itens/:capsulaId` `{quantidade}` (0 remove) | logado, rodada `ABERTO` |
| DELETE | `/rodadas/:id/meu-pedido/itens/:capsulaId` | logado, rodada `ABERTO` |

## Regras implementadas

- **Caixas:** por sabor, `caixasFechadas = floor(total / tamanho_caixa)`, `faltamProximaCaixa`, e status
  `FECHADA` (múltiplo exato), `COM_SOBRA` (≥1 caixa + resto) ou `AGUARDANDO_COMPLETAR` (0 caixas).
  Só as caixas fechadas entram na compra. Ver [calculo-caixas.ts](backend/src/rodadas/calculo-caixas.ts).
- **Sobras:** as cápsulas dentro das caixas são alocadas por **ordem de chegada** (id do item). Quem pediu
  primeiro garante as suas; as últimas unidades viram sobra (não pagas).
- **Preço congelado:** ao criar um item, `itens_solicitacao.preco_unitario` recebe `capsulas.preco_atual`.
  Editar a quantidade mantém o preço original.
- **Uma rodada ativa por vez** (`ABERTO`/`FECHADO`/`COMPRADO`).
- **Transições:** `ABERTO→FECHADO|CANCELADO`, `FECHADO→ABERTO|COMPRADO|CANCELADO`,
  `COMPRADO→ENTREGUE|CANCELADO`. `COMPRADO` exige ao menos 1 caixa fechada.
- **Segurança:** Argon2id, JWT, o usuário é recarregado do banco a cada requisição
  (desativar/rebaixar vale na hora), SQL sempre parametrizado, validação de DTOs com whitelist.
