#!/bin/bash -e
# Install Docker CE and utilities (runs inside chroot)

apt-get update
apt-get install -y --no-install-recommends \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-compose-plugin \
    curl \
    avahi-daemon

# Enable services
systemctl enable docker
systemctl enable avahi-daemon

# Add pi user to docker group
usermod -aG docker pi

# Set hostname
echo "openframe" > /etc/hostname
sed -i 's/127\.0\.1\.1.*/127.0.1.1\topenframe/' /etc/hosts
