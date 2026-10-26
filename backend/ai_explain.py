"""AI-powered incident explanations for PulseWatch.

Uses OpenRouter to analyze the evidence collected by the monitor.
Falls back to deterministic explanations when AI is unavailable.
"""

import httpx

from config import settings


SYSTEM_PROMPT = """You are the incident-analysis assistant inside PulseWatch,
a self-hosted uptime monitoring platform.

Analyze only the evidence provided by PulseWatch.

Your job is to explain what the monitoring evidence suggests, not to invent
infrastructure that was not observed.

Rules:
- Give 3-5 short bullet points.
- Start with the most likely explanation.
- Clearly distinguish observed evidence from possible causes.
- Do not claim that a load balancer, Kubernetes, Cloudflare, database,
  autoscaling, or another infrastructure component exists unless the evidence
  explicitly mentions it.
- If the evidence is insufficient, say so.
- Mention the HTTP status or network error when relevant.
- Give a short "Typical recovery" estimate, but make it clear that it is only
  an estimate.
- Be concise and practical.
"""


def _rule_based(status_code: int | None, error: str | None) -> str:
    if status_code == 502:
        return (
            "Bad gateway (HTTP 502).\n"
            "• The monitored service or an upstream server returned an invalid gateway response.\n"
            "• The upstream application may have crashed or stopped responding.\n"
            "• A reverse proxy or gateway may be unable to reach the application.\n"
            "Typical recovery: often a few minutes after the underlying service recovers."
        )

    if status_code == 503:
        return (
            "Service unavailable (HTTP 503).\n"
            "• The server is reachable but is currently unable to serve the request.\n"
            "• The application may be overloaded, restarting, or temporarily unavailable.\n"
            "• A required dependency may also be unavailable.\n"
            "Typical recovery: usually minutes, depending on the underlying cause."
        )

    if status_code == 500:
        return (
            "Internal server error (HTTP 500).\n"
            "• The application encountered an unexpected server-side error.\n"
            "• A recent code or configuration change may be responsible.\n"
            "• Application logs are needed to identify the exact cause.\n"
            "Typical recovery: often a few minutes after the application is fixed or restarted."
        )

    if status_code == 504:
        return (
            "Gateway timeout (HTTP 504).\n"
            "• The server or upstream service did not respond within the expected time.\n"
            "• A slow dependency or overloaded application may be responsible.\n"
            "• Repeated timeouts suggest a persistent performance or connectivity problem.\n"
            "Typical recovery: minutes once the slow dependency or service recovers."
        )

    if error and "Timeout" in error:
        return (
            "Request timeout.\n"
            "• PulseWatch did not receive a response within the configured timeout.\n"
            "• The monitored service may be overloaded or responding too slowly.\n"
            "• Network connectivity between PulseWatch and the target may also be involved.\n"
            "Typical recovery: depends on whether the condition is transient or persistent."
        )

    if error and (
        "NameResolution" in error
        or "ConnectError" in error
        or "Connection refused" in error
    ):
        return (
            "Connection to the monitored host failed.\n"
            "• The hostname may not currently resolve correctly.\n"
            "• The target server may be offline or refusing connections.\n"
            "• Firewall or network connectivity may be blocking the connection.\n"
            "Typical recovery: depends on whether the host, DNS, or network is responsible."
        )

    return (
        "PulseWatch detected a monitoring failure, but the available evidence "
        "is not sufficient to determine the exact cause.\n"
        "• The target may be unreachable.\n"
        "• A TLS, DNS, connection, or application-level failure may be involved.\n"
        "• Additional checks and application logs are needed for a confident diagnosis.\n"
        "Typical recovery: depends on the underlying cause."
    )


async def explain_incident(
    status_code: int | None,
    error: str | None,
    recent_codes: list[int | None],
) -> str:
    """Generate an AI explanation from observed monitoring evidence."""

    if not settings.openrouter_api_key:
        return _rule_based(status_code, error)

    evidence = (
        f"Current HTTP status: {status_code}\n"
        f"Current error: {error or 'None'}\n"
        f"Recent HTTP status codes: {recent_codes}\n"
    )

    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.openrouter_model,
                    "messages": [
                        {
                            "role": "system",
                            "content": SYSTEM_PROMPT,
                        },
                        {
                            "role": "user",
                            "content": (
                                "Analyze this PulseWatch outage evidence:\n\n"
                                f"{evidence}"
                            ),
                        },
                    ],
                    "max_tokens": 350,
                },
            )

            if response.status_code == 200:
                try:
                    data = response.json()
                    content = data["choices"][0]["message"]["content"]

                    if isinstance(content, str) and content.strip():
                        return content.strip()

                    print("[ai] OpenRouter returned no usable content")

                except Exception as exc:
                    print(f"[ai] OpenRouter response parse failed: {exc}")

            else:
                print(
                    f"[ai] OpenRouter returned HTTP {response.status_code}: "
                    f"{response.text[:500]}"
                )

    except Exception as exc:
        print(f"[ai] OpenRouter request failed: {exc}")

    return _rule_based(status_code, error)
