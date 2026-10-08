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
    created_at timestamptz not null default now()
);
create table workspace_members (
    workspace_id bigint not null references workspaces(id) on delete cascade,
    user_id bigint not null references users(id) on delete cascade,
    role_id int not null references roles(id),
    joined_at timestamptz not null default now(),
    primary key (workspace_id, user_id)
);
