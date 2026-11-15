/**
 * Framework-agnostic Host validation helper: the response shape it answers a
 * rejected Host with, including the JSON-RPC code it carries.
 */
import { describe, expect, it } from 'vitest';

import { hostHeaderValidationResponse, localhostAllowedHostnames, validateHostHeader } from '../../src/server/middleware/hostHeaderValidation';

describe('validateHostHeader', () => {
    it('allows hostnames on the allowlist, port-agnostic', () => {
        expect(validateHostHeader('localhost:3000', ['localhost']).ok).toBe(true);
        expect(validateHostHeader('127.0.0.1', localhostAllowedHostnames()).ok).toBe(true);
        expect(validateHostHeader('[::1]:8080', localhostAllowedHostnames()).ok).toBe(true);
    });

    it('rejects a missing or foreign Host', () => {
        expect(validateHostHeader(undefined, ['localhost']).ok).toBe(false);
        expect(validateHostHeader('evil.example.com', localhostAllowedHostnames()).ok).toBe(false);
    });
});

describe('hostHeaderValidationResponse', () => {
    it('returns a 403 JSON-RPC error response for a disallowed host', async () => {
        const request = new Request('http://localhost/mcp', { headers: { host: 'evil.example.com' } });
        const response = hostHeaderValidationResponse(request, localhostAllowedHostnames());
        expect(response).toBeDefined();
        expect(response!.status).toBe(403);
        const body = (await response!.json()) as {
            jsonrpc: string;
            error: { code: number; message: string };
            id: unknown;
        };
        expect(body.jsonrpc).toBe('2.0');
        // Host validation runs before any era is chosen, so the rejection uses a standard code
        // instead of the legacy -32000 range 2026-07-28 deprecates.
        expect(body.error.code).toBe(-32_600);
        expect(body.error.message).toContain('Invalid Host');
        expect(body.id).toBeNull();
    });

    it('returns undefined when the host is allowed', () => {
        const request = new Request('http://localhost/mcp', { headers: { host: 'localhost:3000' } });
        expect(hostHeaderValidationResponse(request, localhostAllowedHostnames())).toBeUndefined();
    });
});
