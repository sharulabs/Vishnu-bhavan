if (!process.argv.includes('--production')) {
  process.argv.push('--production');
}

await import('./server/index.js');