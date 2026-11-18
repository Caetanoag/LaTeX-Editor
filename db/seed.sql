-- =============================================================================
-- SEED
-- =============================================================================
-- Este arquivo popula o banco com dados de sistema (permissões, roles) e dados
-- de teste (usuários, workspaces, projetos, arquivos, versões, comentários).
--
-- Uso:
--   psql -U postgres -d app_db -f db/seed.sql
--
-- É idempotente para dados de sistema (usa ON CONFLICT DO NOTHING). Dados de
-- teste NÃO são idempotentes — rodar duas vezes cria duplicatas. Para
-- recomeçar, dropar o banco ou truncar as tabelas.
-- =============================================================================
-- =============================================================================
-- 1. PERMISSÕES (dados de sistema)
-- =============================================================================
insert into permissions (code, description)
values (
        'workspace.read',
        'Ver o workspace e seus projetos'
    ),
    (
        'workspace.manage_members',
        'Convidar, remover e alterar papéis de membros'
    ),
    (
        'workspace.manage_settings',
        'Editar nome, descrição e configurações do workspace'
    ),
    (
        'workspace.delete',
        'Arquivar ou deletar o workspace'
    ),
    (
        'project.read',
        'Ver o projeto e seus arquivos'
    ),
    (
        'project.write',
        'Criar, editar e deletar arquivos'
    ),
    (
        'project.comment',
        'Comentar em arquivos e responder threads'
    ),
    (
        'project.manage_members',
        'Convidar e remover membros do projeto'
    ),
    (
        'project.delete',
        'Arquivar ou deletar o projeto'
    ),
    (
        'project.fork',
        'Criar um fork do projeto'
    ) on conflict (code) do nothing;
-- =============================================================================
-- 2. ROLES (dados de sistema)
-- =============================================================================
insert into roles (scope, name, description)
values -- Roles de workspace
    (
        'workspace',
        'owner',
        'Dono do workspace. Pode tudo.'
    ),
    (
        'workspace',
        'admin',
        'Administrador. Pode gerenciar membros e configurações.'
    ),
    (
        'workspace',
        'member',
        'Membro comum. Pode criar e trabalhar em projetos.'
    ),
    (
        'workspace',
        'guest',
        'Convidado. Acesso restrito a projetos específicos.'
    ),
    -- Roles de projeto
    (
        'project',
        'owner',
        'Dono do projeto. Pode tudo.'
    ),
    (
        'project',
        'editor',
        'Pode ler e editar arquivos.'
    ),
    (
        'project',
        'commenter',
        'Pode ler e comentar, mas não editar.'
    ),
    ('project', 'reader', 'Apenas leitura.') on conflict (scope, name) do nothing;
-- =============================================================================
-- 3. ASSOCIAÇÃO ROLE ↔ PERMISSION (dados de sistema)
-- =============================================================================
-- Workspace: owner (todas as permissões de workspace)
insert into role_permissions (role_id, permission_id)
select r.id,
    p.id
from roles r,
    permissions p
where r.scope = 'workspace'
    and r.name = 'owner'
    and p.code in (
        'workspace.read',
        'workspace.manage_members',
        'workspace.manage_settings',
        'workspace.delete'
    ) on conflict do nothing;
-- Workspace: admin (todas menos delete)
insert into role_permissions (role_id, permission_id)
select r.id,
    p.id
from roles r,
    permissions p
where r.scope = 'workspace'
    and r.name = 'admin'
    and p.code in (
        'workspace.read',
        'workspace.manage_members',
        'workspace.manage_settings'
    ) on conflict do nothing;
-- Workspace: member (só read)
insert into role_permissions (role_id, permission_id)
select r.id,
    p.id
from roles r,
    permissions p
where r.scope = 'workspace'
    and r.name = 'member'
    and p.code in ('workspace.read') on conflict do nothing;
-- Workspace: guest (só read)
insert into role_permissions (role_id, permission_id)
select r.id,
    p.id
from roles r,
    permissions p
where r.scope = 'workspace'
    and r.name = 'guest'
    and p.code in ('workspace.read') on conflict do nothing;
-- Project: owner (todas as permissões de projeto)
insert into role_permissions (role_id, permission_id)
select r.id,
    p.id
from roles r,
    permissions p
where r.scope = 'project'
    and r.name = 'owner'
    and p.code in (
        'project.read',
        'project.write',
        'project.comment',
        'project.manage_members',
        'project.delete',
        'project.fork'
    ) on conflict do nothing;
-- Project: editor (read, write, comment, fork)
insert into role_permissions (role_id, permission_id)
select r.id,
    p.id
from roles r,
    permissions p
where r.scope = 'project'
    and r.name = 'editor'
    and p.code in (
        'project.read',
        'project.write',
        'project.comment',
        'project.fork'
    ) on conflict do nothing;
-- Project: commenter (read, comment)
insert into role_permissions (role_id, permission_id)
select r.id,
    p.id
from roles r,
    permissions p
where r.scope = 'project'
    and r.name = 'commenter'
    and p.code in ('project.read', 'project.comment') on conflict do nothing;
-- Project: reader (só read)
insert into role_permissions (role_id, permission_id)
select r.id,
    p.id
from roles r,
    permissions p
where r.scope = 'project'
    and r.name = 'reader'
    and p.code in ('project.read') on conflict do nothing;
-- =============================================================================
-- 4. USUÁRIOS (dados de teste)
-- =============================================================================
-- Senha de todos os usuários de teste: "senha123456" (12 chars, atende o schema).
-- O hash é bcrypt de exemplo — NÃO use em produção.
-- Em dev, gere com: Bun.password.hash("senha123456")
--
-- Os hashes abaixo são placeholders. Substitua pelo hash real gerado pelo
-- Bun.password.hash() no seu ambiente. Se quiser pular essa etapa, use o seed
-- com os usuários já prontos e faça login com a senha acima após gerar os
-- hashes via script.
insert into users (username, email, password_hash)
values (
        'alice',
        'alice@example.com',
        '$2a$10$placeholder1'
    ),
    (
        'bob',
        'bob@example.com',
        '$2a$10$placeholder2'
    ),
    (
        'carol',
        'carol@example.com',
        '$2a$10$placeholder3'
    ),
    (
        'dave',
        'dave@example.com',
        '$2a$10$placeholder4'
    ),
    (
        'eve',
        'eve@example.com',
        '$2a$10$placeholder5'
    ),
    (
        'frank',
        'frank@example.com',
        '$2a$10$placeholder6'
    ),
    (
        'grace',
        'grace@example.com',
        '$2a$10$placeholder7'
    ),
    (
        'heidi',
        'heidi@example.com',
        '$2a$10$placeholder8'
    ),
    (
        'ivan',
        'ivan@example.com',
        '$2a$10$placeholder9'
    ),
    (
        'judy',
        'judy@example.com',
        '$2a$10$placeholder10'
    );
-- =============================================================================
-- 5. PERFIS
-- =============================================================================
-- display_name começa igual ao username, conforme DECISIONS.md.
insert into user_profiles (user_id, display_name, bio)
select u.id,
    u.username,
    case
        u.username
        when 'alice' then 'Pesquisadora em sistemas distribuídos.'
        when 'bob' then 'Estudante de mestrado.'
        when 'carol' then 'Engenheira de software.'
        when 'dave' then 'Professor.'
        when 'eve' then 'Escritora técnica.'
        else null
    end
from users u;
-- =============================================================================
-- 6. WORKSPACES
-- =============================================================================
insert into workspaces (name, url_identifier, description, owner_id)
select 'Lab de Pesquisa',
    'lab-pesquisa',
    'Workspace do laboratório',
    u.id
from users u
where u.username = 'alice'
union all
select 'Time de Escrita',
    'time-escrita',
    'Projetos de escrita técnica',
    u.id
from users u
where u.username = 'eve'
union all
select 'Curso de LaTeX',
    'curso-latex',
    'Materiais do curso',
    u.id
from users u
where u.username = 'dave';
-- =============================================================================
-- 7. MEMBROS DE WORKSPACE
-- =============================================================================
-- Lab de Pesquisa: alice (owner), bob (member), carol (member)
insert into workspace_members (workspace_id, user_id, role_id, invited_by)
select w.id,
    u.id,
    r.id,
    owner.id
from workspaces w,
    users u,
    roles r,
    users owner
where w.url_identifier = 'lab-pesquisa'
    and r.scope = 'workspace'
    and owner.username = 'alice'
    and (
        (
            u.username = 'alice'
            and r.name = 'owner'
        )
        or (
            u.username = 'bob'
            and r.name = 'member'
        )
        or (
            u.username = 'carol'
            and r.name = 'member'
        )
    );
-- Time de Escrita: eve (owner), frank (member), grace (member)
insert into workspace_members (workspace_id, user_id, role_id, invited_by)
select w.id,
    u.id,
    r.id,
    owner.id
from workspaces w,
    users u,
    roles r,
    users owner
where w.url_identifier = 'time-escrita'
    and r.scope = 'workspace'
    and owner.username = 'eve'
    and (
        (
            u.username = 'eve'
            and r.name = 'owner'
        )
        or (
            u.username = 'frank'
            and r.name = 'member'
        )
        or (
            u.username = 'grace'
            and r.name = 'member'
        )
    );
-- Curso de LaTeX: dave (owner), heidi (member), ivan (member), judy (guest)
insert into workspace_members (workspace_id, user_id, role_id, invited_by)
select w.id,
    u.id,
    r.id,
    owner.id
from workspaces w,
    users u,
    roles r,
    users owner
where w.url_identifier = 'curso-latex'
    and r.scope = 'workspace'
    and owner.username = 'dave'
    and (
        (
            u.username = 'dave'
            and r.name = 'owner'
        )
        or (
            u.username = 'heidi'
            and r.name = 'member'
        )
        or (
            u.username = 'ivan'
            and r.name = 'member'
        )
        or (
            u.username = 'judy'
            and r.name = 'guest'
        )
    );
-- =============================================================================
-- 8. PROJETOS
-- =============================================================================
insert into projects (
        workspace_id,
        owner_id,
        title,
        description,
        visibility
    )
select w.id,
    u.id,
    'Artigo: Consenso em Sistemas Distribuídos',
    'Rascunho do artigo para submissão em conferência.',
    'workspace'
from workspaces w,
    users u
where w.url_identifier = 'lab-pesquisa'
    and u.username = 'alice'
union all
select w.id,
    u.id,
    'Tese de Doutorado',
    'Capítulos da tese.',
    'private'
from workspaces w,
    users u
where w.url_identifier = 'lab-pesquisa'
    and u.username = 'alice'
union all
select w.id,
    u.id,
    'Documentação Técnica',
    'Manuais de produto.',
    'workspace'
from workspaces w,
    users u
where w.url_identifier = 'time-escrita'
    and u.username = 'eve'
union all
select w.id,
    u.id,
    'Currículo Profissional',
    'Currículo em LaTeX.',
    'public'
from workspaces w,
    users u
where w.url_identifier = 'time-escrita'
    and u.username = 'frank'
union all
select w.id,
    u.id,
    'Apostila do Curso',
    'Material didático.',
    'public'
from workspaces w,
    users u
where w.url_identifier = 'curso-latex'
    and u.username = 'dave';
-- =============================================================================
-- 9. MEMBROS DE PROJETO
-- =============================================================================
-- O dono do projeto também é membro (com role 'owner').
-- Todos os projetos: dono é owner
insert into project_members (project_id, user_id, role_id, granted_by)
select p.id,
    p.owner_id,
    r.id,
    p.owner_id
from projects p,
    roles r
where r.scope = 'project'
    and r.name = 'owner';
-- Artigo: bob (editor), carol (commenter)
insert into project_members (project_id, user_id, role_id, granted_by)
select p.id,
    u.id,
    r.id,
    p.owner_id
from projects p,
    users u,
    roles r
where p.title = 'Artigo: Consenso em Sistemas Distribuídos'
    and r.scope = 'project'
    and (
        (
            u.username = 'bob'
            and r.name = 'editor'
        )
        or (
            u.username = 'carol'
            and r.name = 'commenter'
        )
    );
-- Tese: bob (commenter)
insert into project_members (project_id, user_id, role_id, granted_by)
select p.id,
    u.id,
    r.id,
    p.owner_id
from projects p,
    users u,
    roles r
where p.title = 'Tese de Doutorado'
    and r.scope = 'project'
    and u.username = 'bob'
    and r.name = 'commenter';
-- Documentação: frank (editor), grace (commenter)
insert into project_members (project_id, user_id, role_id, granted_by)
select p.id,
    u.id,
    r.id,
    p.owner_id
from projects p,
    users u,
    roles r
where p.title = 'Documentação Técnica'
    and r.scope = 'project'
    and (
        (
            u.username = 'frank'
            and r.name = 'editor'
        )
        or (
            u.username = 'grace'
            and r.name = 'commenter'
        )
    );
-- =============================================================================
-- 10. ARQUIVOS
-- =============================================================================
-- Cada projeto tem um main.tex e, opcionalmente, arquivos adicionais.
-- main.tex para todos os projetos
insert into project_files (project_id, file_path, file_content, is_main)
select p.id,
    '/main.tex',
    E'\\documentclass{article}\n\\begin{document}\n\\title{' || p.title || E'}\n\\maketitle\n\\end{document}\n',
    true
from projects p;
-- Artigo: adiciona sections/intro.tex, sections/metodos.tex, refs.bib
insert into project_files (project_id, file_path, file_content, is_main)
select p.id,
    '/sections/intro.tex',
    E'\\section{Introdução}\nTexto da introdução.\n',
    false
from projects p
where p.title = 'Artigo: Consenso em Sistemas Distribuídos'
union all
select p.id,
    '/sections/metodos.tex',
    E'\\section{Métodos}\nDescrição dos métodos.\n',
    false
from projects p
where p.title = 'Artigo: Consenso em Sistemas Distribuídos'
union all
select p.id,
    '/refs.bib',
    E'@article{knuth1984,\n  title={The TeXbook},\n  author={Knuth, Donald E.},\n  year={1984}\n}\n',
    false
from projects p
where p.title = 'Artigo: Consenso em Sistemas Distribuídos';
-- Tese: adiciona dois capítulos
insert into project_files (project_id, file_path, file_content, is_main)
select p.id,
    '/chapters/cap1.tex',
    E'\\chapter{Introdução}\n',
    false
from projects p
where p.title = 'Tese de Doutorado'
union all
select p.id,
    '/chapters/cap2.tex',
    E'\\chapter{Fundamentação Teórica}\n',
    false
from projects p
where p.title = 'Tese de Doutorado';
-- =============================================================================
-- 11. VERSÕES DE ARQUIVO
-- =============================================================================
-- Uma versão inicial por arquivo (o estado atual). O hash é do conteúdo.
-- Usando md5 (pgcrypto não está habilitado) apenas para demonstração.
-- Em produção, use sha256 via Bun.password ou crypto.
insert into file_versions (
        file_id,
        version_hash,
        content,
        author_id,
        message
    )
select pf.id,
    md5(pf.file_content),
    pf.file_content,
    p.owner_id,
    'Versão inicial'
from project_files pf
    join projects p on p.id = pf.project_id;
-- =============================================================================
-- 12. COMENTÁRIOS
-- =============================================================================
-- Alice comenta em sections/intro.tex do artigo
insert into comments (
        project_id,
        file_id,
        created_by,
        content,
        line_number
    )
select p.id,
    pf.id,
    u.id,
    'Precisamos de uma citação aqui para sustentar a afirmação.',
    3
from projects p
    join project_files pf on pf.project_id = p.id
    join users u on u.username = 'alice'
where p.title = 'Artigo: Consenso em Sistemas Distribuídos'
    and pf.file_path = '/sections/intro.tex';
-- Bob responde
insert into comments (
        project_id,
        file_id,
        created_by,
        content,
        line_number,
        parent_id
    )
select p.id,
    pf.id,
    u.id,
    'Concordo. Vou adicionar uma referência ao Lamport.',
    3,
    c.id
from projects p
    join project_files pf on pf.project_id = p.id
    join users u on u.username = 'bob'
    join comments c on c.file_id = pf.id
    and c.content like 'Precisamos de uma citação%'
where p.title = 'Artigo: Consenso em Sistemas Distribuídos'
    and pf.file_path = '/sections/intro.tex';
-- Carol comenta no arquivo inteiro
insert into comments (project_id, file_id, created_by, content)
select p.id,
    pf.id,
    u.id,
    'O arquivo está bom, mas considere dividir em subsections.'
from projects p
    join project_files pf on pf.project_id = p.id
    join users u on u.username = 'carol'
where p.title = 'Artigo: Consenso em Sistemas Distribuídos'
    and pf.file_path = '/sections/metodos.tex';