# Requirements Document

## Introduction

This document describes the requirements for a Task Manager web application composed of a React frontend and a FastAPI backend. The application allows authenticated users to manage their personal tasks through a dashboard interface, supporting creation, status updates, and deletion of tasks. Authentication is handled via username/password login with session-based or token-based access control.

## Glossary

- **System**: The Task Manager web application as a whole, encompassing frontend and backend components.
- **Frontend**: The React single-page application served to the user's browser.
- **Backend**: The FastAPI service that exposes REST API endpoints and manages data persistence.
- **User**: An individual with a registered account who authenticates to use the application.
- **Task**: A unit of work belonging to a User, with a title, optional description, status, and timestamps.
- **Dashboard**: The primary view displayed after login, showing the User's task list and summary information.
- **Auth_Service**: The backend component responsible for validating credentials and issuing access tokens.
- **Task_Service**: The backend component responsible for creating, retrieving, updating, and deleting tasks.
- **Token**: A JSON Web Token (JWT) issued by the Auth_Service upon successful login, used to authenticate subsequent API requests.
- **Status**: The current state of a Task; one of `pending`, `in_progress`, or `done`.

---

## Requirements

### Requirement 1: User Authentication — Login

**User Story:** As a User, I want to log in with my username and password, so that I can access my personal task dashboard securely.

#### Acceptance Criteria

1. WHEN a User submits a valid username and password, THE Auth_Service SHALL return a Token with a 1-hour expiry and a 200 HTTP status code.
2. WHEN a User submits an invalid username or password, THE Auth_Service SHALL return a 401 HTTP status code with an error message indicating the credentials are incorrect and SHALL NOT return a 2xx HTTP status code.
3. WHEN a login request is received, THE Auth_Service SHALL complete the credential validation and token generation within 500ms under a load of 100 simultaneous login requests.
4. THE Frontend SHALL store the Token in memory or a secure HTTP-only cookie until the Token expires or the User explicitly logs out.
5. WHEN a User submits a login form with an empty username or password field, THE Frontend SHALL display a field-level validation error only on the empty or invalid field and SHALL NOT submit the request to the Backend; WHEN all submitted fields contain valid text, THE Frontend SHALL NOT display field-level validation errors.
6. WHEN a User fails authentication 5 consecutive times within a 10-minute window, THE Auth_Service SHALL reject further login attempts from that account for 15 minutes and SHALL return a 429 HTTP status code.
7. WHEN a User who is in the 15-minute lockout period submits valid credentials, THE Auth_Service SHALL authenticate the User, return a Token, and return a 200 HTTP status code.

---

### Requirement 2: Protected Route Enforcement

**User Story:** As a User, I want to be redirected to the login page when I am not authenticated, so that my task data remains private.

#### Acceptance Criteria

1. WHEN an unauthenticated User navigates to any protected route (including the Dashboard), THE Frontend SHALL redirect the User to the login page.
2. WHEN an API request is received without a valid Token (non-expired and unmodified), THE Backend SHALL return a 401 HTTP status code.
3. WHEN a Token has expired and a User attempts an API request, THE Backend SHALL return a 401 HTTP status code.
4. WHEN THE Frontend receives a 401 HTTP response from the Backend, THE Frontend SHALL redirect the User to the login page.
5. WHEN a User logs out, THE Frontend SHALL remove the stored Token and redirect the User to the login page.

---

### Requirement 3: Task Dashboard

**User Story:** As a User, I want to view all my tasks on a dashboard after logging in, so that I can see the current state of my work at a glance.

#### Acceptance Criteria

1. WHEN an authenticated User loads the Dashboard, THE Frontend SHALL request the User's task list from the Task_Service.
2. WHEN the task list is retrieved successfully, THE Frontend SHALL display each Task showing its title, status, and creation date.
3. WHEN the task list is retrieved successfully and the authenticated User has no tasks, THE Frontend SHALL display an empty-state message indicating no tasks exist and SHALL show a summary count displaying 0 for each Status group (pending, in_progress, done).
4. WHEN the task list is retrieved successfully and the authenticated User has one or more tasks, THE Frontend SHALL show a summary count of tasks grouped by Status (pending, in_progress, done).
5. WHEN the task list request fails, THE Frontend SHALL display an error message and SHALL provide a retry action that re-issues the task list request; WHEN the retry succeeds, THE Frontend SHALL display the task list and remove the error message.
6. WHEN the Task_Service returns more than 100 tasks, THE Frontend SHALL display the first 100 tasks and SHALL show a disclosure indicator that additional tasks exist.

---

### Requirement 4: Task Creation

**User Story:** As a User, I want to create a new task with a title and optional description, so that I can track new work items.

#### Acceptance Criteria

1. WHEN an authenticated User submits a task creation form with a valid title (1–255 characters), THE Task_Service SHALL persist the Task with a status of `pending` and return the created Task with a 201 HTTP status code.
2. IF a task creation request is submitted with an empty or missing title, THE Backend SHALL return a 422 HTTP status code with a validation error indicating the field name and the reason it is required.
3. WHEN a User submits the task creation form with an empty or missing title, THE Frontend SHALL display a field-level validation error and SHALL NOT submit the request to the Backend.
4. THE Task_Service SHALL associate every created Task with the authenticated User's account derived from the Token.
5. WHEN a Task is created successfully, THE Frontend SHALL prepend the new Task to the top of the Dashboard task list without requiring a full page reload.
6. WHEN a User submits a task creation form with a title field that is empty, THE Frontend SHALL display a field-level validation error and SHALL NOT submit the request to the Backend.
7. WHEN a User submits a task creation form with a title exceeding 255 characters, THE Frontend SHALL display a field-level validation error indicating the 255-character limit and SHALL NOT submit the request to the Backend.
8. IF a task creation request is submitted with a title exceeding 255 characters, THE Backend SHALL return a 422 HTTP status code with a validation error indicating the field name and the 255-character limit.
9. IF a task creation request is submitted with a description exceeding 1000 characters, THE Backend SHALL return a 422 HTTP status code with a validation error indicating the field name and the 1000-character limit.

---

### Requirement 5: Task Status Update

**User Story:** As a User, I want to update the status of a task, so that I can track its progress through my workflow.

#### Acceptance Criteria

1. WHEN an authenticated User updates the Status of a Task they own, THE Task_Service SHALL persist the new Status and return the updated Task with a 200 HTTP status code.
2. IF an authenticated User attempts to update the Status of a Task owned by a different User, THE Task_Service SHALL return a 403 HTTP status code.
3. IF a status update request contains a Status value outside of `pending`, `in_progress`, and `done`, THE Task_Service SHALL return a 422 HTTP status code.
4. WHEN THE Frontend receives a 200 HTTP response for a status update, THE Frontend SHALL reflect the new Status on the Dashboard within 500ms without a full page reload.
5. THE Frontend SHALL provide controls to transition a Task Status to each of the three allowed values: `pending`, `in_progress`, and `done`.
6. IF a status update request references a Task ID that does not exist, THE Task_Service SHALL return a 404 HTTP status code.
7. THE Task_Service SHALL allow any status transition between `pending`, `in_progress`, and `done` regardless of the current Status value.
8. IF THE Frontend fails to reflect the new Status within 500ms after receiving a 200 HTTP response for a status update, THE Frontend SHALL display an error indicator on the Task and SHALL NOT leave the UI in a stale state silently.

---

### Requirement 6: Task Deletion

**User Story:** As a User, I want to delete a task, so that I can remove work items that are no longer relevant.

#### Acceptance Criteria

1. WHEN an authenticated User deletes a Task they own, THE Task_Service SHALL remove the Task from persistent storage and return a 204 HTTP status code.
2. THE Task_Service SHALL check task ownership before processing a delete request; IF the authenticated User does not own the Task, THE Task_Service SHALL return a 403 HTTP status code regardless of whether the Task exists.
3. IF a delete request references a Task that does not exist, THE Task_Service SHALL return a 404 HTTP status code.
4. WHEN a Task is deleted successfully, THE Frontend SHALL remove the Task from the Dashboard task list without requiring a full page reload.
5. WHEN a User initiates a delete action on a Task, THE Frontend SHALL display a confirmation prompt containing a confirm option and a cancel option before submitting the delete request; THE Frontend SHALL NOT submit the delete request until the User explicitly selects the confirm option.
6. IF a User selects the cancel option in the confirmation prompt, THE Frontend SHALL dismiss the prompt and SHALL NOT submit the delete request.

---

### Requirement 7: Data Persistence

**User Story:** As a User, I want my tasks to be saved between sessions, so that I do not lose work when I close the browser.

#### Acceptance Criteria

1. THE Task_Service SHALL persist Task data (id, user_id, title, description, status, created_at, updated_at) in a database such that tasks survive application restarts.
2. THE Task_Service SHALL persist User account data (id, username, hashed_password) in a database such that user credentials survive application restarts.
3. WHEN the Backend starts, THE System SHALL initialize all required database tables if they do not already exist; IF database initialization fails, THE System SHALL log the error and SHALL NOT start the HTTP server; WHEN database initialization fails, THE System SHALL periodically retry initialization at a fixed interval of 30 seconds; WHEN initialization eventually succeeds, THE System SHALL start the HTTP server.
4. IF a database write operation fails during task creation, update, or deletion, THE Task_Service SHALL return a 500 HTTP status code and SHALL log the error with sufficient context for diagnosis.

---

### Requirement 8: API Design

**User Story:** As a developer, I want clearly defined REST API endpoints for all task and authentication operations, so that the Frontend and Backend can be developed and tested independently.

#### Acceptance Criteria

1. THE Backend SHALL expose a `POST /auth/login` endpoint that accepts `application/x-www-form-urlencoded` with `username` and `password` fields and returns a JSON body containing the Token and token type with a 200 HTTP status code on success, or a 401 HTTP status code on invalid credentials.
2. THE Backend SHALL expose a `GET /tasks` endpoint that returns a JSON array of all Tasks belonging to the authenticated User with a 200 HTTP status code, or a 401 HTTP status code if the Token is missing or invalid.
3. THE Backend SHALL expose a `POST /tasks` endpoint that accepts a JSON body containing `title` (required) and `description` (optional) and returns the created Task as JSON with a 201 HTTP status code, a 422 HTTP status code for validation errors, or a 401 HTTP status code if the Token is missing or invalid.
4. THE Backend SHALL expose a `PATCH /tasks/{task_id}` endpoint that accepts a JSON body containing `status` and returns the updated Task as JSON with a 200 HTTP status code, a 404 HTTP status code if the Task does not exist, a 403 HTTP status code if the Task is owned by a different User, a 422 HTTP status code for invalid status values, or a 401 HTTP status code if the Token is missing or invalid.
5. THE Backend SHALL expose a `DELETE /tasks/{task_id}` endpoint that returns a 204 HTTP status code on success, a 404 HTTP status code if the Task does not exist, a 403 HTTP status code if the Task is owned by a different User, or a 401 HTTP status code if the Token is missing or invalid.
6. THE Backend SHALL serve an OpenAPI schema at `/docs` for developer reference.
7. THE Frontend SHALL include the Token as a Bearer token in the `Authorization` header of all requests to protected endpoints.
