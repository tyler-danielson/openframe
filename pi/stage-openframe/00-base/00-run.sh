#!/bin/bash -e
# Add Docker's official apt repository (runs on host, copies files into rootfs)

# Download Docker's GPG key
install -d "${ROOTFS_DIR}/etc/apt/keyrings"
curl -fsSL https://download.docker.com/linux/debian/gpg -o "${ROOTFS_DIR}/etc/apt/keyrings/docker.asc"
chmod a+r "${ROOTFS_DIR}/etc/apt/keyrings/docker.asc"

# Add Docker apt repository for arm64/bookworm
cat > "${ROOTFS_DIR}/etc/apt/sources.list.d/docker.list" << 'EOF'
deb [arch=arm64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable
EOF
