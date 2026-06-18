const fs = require('fs');
const s = fs.readFileSync('src/components/graphflow-app.tsx', 'utf8');
const lines = s.split('\n');
lines.forEach((l, i) => {
  if (l.includes('tab-button') || l.includes('tabs')) {
    console.log(`${i+1}: ${l.trim()}`);
  }
});
