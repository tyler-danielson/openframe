#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PIGEN_DIR="$SCRIPT_DIR/.pi-gen"
PIGEN_REPO="https://github.com/RPi-Distro/pi-gen.git"
PIGEN_BRANCH="arm64"

echo "=== OpenFrame Pi Image Builder ==="

# Copy docker-compose.portable.yml into server stage
echo "Copying docker-compose.portable.yml..."
cp "$REPO_ROOT/docker/docker-compose.portable.yml" \
   "$SCRIPT_DIR/stage-openframe/01-server/files/docker-compose.yml"

# Clone pi-gen if not present
if [ ! -d "$PIGEN_DIR" ]; then
    echo "Cloning pi-gen ($PIGEN_BRANCH branch)..."
    git clone --depth 1 -b "$PIGEN_BRANCH" "$PIGEN_REPO" "$PIGEN_DIR"
else
    echo "Using cached pi-gen at $PIGEN_DIR"
fi

# Symlink our custom stage into pi-gen
ln -sfn "$SCRIPT_DIR/stage-openframe" "$PIGEN_DIR/stage-openframe"

# Copy config
cp "$SCRIPT_DIR/config" "$PIGEN_DIR/config"

# Create SKIP and SKIP_IMAGES files for stages we don't need
# We skip stage3/4/5 (desktop environments) since we add our own minimal kiosk
for stage in stage3 stage4 stage5; do
    mkdir -p "$PIGEN_DIR/$stage"
    touch "$PIGEN_DIR/$stage/SKIP" "$PIGEN_DIR/$stage/SKIP_IMAGES"
done

# Only produce image from our final stage
for stage in stage0 stage1 stage2; do
    mkdir -p "$PIGEN_DIR/$stage"
    touch "$PIGEN_DIR/$stage/SKIP_IMAGES"
done

echo "Building image with pi-gen Docker builder..."
cd "$PIGEN_DIR"
./build-docker.sh

echo ""
echo "=== Build complete ==="
echo "Image output: $PIGEN_DIR/deploy/"
ls -lh "$PIGEN_DIR/deploy/"*.img.xz 2>/dev/null || echo "Check $PIGEN_DIR/deploy/ for output files"
