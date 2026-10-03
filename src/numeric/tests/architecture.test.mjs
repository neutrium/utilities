import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const project = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(import.meta.url);

test('native adapter identities are shared across public entry points', async () => {
	const numeric = await import('@neutrium/utilities/numeric');
	const { numberAdapter } = await import('@neutrium/utilities/number');
	const { floatAdapter } = await import('@neutrium/utilities/float');
	assert.equal(numeric.numberAdapter, numberAdapter);
	assert.equal(numeric.doubleAdapter, numberAdapter);
	assert.equal(numeric.floatAdapter, floatAdapter);
	assert.notEqual(numberAdapter.identity, floatAdapter.identity);
});

function reachable(entry)
{
	const seen = new Set();

	function visit(file)
	{
		if (seen.has(file)) return;
		seen.add(file);
		const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
		for (const statement of source.statements)
		{
			if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier) continue;
			assert.ok(ts.isStringLiteral(statement.moduleSpecifier));
			const specifier = statement.moduleSpecifier.text;
			const target = specifier.startsWith('.') ? resolve(dirname(file), specifier) : createRequire(file).resolve(specifier);
			visit(target);
		}
	}
	visit(entry);
	return [...seen];
}

for (const tier of ['core', 'arithmetic', 'scientific'])
{
	test(`decimal/${tier}: dependency graph respects tier boundaries`, () => {
		const graph = reachable(join(project, `dist/decimal/Decimal${tier[0].toUpperCase() + tier.slice(1)}Adapter.js`));

		for (const path of graph)
		{
			if (tier === 'core') assert.doesNotMatch(path, /(?:ArithmeticDecimal|ScientificDecimal|DecimalArithmeticAdapter|DecimalScientificAdapter|\/arithmetic[/.]|\/scientific[/.])/);
			if (tier === 'arithmetic') assert.doesNotMatch(path, /(?:ScientificDecimal|DecimalScientificAdapter|\/scientific[/.])/);
		}
	});
}

for (const backend of ['number', 'float'])
{
	test(`${backend}: complete adapter has no Decimal or other native-backend dependency`, () => {
		const graph = reachable(join(project, `dist/numeric/${backend}.js`));
		assert.equal(graph.some(path => path.includes('/decimal/')), false);
		const other = backend === 'number' ? 'float' : 'number';
		assert.equal(graph.some(path => path.endsWith(`/numeric/${other}.js`)), false);
	});
}

test('obsolete native tier paths and artifacts are removed', () => {
	// Use Node's resolver here: Vite reports its own error for missing exports.
	const checked = spawnSync(process.execPath, ['--input-type=module', '-e', `
		import assert from 'node:assert/strict';
		for (const backend of ['number', 'float']) {
			for (const suffix of ['', '/core', '/arithmetic', '/scientific']) {
				await assert.rejects(import('@neutrium/utilities/numeric/' + backend + suffix), {
					code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
				});
			}
		}
	`], { cwd: project, encoding: 'utf8' });
	assert.equal(checked.status, 0, checked.stdout + checked.stderr);
	for (const backend of ['binary', 'number', 'float']) {
		assert.equal(existsSync(join(project, `dist/numeric/${backend}`)), false);
	}
});

test('root, framework and native backends work without the optional Decimal peer, including declarations', () => {
	const directory = mkdtempSync(join(tmpdir(), 'neutrium-numeric-'));
	try
	{
		const target = join(directory, 'node_modules/@neutrium/utilities');
		mkdirSync(target, { recursive: true });
		cpSync(join(project, 'dist'), join(target, 'dist'), { recursive: true });
		cpSync(join(project, 'package.json'), join(target, 'package.json'));
		writeFileSync(join(directory, 'package.json'), '{"type":"module"}');
		writeFileSync(join(directory, 'consumer.mjs'), `
			import { LruCache } from '@neutrium/utilities';
			import { numberAdapter } from '@neutrium/utilities/number';
			import { floatAdapter } from '@neutrium/utilities/float';
			if (new LruCache(2).size !== 0 || numberAdapter.add(1, 2) !== 3 || floatAdapter.from(16777217) !== 16777216) throw Error('invalid result');
		`);
		const executed = spawnSync(process.execPath, [join(directory, 'consumer.mjs')], { encoding: 'utf8' });
		assert.equal(executed.status, 0, executed.stderr);
		writeFileSync(join(directory, 'consumer.ts'), `
			import type { NumericAdapter, ArithmeticAdapter } from '@neutrium/utilities';
			import type { ScientificAdapter } from '@neutrium/utilities/numeric';
			import { numberAdapter } from '@neutrium/utilities/number';
			import { floatAdapter } from '@neutrium/utilities/float';
			const adapter: NumericAdapter<number> & ArithmeticAdapter<number> & ScientificAdapter<number> = numberAdapter;
			const result: number = floatAdapter.add(adapter.from('1'), 2);
		`);
		const checked = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--ignoreConfig', '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', join(directory, 'consumer.ts')], { encoding: 'utf8' });
		assert.equal(checked.status, 0, checked.stdout + checked.stderr);
	}
	finally
	{
		rmSync(directory, { recursive: true, force: true });
	}
});
