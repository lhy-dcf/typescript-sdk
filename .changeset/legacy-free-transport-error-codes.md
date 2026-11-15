'@modelcontextprotocol/server': patch
---

Transport-level rejections that are not tied to a handshake revision now answer JSON-RPC `-32600` (Invalid Request) instead of `-32000`, which the `2026-07-28` revision marks legacy. This covers a non-POST request on a modern-only endpoint or on the stateless legacy fallback (still `405` with `Allow: POST`), and the `403` bodies from the Host and Origin validation helpers. The handshake-era `WebStandardStreamableHTTPServerTransport` keeps `-32000` for its own `400`/`403`/`406`/`409`/`413`/`415` responses, since a 2025-era client may depend on it.
