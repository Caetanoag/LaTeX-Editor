create extension if not exists citext;
create table users (
    id bigserial primary key,
    username citext not null unique,
    email citext not null unique,
    password_hash text not null check (length(password_hash) > 0),
    created_at timestamptz not null default now(),
    last_login_at timestamptz,
    updated_at timestamptz not null default now(),
    deleted_at timestamptz default null
);
create table user_profiles (
    user_id bigint primary key references users(id) on delete cascade,
    display_name varchar(100) not null,
    bio text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table permissions (
    id serial primary key,
    code varchar(100) not null unique,
    description text
);
create table roles (
    id serial primary key,
    scope varchar(20) not null check (scope in ('workspace', 'project')),
    name varchar(50) not null,
    description text,
    unique (scope, name)
);
create table role_permissions (
    role_id int not null references roles(id) on delete cascade,
    permission_id int not null references permissions(id) on delete cascade,
    primary key (role_id, permission_id)
);
create table workspaces (
    id bigserial primary key,
    name varchar(100) not null,
    url_identifier citext not null unique,
    description text,
    owner_id bigint not null references users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz default null
);
create table workspace_invitations (
    id bigserial primary key,
    workspace_id bigint not null references workspaces(id) on delete cascade,
    email citext not null,
    role_id int not null references roles(id),
    invited_by bigint not null references users(id),
    token text not null unique,
    expires_at timestamptz not null,
    accepted_at timestamptz,
    created_at timestamptz not null default now(),
    check (
        accepted_at is null
        or accepted_at >= created_at
    )
);
create table workspace_members (
    workspace_id bigint not null references workspaces(id) on delete cascade,
    user_id bigint not null references users(id) on delete cascade,
    role_id int not null references roles(id),
    joined_at timestamptz not null default now(),
    invited_by bigint references users(id),
    primary key (workspace_id, user_id)
);
create table projects (
    id bigserial primary key,
    workspace_id bigint not null references workspaces(id) on delete cascade,
    owner_id bigint not null references users(id),
    title varchar(200) not null,
    description text,
    visibility varchar(20) not null default 'private' check (visibility in ('private', 'workspace', 'public')),
    forked_from_id bigint references projects(id) on delete
    set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        archived_at timestamptz default null,
        check (
            forked_from_id is null
            or forked_from_id <> id
        )
);
create table project_members (
    project_id bigint not null references projects(id) on delete cascade,
    user_id bigint not null references users(id) on delete cascade,
    role_id int not null references roles(id),
    granted_by bigint references users(id),
    granted_at timestamptz not null default now(),
    expires_at timestamptz,
    primary key (project_id, user_id),
    check (
        expires_at is null
        or expires_at > granted_at
    )
);
create table project_files (
    id bigserial primary key,
    project_id bigint not null references projects(id) on delete cascade,
    file_path text not null,
    file_content text not null default '',
    is_main boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (project_id, file_path)
);
create unique index project_files_one_main_idx on project_files (project_id)
where is_main = true;
create table file_versions (
    id bigserial primary key,
    file_id bigint not null references project_files(id) on delete cascade,
    version_hash text not null,
    message text,
    content text not null default '',
    author_id bigint not null references users(id),
    created_at timestamptz not null default now(),
    unique(file_id, version_hash)
);
create table comments (
    id bigserial primary key,
    project_id bigint not null references projects(id) on delete cascade,
    file_id bigint references project_files(id) on delete cascade,
    created_by bigint not null references users(id),
    resolved_by bigint references users(id),
    content text not null default '',
    parent_id bigint references comments(id) on delete cascade,
    line_number int,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    resolved_at timestamptz,
    check (
        line_number is null
        or file_id is not null
    ),
    check (
        line_number is null
        or line_number > 0
    ),
    check (
        resolved_at is null
        or resolved_at >= created_at
    )
);
create table tags (
    id bigserial primary key,
    name citext not null unique,
    created_at timestamptz not null default now(),
    created_by bigint references users(id)
);
create table project_tags (
    project_id bigint not null references projects(id) on delete cascade,
    tag_id bigint not null references tags(id) on delete cascade,
    added_by bigint references users(id),
    added_at timestamptz not null default now(),
    primary key (project_id, tag_id)
);