# Task Dependency Order

Tasks must be implemented in wave order. Do not start a wave until all tasks from the prior wave are merged to `main`.

| Wave | Tasks | Notes |
|------|-------|-------|
| 0 | 1.1, 1.2, 1.3, 1.4 | Project scaffolding — must be done first |
| 1 | 2.1, 3.1, 10.1, 10.2 | DB models + base config |
| 2 | 4.1 | Auth foundation |
| 3 | 4.2–4.5, 5.1, 5.2 | Auth service + task model |
| 4 | 5.3, 5.4, 7.1, 11.1, 11.2 | Task CRUD + frontend setup |
| 5 | 7.2–7.7, 8.1, 11.3, 11.4, 12.1 | Task endpoints + frontend scaffold |
| 6 | 8.2, 8.3, 12.2, 12.3, 13.1 | Error handling + login page |
| 7 | 13.2, 13.3, 14.1 | Dashboard skeleton |
| 8 | 14.2, 15.1, 15.3, 15.4 | Task list UI |
| 9 | 15.2, 15.5, 15.6, 15.7 | Task actions UI |
| 10 | 16.1, 17.6, 17.7, 17.8 | Status summary + API wiring |
| 11 | 16.2–16.4, 17.1–17.5 | Polish + edge cases |

## Checkpoints

Tasks 6, 9, and 18 are checkpoints. At each checkpoint:
- All tests from prior tasks must pass
- Confirm with the developer before proceeding to the next wave
- No new tasks start until the checkpoint is cleared
