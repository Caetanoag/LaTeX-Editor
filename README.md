# LaTeX Editor

Editor de LaTeX self-hosted e open-source, construído com TypeScript.

## Funcionalidades Principais

- **Acesso via navegador:** Apenas uma máquina na rede local precisa rodar o sistema, o resto pode acessar remotamente utilizar em qualquer navegador.
- **Arquitetura Multi usuário:** Suporte para multiplos usuários, contas e equipes, essencial para colaboração.
- **Edição Colaborativa de Documentos:** Compartilhe documentos com equipes ou usuários, controlando de forma precisa quais permissões cada pessoa tem (editar, comentar, etc).
- **Tudo Fica Armazenado no Servidor:** Com o banco de dados PostgreSQL integrado, nada é perdido quando o serviço precisa ser reiniciado. Dados persistentes e de fácil migração entre máquinas.

## Tech Stack

- **Frontend:** HTML5, CSS3, JavaScript
- **Backend:** TypeScript, Express.js
- **Runtime & Build:** Bun
- **Sistema de Container:** Docker
- **Banco de dados:** PostgreSQL

## Configuração do Ambiente

As credenciais do banco e as portas são lidas de variáveis de ambiente. Copie o arquivo de exemplo e ajuste os valores conforme necessário:

```bash
cp .env.example .env
```

As variáveis disponíveis em [`.env.example`](.env.example) são:

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `POSTGRES_USER` | `postgres` | Usuário do banco de dados. |
| `POSTGRES_PASSWORD` | `postgres` | Senha do banco de dados. |
| `POSTGRES_DB` | `app_db` | Nome do banco de dados. |
| `POSTGRES_HOST` | `postgres` | Host do banco. No Docker é o nome do serviço; rodando nativamente use `localhost`. |
| `POSTGRES_PORT` | `5432` | Porta do banco de dados. |
| `POSTGRES_HOST_PORT` | `5439` | Porta do PostgreSQL exposta no host (apenas Docker). |
| `SESSION_TTL_DAYS` | `30` | Tempo de vida das sessões de autenticação, em dias. |

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
