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

# Clean node_modules
clean:
    rm -rf node_modules

# Reinstall all dependencies
reinstall: clean install
