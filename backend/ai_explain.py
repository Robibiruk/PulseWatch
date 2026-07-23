"""AI Incident Explanation — the feature that makes PulseWatch feel modern.

Uses OpenRouter so you can plug in any model (deepseek-r1:free is free).
If no key is configured, returns a concise rule-based explanation instead,
so the product degrades gracefully without credentials.
"""
import httpx

from config import settings

SYSTEM_PROMPT = (
    "You are an SRE assistant. Given a website outage signal, explain the likely "
    "cause in 3-5 short bullet points and state a typical recovery time. Be concise "
    "and practical. Do not speculate beyond the evidence given."
)


def _rule_based(status_code: int | None, error: str | None) -> str:
    if status_code == 502:
        return ("Likely a bad gateway. Usually means a reverse proxy (Nginx/Cloudflare) "
                "couldn't reach your backend.\n• Backend process crashed or not listening\n"
                "• Backend overloaded / connection pool exhausted\n"
                "• Upstream service (DB, cache) unavailable\nTypical recovery: 1-5 min after restart.")
    if status_code == 503:
        return ("Service unavailable. Server is up but refusing to serve.\n"
                "• Maintenance mode enabled\n• Dependency (DB/cache) down\n"
                "• Auto-scaling cold start\nTypical recovery: minutes once dependency returns.")
    if status_code == 500:
        return ("Internal server error. Application threw an unhandled exception.\n"
                "• Recent deploy introduced a bug\n• Uncaught exception / null reference\n"
                "• Misconfigured env vars\nTypical recovery: 2-10 min after rollback/fix.")
    if status_code == 504:
        return ("Gateway timeout. Backend too slow to respond.\n"
                "• Database query slow / locked\n• Third-party API latency\n"
                "• Insufficient compute\nTypical recovery: minutes once load drops.")
    if error and "Timeout" in error:
        return ("Request timed out (no response within 10s).\n"
                "• Server hung / deadlock\n• Network partition\n"
                "• Resource exhaustion\nTypical recovery: minutes after restart.")
    if error and ("NameResolution" in error or "ConnectError" in error):
        return ("Could not connect to host.\n• DNS misconfiguration / propagation\n"
                "• Server/instance stopped\n• Firewall blocking\n"
                "Typical recovery: until DNS/host restored.")
    return ("Monitor detected a failure but no HTTP status was returned.\n"
            "• Host unreachable\n• TLS/certificate error\n• Connection refused\n"
            "Typical recovery: depends on cause.")


async def explain_incident(status_code: int | None, error: str | None, recent_codes: list[int | None]) -> str:
    if settings.openrouter_api_key:
        try:
            evidence = f"status_code={status_code}, error={error}, recent_codes={recent_codes}"
            async with httpx.AsyncClient(timeout=25) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openrouter_api_key}",
                             "Content-Type": "application/json"},
                    json={
                        "model": settings.openrouter_model,
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": f"Outage signal: {evidence}"},
                        ],
                        "max_tokens": 300,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data["choices"][0]["message"]["content"].strip()
        except Exception as e:  # noqa: BLE001
            print(f"[ai] OpenRouter failed, falling back: {e}")

    return _rule_based(status_code, error)
