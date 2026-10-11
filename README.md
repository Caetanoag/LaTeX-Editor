# LaTeX Editor

Editor de LaTeX self-hosted e open-source, construído com TypeScript.

## Funcionalidades Principais

- **Acesso via navegador:** Apenas uma máquina na rede local precisa rodar o sistema, o resto pode acessar remotamente utilizar em qualquer navegador.
- **Arquitetura Multi usuário:** Suporte para multiplos usuários, contas e equipes, essencial para colaboração.
- **Edição Colaborativa de Documentos:** Compartilhe documentos com equipes ou usuários, controlando de forma precisa quais permissões cada pessoa tem (editar, comentar, etc).
- **Tudo Fica Armazenado no Servidor:** Com o banco de dados PostgreSQL integrado, nada é perdido quando o serviço precisa ser reiniciado. Dados persistentes e de fácil migração entre máquinas.

## Tech Stack

- **Frontend:** HTML5, CSS3, TypeScript
- **Backend:** TypeScript, Express.js
- **Runtime & Build:** Bun
- **Sistema de Container:** Docker
- **Banco de dados:** PostgreSQL
