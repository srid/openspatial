# Claude/Gemini AI Assistant Notes

## E2E Testing

**ALWAYS use `just e2e-quick` for e2e tests** - not `npx playwright test` directly.

```bash
# Fast e2e (use this!)
just e2e-quick

# Run specific test pattern
just e2e-quick "pattern"
```

The full `just e2e` spins up an interactive server which is slow.

## Terminal Commands

**Never use `| tail` or `| head`** - run commands directly in terminal so the user can see output in real-time. Use `command_status` to check results after.
