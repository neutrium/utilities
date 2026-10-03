import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const directory = mkdtempSync(join(tmpdir(), 'utilities-package-'));

function run(command, args, cwd = directory)
{
	try
	{
		return execFileSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
	}
	catch (error)
	{
		throw new Error(`${command} failed\n${error.stdout ?? ''}${error.stderr ?? ''}`, { cause: error });
	}
}

try
{
	// verify/prepublishOnly call this check after building. Do not recurse through hooks.
	const [packed] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json',
		'--cache', join(directory, 'npm-cache'), '--pack-destination', directory], project));
	const files = packed.files.map(file => file.path);
	for (const required of ['LICENCE', 'README.md', 'package.json']) assert.ok(files.includes(required), required);
	assert.ok(files.every(file => !/(^|\/)(tests|node_modules|\.pnpm-store|\.github|docs)(\/|$)/.test(file)),
		'Package must exclude tests, development dependencies and generated documentation');

	const consumer = join(directory, 'consumer');
	const target = join(consumer, 'node_modules/@neutrium/utilities');
	mkdirSync(target, { recursive: true });
	run('tar', ['-xzf', join(directory, packed.filename), '-C', target, '--strip-components=1']);
	writeFileSync(join(consumer, 'package.json'), '{"private":true,"type":"module"}');
	const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'));
	assert.equal(pkg.type, 'module');
	assert.equal(pkg.license, 'MIT');
	assert.equal(typeof pkg.author, 'string');
	const entries = Object.keys(pkg.exports).map(path => pkg.name + (path === '.' ? '' : path.slice(1)));

	for (const entry of Object.values(pkg.exports))
	{
		for (const path of [entry.import.types, entry.import.default])
		{
			assert.equal(typeof path, 'string');
			assert.ok(existsSync(join(target, path)), `Missing export target: ${path}`);
		}
	}

	for (const withDecimal of [false, true])
	{
		if (withDecimal)
		{
			cpSync(realpathSync(join(project, 'node_modules/@neutrium/decimal')),
				join(consumer, 'node_modules/@neutrium/decimal'), { recursive: true });
		}

		const selected = entries.filter(path => withDecimal || !path.includes('/decimal'));
		writeFileSync(join(consumer, 'consumer.mjs'), `
			import assert from 'node:assert/strict';
			import { createRequire } from 'node:module';
			const require = createRequire(import.meta.url);
			for (const entry of ${JSON.stringify(selected)}) {
				await import(entry);
				assert.throws(() => require(entry), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
			}
		`);
		run(process.execPath, ['consumer.mjs'], consumer);
		const integration = readFileSync(join(project, 'tools/fixtures/consumer.ts'), 'utf8');
		const decimalIntegration = withDecimal ? `
			import { createDecimalAdapter } from '@neutrium/utilities/decimal';
			const decimal = createDecimalAdapter({ precision: 40 });
			check(decimal.toString(mean(decimal, decimal.from('0.1'), decimal.from('0.2'))) === '0.15');
		` : '';
		writeFileSync(join(consumer, 'consumer.ts'), selected.map((entry, index) =>
			`import * as entry${index} from ${JSON.stringify(entry)};`).join('\n') + '\n' + integration + decimalIntegration);

		for (const resolution of ['Node16', 'NodeNext', 'Bundler'])
		{
			run(process.execPath, [require.resolve('typescript/bin/tsc'), '--ignoreConfig', '--noEmit',
				'--strict', '--exactOptionalPropertyTypes', '--noUncheckedIndexedAccess', '--verbatimModuleSyntax',
				'--target', 'ES2022', '--module', resolution === 'Bundler' ? 'ESNext' : resolution,
				'--moduleResolution', resolution, 'consumer.ts'], consumer);
		}
		run(process.execPath, [require.resolve('typescript/bin/tsc'), '--ignoreConfig', '--strict',
			'--target', 'ES2022', '--module', 'NodeNext', '--outDir', 'built', 'consumer.ts'], consumer);
		run(process.execPath, ['built/consumer.js'], consumer);
		console.log(`Package checks passed: ${selected.length} entry points ${withDecimal ? 'with' : 'without'} Decimal; runtime integration and Node16/NodeNext/Bundler declarations.`);
	}
}
finally
{
	rmSync(directory, { recursive: true, force: true });
}
