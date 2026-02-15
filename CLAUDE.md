# Claude/Gemini AI Assistant Notes

## Design Principles

- **No backwards compatibility concerns.** This is a greenfield project — break things freely when improving the design.
- **Aggressively remove unused code.** When removing a feature, delete all related code, types, constants, CSS, and tests. Dead code is a liability.
- **Keep the codebase lean.** Don't leave behind scaffolding, commented-out code, or "just in case" abstractions.

## E2E Testing

**ALWAYS use `just e2e-quick` for e2e tests** - not `npx playwright test` directly.

```bash
# Fast e2e (use this!)
just e2e-quick

# Run specific test pattern
just e2e-quick "pattern"
```

The full `just e2e` spins up an interactive server which is slow.

### E2E Waiting Pattern

**NEVER use `waitForTimeout` or `user.wait()` in e2e tests.** These cause flakiness under CI load.

Instead, use **declarative waiting**:

```typescript
// ❌ BAD: imperative wait
await alice.wait(1000);
const style = await bob.textNoteOf('any').style();
expect(style.fontSize).toBe('large');

// ✅ GOOD: declarative poll
await expect.poll(async () => {
  const s = await bob.textNoteOf('any').style();
  return s.fontSize;
}, { timeout: 5000 }).toBe('large');

// ✅ GOOD: wait for element visibility
await bob.waitForScreenShare('Alice');
await bob.waitForTextNote();
```

The only acceptable use of `wait()` is simulating intentional user pauses (e.g., between disconnect/reconnect).

## Terminal Commands

**Never use `| tail` or `| head`** - run commands directly in terminal so the user can see output in real-time. Use `command_status` to check results after.
