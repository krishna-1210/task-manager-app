-- Flyway migration V2: create the task_status enum and tasks table
-- Feature: task-manager-app, Task 1.4

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'done');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS tasks (
    id           SERIAL          PRIMARY KEY,
    user_id      INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        VARCHAR(255)    NOT NULL,
    description  TEXT,
    status       task_status     NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_tasks_user_id ON tasks (user_id);
