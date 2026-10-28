# SafeBox AI - Member 2 Sandbox Worker
# Minimal, hardened Linux container for isolated execution and security verification.

FROM python:3.12-slim-bookworm AS base

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# Create unprivileged group and user (UID/GID 10001)
RUN groupadd -g 10001 safebox && \
    useradd -u 10001 -g 10001 -M -s /usr/sbin/nologin safebox

# Create app and workspace directories with strict permissions
# /workspaces/isolated_canary is a synthetic DAC fixture owned by root:root (0700)
# to verify in-container discretionary access control denial for unprivileged worker (10001)
RUN mkdir -p /app /workspace /workspaces/isolated_canary && \
    chown -R safebox:safebox /app /workspace /workspaces && \
    chown -R root:root /workspaces/isolated_canary && \
    chmod 750 /app && \
    chmod 755 /workspaces && \
    chmod 700 /workspace && \
    chmod 700 /workspaces/isolated_canary

WORKDIR /app

# Copy dependency specifications and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy worker application code
COPY worker /app/worker

# Set permissions
RUN chown -R root:root /app && \
    chmod -R 555 /app && \
    chmod -R 777 /workspace && \
    chown -R root:root /workspaces/isolated_canary && \
    chmod 700 /workspaces/isolated_canary

# Run as non-root unprivileged user
USER 10001:10001

# Entrypoint executes the worker verification runner
ENTRYPOINT ["python", "-m", "worker.main"]
CMD ["--help"]
