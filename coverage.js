const fs = require('fs');

const summary = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf-8'));
const pct = summary.total?.lines?.pct || 0;
const formatted = pct.toFixed(2);
console.log(formatted + '%');
