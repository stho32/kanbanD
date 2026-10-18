// Vor jedem E2E-Lauf das Programm bauen, damit nie gegen eine veraltete Oberfläche getestet wird.
const { execFileSync } = require('child_process');
const path = require('path');
module.exports = () => execFileSync('cargo', ['build', '-q'], { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
