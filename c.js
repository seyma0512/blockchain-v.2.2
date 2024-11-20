const fs = require('fs');
const crypto = require('crypto');

const generateSecret = () => {
    return crypto.randomBytes(64).toString('hex'); // Genera un secreto aleatorio
};

// Generar el secreto y guardarlo en .env
const secret = generateSecret();
const envContent = `SESSION_SECRET=${secret}\n`;

// Escribir el secreto en .env
fs.writeFileSync('.env', envContent, { flag: 'a' }); // Usa 'a' para añadir al final del archivo
console.log('Secreto generado y guardado en .env');
