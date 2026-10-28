"""Network security controls, SSRF protections, and secret sanitization.

Strictly protects SafeBox backend against Server-Side Request Forgery (SSRF)
when evaluating custom endpoints, self-hosted servers, or remote APIs.
"""
from __future__ import annotations

import ipaddress
import logging
import re
import socket
from urllib.parse import urlparse

logger = logging.getLogger("safebox.security.network")

# Disallowed IP ranges by default (cloud metadata, link-local, loopback, private RFC1918, multicast, etc.)
METADATA_IPS = {
    ipaddress.ip_address("169.254.169.254"),  # AWS/GCP/Azure instance metadata
    ipaddress.ip_address("fd00:ec2::254"),     # AWS IPv6 metadata
}

SECRET_PATTERNS = [
    re.compile(r"(Bearer\s+)[A-Za-z0-9_\-\.]{8,}", re.IGNORECASE),
    re.compile(r"(api[_\-]?key[\"'\s:=]+)[A-Za-z0-9_\-\.]{8,}", re.IGNORECASE),
    re.compile(r"(sk-[A-Za-z0-9_\-]{20,})", re.IGNORECASE),
    re.compile(r"(x-api-key[\"'\s:=]+)[A-Za-z0-9_\-\.]{8,}", re.IGNORECASE),
]
GOOGLE_KEY_PATTERN = re.compile(r"\bAIza[0-9A-Za-z_\-]{20,}\b")


def is_ip_disallowed(
    ip: ipaddress.IPv4Address | ipaddress.IPv6Address,
    allow_localhost: bool = False,
    allow_private: bool = False,
) -> tuple[bool, str]:
    """Inspect IP address against SSRF boundaries."""
    if ip in METADATA_IPS:
        return True, "Cloud metadata endpoints (169.254.169.254) are strictly prohibited."

    if ip.is_link_local:
        return True, "Link-local addresses are prohibited."

    if ip.is_multicast:
        return True, "Multicast addresses are prohibited."

    if ip.is_unspecified:
        return True, "Unspecified 0.0.0.0 addresses are prohibited."

    if ip.is_loopback:
        if not allow_localhost:
            return True, "Loopback addresses (127.0.0.0/8, ::1) are prohibited unless explicitly permitted."
        return False, ""

    if ip.is_private:
        if not allow_private:
            return True, "Private network IP ranges (RFC 1918 / RFC 4193) are prohibited unless explicitly permitted."
        return False, ""

    return False, ""


def validate_endpoint_url(
    url: str,
    allow_localhost: bool = False,
    allow_private: bool = False,
) -> tuple[bool, str | None]:
    """Validate that a user-supplied or configured endpoint URL is safe from SSRF attacks.

    Returns (is_valid, error_reason).
    """
    if not url or len(url) > 2048:
        return False, "URL must be between 1 and 2048 characters."

    try:
        parsed = urlparse(url.strip())
    except Exception as exc:
        return False, f"Invalid URL format: {exc}"

    if parsed.scheme.lower() not in ("http", "https"):
        return False, f"Unsupported scheme '{parsed.scheme}'. Only http and https are permitted."

    if not parsed.hostname:
        return False, "URL must contain a valid hostname or IP address."

    if parsed.username or parsed.password:
        return False, "URLs containing embedded credentials (user:pass@host) are strictly prohibited."

    host = parsed.hostname.strip().strip("[]").lower()

    # Check for direct IP
    try:
        ip = ipaddress.ip_address(host)
        disallowed, reason = is_ip_disallowed(ip, allow_localhost, allow_private)
        if disallowed:
            return False, f"Access denied to target host '{host}': {reason}"
        return True, None
    except ValueError:
        pass  # It's a domain name

    if host == "localhost":
        if not allow_localhost:
            return False, "Access to 'localhost' is prohibited unless explicitly permitted."
        return True, None

    # Resolve domain to verify it doesn't map to a prohibited private/metadata IP (DNS rebinding / SSRF)
    try:
        addr_info = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80))
        for item in addr_info:
            sockaddr = item[4]
            resolved_ip_str = sockaddr[0]
            ip = ipaddress.ip_address(resolved_ip_str)
            disallowed, reason = is_ip_disallowed(ip, allow_localhost, allow_private)
            if disallowed:
                return False, f"Target domain '{host}' resolves to protected address {resolved_ip_str}: {reason}"
    except socket.gaierror as exc:
        return False, f"DNS resolution failed for host '{host}': {exc}"
    except Exception as exc:
        logger.warning("SSRF check resolution warning for %s: %s", host, exc)

    return True, None


def sanitize_secrets_from_text(text: str, *additional_secrets: str | None) -> str:
    """Mask any API keys or tokens from raw error or debug messages."""
    result = text
    for secret in additional_secrets:
        if secret and len(secret) >= 6:
            result = result.replace(secret, "[REDACTED_SECRET]")
    for pat in SECRET_PATTERNS:
        result = pat.sub(r"\1[REDACTED_SECRET]", result)
    result = GOOGLE_KEY_PATTERN.sub("[REDACTED_SECRET]", result)
    return result
