-- Flyway migration V1: create the users table
-- Feature: task-manager-app, Task 1.4

CREATE TABLE IF NOT EXISTS users (
    id               SERIAL          PRIMARY KEY,
    username         VARCHAR(150)    NOT NULL UNIQUE,
    hashed_password  VARCHAR(255)    NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_users_username ON users (username);
