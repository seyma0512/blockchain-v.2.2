// Importar dependencias
const path = require('path');
require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const { connectDB, getDB } = require('./db');
const { loginUser } = require('./authController');
const multer = require('multer');
const cors = require('cors');
const { ObjectId } = require('mongodb');
const { google } = require('googleapis');
const credentials = require('../service_account.json');
const stream = require('stream'); // Importar stream para bufferToStream

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true, limit: '25mb' }));
app.use(bodyParser.json({ limit: '25mb' }));
app.use(express.static('frontend'));
app.use('/database', express.static('database'));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 3600000,
        httpOnly: true,
        secure: false,
    }
}));

// Configuración de multer para almacenar archivos en memoria
const upload = multer({ storage: multer.memoryStorage() });

// Autenticación con Google Drive
const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
});
const drive = google.drive({ version: 'v3', auth });

// Función para convertir un buffer en un flujo legible
function bufferToStream(buffer) {
    const readableStream = new stream.Readable();
    readableStream._read = () => {}; // No hacer nada
    readableStream.push(buffer);
    readableStream.push(null); // Indica que no hay más datos
    return readableStream;
}

// Función para crear una subcarpeta en Google Drive
async function createSubfolder(folderName, parentFolderId) {
    const response = await drive.files.create({
        requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId],
        },
    });
    return response.data.id;
}

// Función para subir archivos a Google Drive
async function uploadFileToDrive(fileBuffer, fileName, mimeType, folderId) {
    const fileStream = bufferToStream(fileBuffer); // Convertir el buffer en un flujo

    const response = await drive.files.create({
        requestBody: {
            name: fileName,
            mimeType: mimeType,
            parents: [folderId],
        },
        media: {
            mimeType: mimeType,
            body: fileStream, // Usar el flujo en lugar del buffer
        },
    });
    await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
            role: 'reader',
            type: 'anyone'
        },
    });
    return `https://drive.google.com/uc?id=${response.data.id}`;
}

// Conectar a la base de datos
connectDB();

// Rutas
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await loginUser(username, password);

    if (user) {
        req.session.userId = user._id;
        req.session.cookieId = user.cookieID;
        res.redirect('/views/upload.html');
    } else {
        res.status(401).send('Usuario o contraseña incorrectos');
    }
});

// Ruta para obtener la firma digital del usuario
app.get('/digital-signature', async (req, res) => {
    const db = getDB();
    const userId = req.session.userId;
    if (!userId) return res.status(403).send('No autorizado');

    const user = await db.collection('users').findOne({ _id: userId });
    if (user) {
        res.json({ signature: user.digital_signatureID });
    } else {
        res.status(404).send('Usuario no encontrado');
    }
});

// Ruta para subir archivos (varios) a Google Drive
app.post('/upload', upload.array('file'), async (req, res) => {
    const db = getDB();
    const { name, description, location, incidentType, chain } = req.body;

    if (req.files.length === 0) return res.status(400).send('No se recibió ningún archivo');

    // Verificar la sesión del usuario
    const userId = req.session.userId;
    if (!userId) return res.status(403).send('No autorizado');

    const user = await db.collection('users').findOne({ _id: userId });
    if (!user) return res.status(404).send('Usuario no encontrado');

    const digitalSignature = user.digital_signatureID;
    const previousHash = await getPreviousHash(chain);
    const timestamp = new Date().toISOString();
    const count = await db.collection(chain).countDocuments();
    const height = count === 0 ? 1 : count + 1;

    const googleDriveFolders = {
        block_pdf: '1dVqtu_HK7GMr4sDeQFan6tNfdz4HFkDJ',
        block_pdf_audio: '11rIm0wPN95-wLDJMFRjlGbe75ibP8OQO',
        block_pdf_audio_video: '1yg2QaikYggqXbGSs_EjCT2jBGHJev77s',
        block_pdf_video: '1baotaYaMSW0pKHSp6jPb2QBsVRhDqnW_',
    };
    const parentFolderId = googleDriveFolders[chain];
    if (!parentFolderId) return res.status(400).send('Cadena no válida');

    // Crear una subcarpeta dentro de la carpeta principal de Google Drive
    const subfolderName = `${name}_${Date.now()}`;
    const subfolderId = await createSubfolder(subfolderName, parentFolderId);

    // Procesar y encriptar archivos para Google Drive
    const filesData = [];
    for (const file of req.files) {
        const uniqueId = Math.floor(Math.random() * 1e15).toString();
        const encryptedFileBuffer = encryptFile(file.buffer, uniqueId);

        // Subimos el archivo encriptado a Google Drive en la subcarpeta
        const driveFileUrl = await uploadFileToDrive(
            encryptedFileBuffer,
            `${uniqueId}.${file.mimetype.split('/')[1]}`,
            file.mimetype,
            subfolderId
        );

        filesData.push({
            fileName: `${uniqueId}.${file.mimetype.split('/')[1]}`,
            filePath: driveFileUrl,  // URL de Google Drive
            fileType: file.mimetype,
        });
    }

    const blockData = {
        _id: count === 0 ? 1 : count + 1,
        name,
        description,
        location,
        incidentType,
        chain,
        digitalSignature,
        height,
        timestamp,
        previousHash,
        folderPath: `https://drive.google.com/drive/folders/${subfolderId}`,  // URL de la subcarpeta generada
        data: filesData,
        hash: generateHash({
            name,
            description,
            location,
            incidentType,
            chain,
            digitalSignature,
            height,
            timestamp,
            previousHash,
            data: filesData,
        }),
    };

    // Guardamos el bloque en la base de datos
    await db.collection(chain).insertOne(blockData);
    res.json({ message: 'Bloque subido con éxito' });
});

// Función para encriptar el archivo
function encryptFile(buffer, uniqueId) {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    const iv = Buffer.from(process.env.IV, 'hex');

    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return encrypted;
}

// Función para obtener el previousHash
async function getPreviousHash(chain) {
    const db = getDB();
    const lastBlock = await db.collection(chain).find().sort({ height: -1 }).limit(1).toArray();
    return lastBlock.length > 0 ? lastBlock[0].hash : '0512001705';
}

// Generar hash para el bloque
function generateHash(blockData) {
    const blockString = JSON.stringify(blockData);
    const hash = crypto.createHash('sha256');
    hash.update(blockString);
    return hash.digest('hex');
}

// Ruta para ver y desencriptar el archivo desde Google Drive
app.get('/view-file/:chain/:name-:fileName', async (req, res) => {
    const { chain, fileName } = req.params;
    const db = getDB();

    // Buscamos el bloque por el fileName en el array de data
    const block = await db.collection(chain).findOne({ "data.fileName": fileName });
    if (!block) {
        return res.status(404).send('Bloque no encontrado');
    }

    // Buscamos el archivo en el bloque
    const fileData = block.data.find(file => file.fileName === fileName);
    if (!fileData) {
        return res.status(404).send('Archivo no encontrado en el bloque');
    }

    const driveFileUrl = fileData.filePath;

    // Obtenemos el ID del archivo de Google Drive desde la URL
    const fileId = new URL(driveFileUrl).searchParams.get('id');
    if (!fileId) {
        return res.status(400).send('No se pudo obtener el ID del archivo de Google Drive');
    }

    try {
        // Descargamos el archivo encriptado desde Google Drive
        const response = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'arraybuffer' }
        );

        const encryptedBuffer = Buffer.from(response.data);

        // Configuramos el tipo de contenido dependiendo del tipo de archivo
        let contentType = '';
        if (fileData.fileType === 'application/pdf') {
            contentType = 'application/pdf';
        } else if (fileData.fileType === 'audio/mpeg') {
            contentType = 'audio/mpeg';
        } else if (fileData.fileType === 'video/mp4') {
            contentType = 'video/mp4';
        } else {
            return res.status(400).send('Tipo de archivo no soportado');
        }

        // Establecemos los encabezados para servir el archivo
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${fileName.replace('.enc', '')}"`);

        // Desencriptamos y servimos el archivo
        const decipher = crypto.createDecipheriv(
            'aes-256-cbc',
            Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
            Buffer.from(process.env.IV, 'hex')
        );

        // Convertimos el buffer desencriptado a un flujo y lo enviamos como respuesta
        const decryptedBuffer = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
        res.send(decryptedBuffer);
    } catch (error) {
        console.error('Error al descargar o desencriptar el archivo:', error);
        res.status(500).send('Error al procesar el archivo');
    }
});

// Ruta para obtener los bloques de una cadena específica
app.get('/blocks/:chain', async (req, res) => {
    const db = getDB();
    const { chain } = req.params;

    try {
        const blocks = await db.collection(chain).find().toArray();
        res.json(blocks);
    } catch (error) {
        console.error('Error al obtener los bloques:', error);
        res.status(500).send('Error al obtener los bloques');
    }
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}/views/login.html`);
    console.log(`Servidor escuchando en http://localhost:${PORT}/views/view.html`);
});
