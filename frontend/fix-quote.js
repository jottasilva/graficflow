const fs = require('fs');
let s = fs.readFileSync('src/components/graphflow-app.tsx', 'utf8');

const target = `function QuoteDetail({
  quote,
  clients,
  finance,
}: {
  quote: Quote;
  clients: Client[];
  finance: FinanceEntry[];
}) {`;

const replacement = `function QuoteDetail({
  quote,
  clients,
  finance,
  onConvert,
}: {
  quote: Quote;
  clients: Client[];
  finance: FinanceEntry[];
  onConvert?: () => void;
}) {`;

const targetWindows = target.replace(/\n/g, '\r\n');
const replacementWindows = replacement.replace(/\n/g, '\r\n');

if (s.includes(target)) {
  s = s.replace(target, replacement);
  fs.writeFileSync('src/components/graphflow-app.tsx', s, 'utf8');
  console.log('Replaced unix style');
} else if (s.includes(targetWindows)) {
  s = s.replace(targetWindows, replacementWindows);
  fs.writeFileSync('src/components/graphflow-app.tsx', s, 'utf8');
  console.log('Replaced windows style');
} else {
  console.log('Target not found!');
}
