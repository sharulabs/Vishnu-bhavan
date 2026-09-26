if (!process.argv.includes('--production')) {
  process.argv.push('--production');
}

import('./server/index.js').catch((error) => {
  console.error('Failed to start Vishnu Bhavan server:', error);
  process.exit(1);
});