const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Función para generar una clave de encriptación
function generateRandomKey(length) {
    return crypto.randomBytes(length).toString('hex'); // Genera una clave en formato hexadecimal
}

// Generar valores aleatorios
const encryptionKey = generateRandomKey(32); // 32 bytes para AES-256
const iv = generateRandomKey(16); // 16 bytes para el IV de AES
const sessionSecret = generateRandomKey(16); // Puedes ajustar el tamaño según sea necesario

// Define el contenido para k.env
const envContent = `
ENCRYPTION_KEY=${encryptionKey}
IV=${iv}
SESSION_SECRET=${sessionSecret}
`.trim(); // .trim() para eliminar espacios en blanco al inicio y al final

// Define la ruta del archivo k.env
const envFilePath = path.join(__dirname, '.env');

// Escribe el contenido en el archivo k.env
fs.writeFile(envFilePath, envContent, (err) => {
    if (err) {
        console.error('Error al crear el archivo .env:', err);
    } else {
        console.log('.env creado con éxito en', envFilePath);
    }
});
