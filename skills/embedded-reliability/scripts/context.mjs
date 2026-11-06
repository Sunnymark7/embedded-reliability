import { inspectProject, parseArgs, printError } from './lib/project.mjs';

try {
  const args = parseArgs(process.argv.slice(2), { values: ['root', 'target'] });
  if (args.positionals.length) throw new Error('Usage: context.mjs [--root directory] [--target path]');
  process.stdout.write(`${JSON.stringify(inspectProject(args.root, args.target), null, 2)}\n`);
} catch (error) { printError(error); }
