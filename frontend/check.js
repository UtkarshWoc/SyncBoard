const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('./node_modules/react/package.json'));
console.log('React:', pkg.version);
const rr = JSON.parse(fs.readFileSync('./node_modules/react-router-dom/package.json'));
console.log('Router:', rr.version);
