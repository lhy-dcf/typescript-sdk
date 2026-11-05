import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { StdioClientTransport } from '../../src/client/stdio.js';

type FakeChild = EventEmitter & {
    stdin: PassThrough;
    stdout: PassThrough;
    stderr: PassThrough;
    pid: number;
    exitCode: number | null;
    signalCode: string | null;
    kill: (signal?: string) => boolean;
};

const state = vi.hoisted(() => ({ spawned: [] as unknown[] }));

vi.mock('cross-spawn', () => ({
    default: () => {
        const child = new EventEmitter() as FakeChild;
        child.stdin = new PassThrough();
        child.stdout = new PassThrough();
        child.stderr = new PassThrough();
        child.pid = 4242;
        child.exitCode = null;
        child.signalCode = null;
        child.kill = () => {
            child.exitCode = 0;
            child.emit('close', 0);
            return true;
        };
        child.stdin.on('finish', () => {
            if (child.exitCode === null) {
                child.exitCode = 0;
                child.emit('close', 0);
            }
        });
        state.spawned.push(child);
        setTimeout(() => child.emit('spawn'), 0);
        return child;
    }
}));

function lastChild(): FakeChild {
    return state.spawned[state.spawned.length - 1] as FakeChild;
}

/**
 * `pipe()` on stderr adds a `data` listener to the source, so the parent keeps
 * a handle on all three pipes after `start()`.
 */
describe('StdioClientTransport listener cleanup', () => {
    it('removes the pipe listeners it attached when the transport closes', async () => {
        const transport = new StdioClientTransport({ command: 'fake', stderr: 'pipe' });
        await transport.start();

        const child = lastChild();
        expect(child.stdout.listenerCount('data')).toBeGreaterThan(0);
        expect(child.stderr.listenerCount('data')).toBeGreaterThan(0);
        expect(child.stdin.listenerCount('error')).toBeGreaterThan(0);

        await transport.close();

        expect(child.stdout.listenerCount('data')).toBe(0);
        expect(child.stdout.listenerCount('error')).toBe(0);
        expect(child.stdin.listenerCount('error')).toBe(0);
        expect(child.stderr.listenerCount('data')).toBe(0);
    });

    it('does not accumulate listeners across reconnects', async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
            const transport = new StdioClientTransport({ command: 'fake' });
            await transport.start();
            await transport.close();
        }

        for (const child of state.spawned as FakeChild[]) {
            expect(child.stdout.listenerCount('data')).toBe(0);
            expect(child.stderr.listenerCount('data')).toBe(0);
        }
    });
});
