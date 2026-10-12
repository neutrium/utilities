import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const project = fileURLToPath(new URL('../../../', import.meta.url));

test('native adapter class is shared across public entry points', async () => {
	const numeric = await import('@neutrium/utilities/numeric');
	const { NumberAdapter } = await import('@neutrium/utilities/number');
	assert.equal(numeric.NumberAdapter, NumberAdapter);
	assert.equal('floatAdapter' in numeric, false);
	assert.equal('doubleAdapter' in numeric, false);
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

for (const tier of ['core', 'arithmetic'])
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

test('Number has no Decimal dependency', () => {
	const graph = reachable(join(project, 'dist/numeric/NumberAdapter.js'));
	assert.equal(graph.some(path => path.includes('/decimal/')), false);
});

test('obsolete native tier paths and artifacts are removed', () => {
	// Use Node's resolver here: Vite reports its own error for missing exports.
	const checked = spawnSync(process.execPath, ['--input-type=module', '-e', `
		import assert from 'node:assert/strict';
		await assert.rejects(import('@neutrium/utilities/float'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
		for (const backend of ['number', 'float']) {
			for (const suffix of ['', '/core', '/arithmetic', '/scientific']) {
				await assert.rejects(import('@neutrium/utilities/numeric/' + backend + suffix), {
					code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
				});
			}
		}
	`], { cwd: project, encoding: 'utf8' });
	assert.equal(checked.status, 0, checked.stdout + checked.stderr);
	for (const file of ['float.js', 'float.d.ts', 'adapters/createBinaryAdapter.js', 'adapters/createBinaryAdapter.d.ts'])
		assert.equal(existsSync(join(project, 'dist/numeric', file)), false);
	for (const backend of ['binary', 'number', 'float']) {
		assert.equal(existsSync(join(project, `dist/numeric/${backend}`)), false);
	}
});

// Optional-peer runtime and declaration isolation is covered by tools/test-package.mjs.
test('rational helpers and capability detection have no Decimal dependency', () => {
	const graph = reachable(join(project, 'dist/numeric/rational.js'));
	assert.equal(graph.some(path => path.includes('/decimal/')), false);
});
