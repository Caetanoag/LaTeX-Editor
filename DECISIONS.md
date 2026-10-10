# Database Architeture Decisions

Enquanto eu desenvolvia o schema do banco de dados, tomei algumas decisões que considero importantes documentar, aqui estão elas separadas por Feature.

## Convenções gerais

- Utilizei `timestamptz` ao invés de `timestamp`. O fato do `timestamp` ser ambíguo cria incerteza em relação à fonte de verdade. Se o servidor mudar de fuso horário, falta referência para saber o significado real.
- Todas tabelas que possuem `updated_at` devem ser atualizadas pelo backend. Não há qualquer trigger no banco para manter a simplicadade do schema.

## Identidade de usuários

A aplicação possui um sistema de identidade para gerenciamento de projetos, documentos e permissões, e nele eu tomei decisões que são essenciais tanto para queries SQL robustas quanto para a própria experiência do usuário. 

- `username` e `email` são citext, pois uma pessoa com o email `joao@gmail.com` é igual a uma com o email `Joao@gmail.com`.

- `display_name` ficou separado na tabela `user_profiles`, para criar o fluxo de criar conta -> utilizar o software -> customizar, sem obrigatoriamente já ser necessário a customização completa. Enquanto não é finalizado o fluxo, `display_name` é igual a `username` (Isso deve ser garantido pelo backend, não pelo banco).

- `deleted_at` é utilizado para um soft-delete, marcando o momento em que ocorreu.

- FKs para `users(id)` sem `on delete` porque users nunca são hard-deleted.
O soft delete preserva integridade referencial sem cascatas destrutivas

## Edição baseada em Cargos

A arquitetura da edição de arquivos é completamente baseada em quem possui qual permissão e cargos em cada projeto. Se eu tenho o projeto `A` e nele tenho o cargo `owner`, porém no projeto `B` só posso comentar, as permissões do `A` não devem vazar para o `B`.

- A arquitetura utilizada é a RBAC (Role-Based Acesss Control), em que as permissões (tabela `permissions`) são ações isoladas, enquanto que os cargos de usuários `roles` são apenas nomeações que possuem um conjunto de permissões. Como a relação `roles` -> `permissions` é `N:N`, criei a tabela `role_permissions`, que conecta ambas.

- `roles` possuem `scope` (`workspace` ou `project`) porque papéis em níveis
diferentes não podem se misturar. Um usuário pode ser `owner` no workspace
e `reader` em um projeto específico, sem que as permissões de um nível
vazem para o outro. A granularidade é por projeto: todos os arquivos de
um projeto herdam as permissões do projeto.

## Workspaces

O editor possui um sistema de workspaces, em que é possível compartilhar acesso com diversos usuários e dar permissões específicas para eles em diversos projetos menores.

- Os convites são feitos por email, armazenados em `workspace_invitations.email`. Se o usuário existe, o convite é enviado para sua conta, se não, o convite existe até ele criar a conta.

- `token` é o identificador único do convite, utilizado na url `/invite/<token>`.

- `expires_at` existe para evitar que um convite vazado dê acesso eterno para um workspace.

- Um dono do workspace também é membro desse workspace, então o id dele é duplicado entre `workspaces` e `workspace_members`. Mesmo que o papel de dono seja transferido depois, ainda é preservado quem criou o workspace.

## Projetos

Os projetos são uma coleção de arquivos, de onde podem ser criados `forks` por outros usuários.

- `forked_from_id` possui a restrição `on delete set null`, isso ocorre pois o fork deve continuar existindo mesmo se o projeto inicial for deletado.

- `visibility` tem 3 opções, sendo elas `workspace` (todos no workspace podem ver), `public` (todos usuários podem ver) e `private` (apenas o dono e membros convidados podem ver).

- `project_members` define se um usuário pode ver um projeto, mesmo que ele esteja com `visibility` = `private`.

- Projetos usam apenas `archived_at`, não deleted_at. Arquivar é reversível, e deletar é hard delete (com on delete cascade removendo arquivos, versões e dependências). Projetos são unidades grandes o suficiente para justificar hard delete quando o usuário realmente quer se livrar.

## Arquivos

O sistema de arquivos não cria arquivos reais no servidor. Cada arquivo é uma linha em `project_files`, com file_path como string (`/sections/intro.tex`). A hierarquia visual (a "file tree") é construída pelo frontend ao parsear o path. Não há tabela de pastas, pois elas são implícitas no campo `file_path`.

- A utilização de `unique (project_id, file_path)` evita duplicatas dentro do mesmo projeto, o backend deve validar isso e retornar uma mensagem de que já existe o arquivo.

- Índice parcial `project_files_one_main_idx` para evitar que a propriedade `is_main` seja verdadeira para mais de um arquivo em um projeto.

- `file_content not null default '' ` evita que arquivos completamente nulos existam.

- Arquivos são armazenados como texto puro no Postgres, então binários (imagens, PDFs) não são suportados no MVP.