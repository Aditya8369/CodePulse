import * as path from 'path';

async function main(): Promise<void> {
  // @vscode/test-electron entrypoint for headless VS Code integration execution
  const { runTests } = await import('@vscode/test-electron');
  const extensionDevelopmentPath = path.resolve(__dirname, '../../');
  const extensionTestsPath = path.resolve(__dirname, './extension.test.js');
  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Failed to run @vscode/test-electron tests:', err);
    process.exit(1);
  });
}
