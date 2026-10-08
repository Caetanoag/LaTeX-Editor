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