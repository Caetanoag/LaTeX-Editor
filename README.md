# LaTeX Editor

Editor de LaTeX self-hosted e open-source. A aplicação roda em um único servidor, expõe a interface e a API HTTP e guarda tudo no PostgreSQL. Basta acessar o endereço do servidor no navegador — não é preciso instalar nada nas máquinas dos usuários. A compilação dos documentos é feita no servidor com `latexmk`, e o PDF resultante aparece direto no editor.

Licença: AGPL-3.0-only (declarada em `package.json`).

## Visão geral

### O que já funciona

- **Contas e sessões:** cadastro, login, logout, consulta ao usuário atual (`/auth/me`), lista e revogação de sessões, logout de todos os dispositivos e exclusão da conta protegida por senha. O token é enviado no cabeçalho `Authorization: Bearer <token>` e armazenado no `localStorage` do navegador.
- **Workspaces e projetos:** criação, edição e exclusão lógica (soft delete) de workspaces e projetos. Projetos têm título, descrição e visibilidade (`private`, `workspace` ou `public`). Projetos arquivados podem ser restaurados.
- **Editor de arquivos:** árvore de arquivos por caminho (`/main.tex`, `capitulos/intro.tex`, etc.), criação e exclusão de arquivos, definição do arquivo principal, edição com destaque de sintaxe LaTeX, autocomplete de comandos e trechos (snippets) com tab stops.
- **Compilação para PDF:** todos os arquivos do projeto são copiados para um diretório temporário e compilados com `latexmk`. A resposta é o PDF ou o log de erro; compilações que excedem o timeout retornam HTTP 504.
- **Controle de acesso na API:** o dono tem acesso total; papéis de membro e a visibilidade do projeto definem quem pode ler ou editar. A triagem de acesso acontece no backend.

### O que ainda não está implementado

Edição colaborativa em tempo real, convites, compartilhamento e comentários **não** existem hoje. O schema do banco já prevê tabelas para membros, convites, comentários e versões de arquivos, mas não há rotas nem interface para esses recursos. Da mesma forma, o gerenciamento de membros ainda não tem UI: a visibilidade `workspace` e `public` funciona, mas não há uma tela para adicionar pessoas a um workspace ou projeto.

## Stack

| Camada     | Tecnologia                                                                |
| ---------- | ------------------------------------------------------------------------- |
| Backend    | Bun, TypeScript, Express 5, Zod (validação) e `pg`                        |
| Frontend   | HTML, CSS e TypeScript compilado para JavaScript, sem framework           |
| Banco      | PostgreSQL (schema em `db/schema.sql`)                                    |
| Compilação | `latexmk` + TeX Live no servidor                                          |
| Build/dev  | Bun (`dev/build.ts` gera `public/js/`; `dev/serve.ts` serve a UI isolada) |
| Container  | Docker + Docker Compose                                                   |

## Estrutura do repositório

```text
src/server/                 API (Express)
  app.ts                    middlewares e montagem das rotas
  server.ts                 listener, /health e limpeza de sessões
  modules/<feature>/        routes, service, repository, schemas (Zod) e index
  test/                     testes com bun:test
src/public/                 TypeScript do navegador (uma entrada por arquivo)
  main.ts                   entrypoint compartilhado carregado pelas páginas
  dashboard.ts, editor.ts, account.ts, auth.*.ts
public/                     raiz estática servida pelo Express
  index.html                login
  html/                     register, dashboard, editor e account
  js/                       JavaScript gerado (commitado junto com o código)
  style/                    CSS
db/schema.sql               schema de referência do PostgreSQL
db/seed.sql                 dados de exemplo opcionais
docs/database/              decisões e consultas de referência
dev/build.ts                build do frontend
dev/serve.ts                servidor estático apenas para a UI
docker-compose.yaml         app + Postgres
Dockerfile                  imagem com Bun e TeX Live
```

## Requisitos

### Com Docker

- Docker daemon e Docker Compose. A imagem já instala Bun, as dependências e os pacotes TeX Live necessários (`latexmk`, `texlive-latex-*`, fontes e pacote em português).

### Rodando nativamente

- [Bun](https://bun.sh) 1.x.
- PostgreSQL em execução, com o banco já criado. O schema usa a extensão `citext`, então o usuário do banco precisa poder criá-la (ou ela já deve existir).
- `latexmk` disponível no `PATH`, com uma instalação de TeX Live. Sem ele, a compilação de PDF falha.

## Configuração

Copie o arquivo de exemplo e ajuste o que for necessário:

```bash
cp .env.example .env
```

O `.env` não é versionado. As variáveis são:

| Variável             | Padrão     | Descrição                                                                       |
| -------------------- | ---------- | ------------------------------------------------------------------------------- |
| `POSTGRES_USER`      | `postgres` | Usuário do banco de dados.                                                      |
| `POSTGRES_PASSWORD`  | `postgres` | Senha do banco de dados.                                                        |
| `POSTGRES_DB`        | `app_db`   | Nome do banco de dados.                                                         |
| `POSTGRES_HOST`      | `postgres` | Host do banco: nome do serviço no Compose; use `localhost` rodando nativamente. |
| `POSTGRES_PORT`      | `5432`     | Porta do banco de dados.                                                        |
| `POSTGRES_HOST_PORT` | `5439`     | Porta do PostgreSQL exposta no host (apenas Docker).                            |
| `SESSION_TTL_DAYS`   | `30`       | Tempo de vida das sessões de autenticação, em dias.                             |
| `COMPILE_TIMEOUT_MS` | `15000`    | Timeout da compilação LaTeX, em milissegundos.                                  |
| `APP_PORT`           | `3000`     | Porta da aplicação no host (apenas Docker).                                     |

O servidor também lê `PORT` (padrão `3000`) para a porta em que escuta. Rodando nativamente, defina `PORT` no ambiente se quiser usar outra porta.

No Docker Compose, `POSTGRES_HOST`, `POSTGRES_PORT` e a porta interna do app são fixos (`postgres`, `5432` e `3000`). O valor de `COMPILE_TIMEOUT_MS` definido no `.env` é repassado ao contêiner; se ausente, o padrão é 15 s.

## Rodando com Docker (recomendado)

```bash
cp .env.example .env
docker compose up -d
```

A aplicação fica em `http://localhost:3000` (ou na porta definida em `APP_PORT`). Na primeira inicialização, o Postgres aplica `db/schema.sql` automaticamente; o volume `postgres_data` preserva os dados entre reinícios.

```bash
docker compose logs -f app   # acompanhar os logs
docker compose down          # parar os serviços (mantém os dados)
docker compose down --volumes # parar e apagar o volume do banco
```

## Rodando nativamente com Bun

```bash
bun install                  # instalar dependências
# Configure .env com POSTGRES_HOST=localhost e os dados do seu Postgres.
bun run build                # gera public/js/ a partir de src/public/
bun run dev                  # servidor com watch (ou: bun run start)
```

Acesse `http://localhost:3000` (ou a porta definida em `PORT`). O Express serve os arquivos estáticos de `public/` e as rotas da API no mesmo processo.

Sempre que alterar algo em `src/public/`, rode `bun run build` novamente. O resultado em `public/js/` é versionado e deve ser commitado junto; o antigo `public/bundle.js` não é usado e está ignorado pelo Git. `bun run serve` inicia um servidor estático em porta aleatória apenas para pré-visualizar a interface; ele **não** atende às rotas da API.

## Primeiro uso

1. Acesse a página de login (`/`) e crie uma conta em [Registrar](public/html/register.html).
2. No dashboard, crie um workspace e selecione-o na barra lateral.
3. Crie um projeto dentro do workspace e abra-o pelo link na tabela de projetos.
4. No editor, crie um arquivo `/main.tex`, marque-o como principal e escreva o documento.
5. Clique em compilar para gerar o PDF e acompanhar o log em caso de erro.

A navegação é protegida no cliente: páginas sem uma sessão local válida redirecionam para o login com o parâmetro `next`. Isso é apenas uma comodidade de UI; a segurança real está na API, que exige o token Bearer em todas as rotas protegidas.

<img src="assets/editor.png" alt="Visão do editor de LaTeX">
## API (resumo)

Em geral as rotas retornam JSON; logout e exclusões respondem `204` sem corpo, e a compilação bem-sucedida retorna `application/pdf`. Erros seguem o formato `{ "error", "message", "details?" }`. Como as colunas de ID são `bigint`, os IDs chegam ao cliente como **strings**.

| Grupo        | Rotas                                                                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticação | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/logout-all`, `DELETE /auth/account` |
| Usuários     | `GET /users/:id` (dados públicos do perfil)                                                                                                                                        |
| Workspaces   | `GET /workspaces`, `POST /workspaces`, `GET /workspaces/:id`, `PATCH /workspaces/:id`, `DELETE /workspaces/:id`                                                                    |
| Projetos     | `GET /projects`, `POST /projects`, `GET /projects/:id`, `PATCH /projects/:id`, `DELETE /projects/:id`, `POST /projects/:id/restore`                                                |
| Arquivos     | `GET/POST /projects/:projectId/files`, `GET/PUT/DELETE /files/:id`, `PATCH /files/:id/main`                                                                                        |
| Compilação   | `POST /files/:id/compile`                                                                                                                                                          |

`GET /projects` aceita `workspaceId` e `archived=true` para listar projetos arquivados. `GET /health` serve para checar se a API está viva.

## Desenvolvimento

| Comando          | Finalidade                                             |
| ---------------- | ------------------------------------------------------ |
| `bun install`    | instalar dependências                                  |
| `bun run dev`    | API com watch, reinicia ao alterar arquivos            |
| `bun run start`  | API sem watch                                          |
| `bun run build`  | compilar o frontend para `public/js/`                  |
| `bun run serve`  | servidor estático da UI (sem API)                      |
| `bun run test`   | testes; os de integração exigem API e Postgres rodando |
| `bun run check`  | lint, checagem de formatação e ordem de imports        |
| `bun run format` | aplicar formatação                                     |

Os scripts `dev`, `start`, `build`, `serve`, `test`, `check` e `format` estão em `package.json`. Não há script `typecheck` nem `tsconfig.json`. Antes de commitar, rode `bun run check` e, se houver alterações em `src/`, `bun run build`.

## Banco de dados

`db/schema.sql` é a fonte da verdade: cria tabelas, papéis/permissões, workspaces, projetos, arquivos, sessões e dados iniciais de permissões. O Compose monta esse arquivo na pasta de inicialização do Postgres, então ele é aplicado apenas quando o volume está vazio. `db/seed.sql` é dados de exemplo opcionais, não aplicados automaticamente.

- [Decisões de arquitetura do banco](docs/database/SCHEMA.md)
- [Consultas de referência](docs/database/QUERIES.md)
- [Diagrama do schema](db/generated/diagram.png)
- [Schema em DBML](db/generated/schema.dbml)
