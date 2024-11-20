const crypto = require('crypto');

// Generar hash del bloque
function generateHash() {
    return crypto.createHash('sha256').update(Date.now().toString()).digest('hex');
}

module.exports = { generateHash};
