const { spawn } = require('child_process');

console.log('Initiating git push origin main...');

const child = spawn('git', ['push', 'origin', 'main'], {
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  stdio: 'pipe'
});

child.stdout.on('data', data => {
  process.stdout.write(data.toString());
});

child.stderr.on('data', data => {
  process.stderr.write(data.toString());
});

child.on('close', code => {
  console.log(`\nGit push process exited with code ${code}`);
  process.exit(code);
});
