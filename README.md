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

| Camada        | Tecnologia                                                                 |
| ------------- | -------------------------------------------------------------------------- |
| Backend       | Bun, TypeScript, Express 5, Zod (validação) e `pg`                          |
| Frontend      | HTML, CSS e TypeScript compilado para JavaScript, sem framework            |
| Banco         | PostgreSQL (schema em `db/schema.sql`)                                      |
| Compilação    | `latexmk` + TeX Live no servidor                                            |
| Build/dev     | Bun (`dev/build.ts` gera `public/js/`; `dev/serve.ts` serve a UI isolada)   |
| Container     | Docker + Docker Compose                                                     |

## Configuração do Ambiente

As credenciais do banco e as portas são lidas de variáveis de ambiente. Copie o arquivo de exemplo e ajuste os valores conforme necessário:

```bash
cp .env.example .env
```

As variáveis disponíveis em [`.env.example`](.env.example) são:

| Variável             | Padrão     | Descrição                                                                          |
| -------------------- | ---------- | ---------------------------------------------------------------------------------- |
| `POSTGRES_USER`      | `postgres` | Usuário do banco de dados.                                                         |
| `POSTGRES_PASSWORD`  | `postgres` | Senha do banco de dados.                                                           |
| `POSTGRES_DB`        | `app_db`   | Nome do banco de dados.                                                            |
| `POSTGRES_HOST`      | `postgres` | Host do banco. No Docker é o nome do serviço; rodando nativamente use `localhost`. |
| `POSTGRES_PORT`      | `5432`     | Porta do banco de dados.                                                           |
| `POSTGRES_HOST_PORT` | `5439`     | Porta do PostgreSQL exposta no host (apenas Docker).                               |
| `SESSION_TTL_DAYS`   | `30`       | Tempo de vida das sessões de autenticação, em dias.                                |

## Requisitos do Sistema Host

A máquina que irá servir como distribuidora do sistema tem duas opções para rodar:

### Utilizando Docker

- **Requisitos:** Docker daemon instalado e rodando.
- **Comando de inicialização:** `docker compose up -d`
- A porta da aplicação no host pode ser alterada com a variável `APP_PORT` (padrão `3000`).

### Rodando nativamente utilizando Bun

- **Requisitos** Bun Runtime, PostgreSQL rodando, banco criado.
- **Comandos de inicilização:**
  - `bun build ./src/client/main.ts --outfile ./public/bundle.js --target browser` (Constrói o frontend)
  - `bun run src/server/server.ts` (Inicia o backend)

> O sistema não configura o PostgreSQL, quem roda local fica responsável por isso.

Ao final, o esperado é que o serviço esteja rodando na porta 3000 da máquina do usuário, ou onde ele foi configurado

## Documentação

- [Decisões de arquitetura do banco de dados](docs/database/SCHEMA.md)
- [Consultas de referência do banco de dados](docs/database/QUERIES.md)
- Diagrama do schema: [`db/generated/diagram.png`](db/generated/diagram.png)
- Schema em DBML: [`db/generated/schema.dbml`](db/generated/schema.dbml)
