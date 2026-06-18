const fs = require('fs');
const s = fs.readFileSync('src/components/graphflow-app.tsx', 'utf8');
const lines = s.split('\n');
const start = lines.findIndex(l => l.includes('function SettingsView'));
if (start !== -1) {
  for (let i = start; i < start + 100 && i < lines.length; i++) {
    console.log(`${i+1}: ${lines[i]}`);
  }
}
