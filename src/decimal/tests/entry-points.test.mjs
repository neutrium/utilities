import assert from 'node:assert/strict';
import { test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('top-level Decimal entry points replace nested paths', () => {
    const project = fileURLToPath(new URL('../../../', import.meta.url));
    const checked = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        for (const suffix of ['', '/core', '/arithmetic', '/scientific']) {
            const adapter = await import('@neutrium/utilities/decimal' + suffix);
            assert.equal(adapter.DecimalAdapter.toString(adapter.DecimalAdapter.from('1.25')), '1.25');
            await assert.rejects(import('@neutrium/utilities/numeric/decimal' + suffix), {
                code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
            });
        }
        const main = await import('@neutrium/utilities/decimal');
        const scientific = await import('@neutrium/utilities/decimal/scientific');
        assert.equal(main.DecimalAdapter, scientific.DecimalAdapter);
    `], { cwd: project, encoding: 'utf8' });
    assert.equal(checked.status, 0, checked.stdout + checked.stderr);
    assert.equal(existsSync(new URL('../../../dist/numeric/decimal', import.meta.url)), false);
});
