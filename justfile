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

# Run E2E tests with line reporter (no interactive server)
e2e-quick pattern="":
    npx playwright test --reporter=line {{ if pattern != "" { "--grep=" + pattern } else { "" } }}

# Clean node_modules
clean:
    rm -rf node_modules

# Reinstall all dependencies
reinstall: clean install

# Generate demo video (MP4) and GIF from E2E recording
demo:
    rm -rf test-results/demo-recording
    npx playwright test --grep="demo recording" --reporter=line --project=chromium
    @echo "Converting recording..."
    @webm=$(find test-results/demo-recording -name '*.webm' | head -1) && \
      ffmpeg -y -i "$webm" \
        -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
        -vf "scale=1280:-2" \
        -movflags +faststart \
        docs/demo.mp4 && \
      echo "✅ docs/demo.mp4 ($(du -h docs/demo.mp4 | cut -f1))" && \
      ffmpeg -y -i "$webm" \
        -vf "fps=10,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
        -loop 0 docs/demo.gif && \
      echo "✅ docs/demo.gif ($(du -h docs/demo.gif | cut -f1))"
