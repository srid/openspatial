# OpenSpatial Development Commands

# Default recipe - show available commands
default:
    @just --list

# Install all dependencies
install:
    npm install

# Run the dev server (includes signaling)
dev:
    npm run dev

# Build for production
build:
    npm run build

# Preview production build
preview:
    npm run preview

# Run tests once
test:
    npm run test:run

# Run tests in watch mode
test-watch:
    npm test

# Run E2E tests (multi-user browser tests)
e2e:
    npm run e2e

# Run E2E tests with UI (interactive debugging)
e2e-ui:
    npm run e2e:ui

# Clean node_modules
clean:
    rm -rf node_modules

# Reinstall all dependencies
reinstall: clean install
