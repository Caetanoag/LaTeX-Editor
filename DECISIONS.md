# Database Architeture Decisions

Enquanto eu desenvolvia o schema do banco de dados, tomei algumas decisões que considero importantes documentar, aqui estão elas separadas por Feature.

## Convenções gerais

- Utilizei `timestamptz` ao invés de `timestamp`. O fato do `timestamp` ser ambíguo cria incerteza em relação à fonte de verdade. Se o servidor mudar de fuso horário, falta referência para saber o significado real.

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