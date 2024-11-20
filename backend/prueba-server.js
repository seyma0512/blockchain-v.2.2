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

// Configuración de multer para almacenamiento de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const chain = req.body.chain;
        const date = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima', hour12: false }).replace(/:/g, '-').replace(/\//g, '-');
        const dir = path.join(__dirname, 'database', chain, `${date}`);

        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueId = Math.floor(Math.random() * 1e15).toString();
        cb(null, `${uniqueId}.${file.mimetype.split('/')[1]}`);
    }
});

const upload = multer({ storage });

// Función para encriptar archivos
function encryptFile(filePath) {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    const iv = Buffer.from(process.env.IV, 'hex');

    if (!encryptionKey || !iv) {
        throw new Error("La clave de encriptación o el IV no están definidos.");
    }

    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
    const input = fs.createReadStream(filePath);
    const output = fs.createWriteStream(`${filePath}.enc`);

    input.pipe(cipher).pipe(output);

    output.on('finish', () => {
        fs.unlinkSync(filePath);
    });

    return `${filePath}.enc`;
}

// Función para desencriptar archivos
function decryptFile(filePath) {
    const decryptionKey = process.env.ENCRYPTION_KEY;
    const iv = Buffer.from(process.env.IV, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(decryptionKey, 'hex'), iv);
    const outputFilePath = filePath.replace('.enc', '');
    const input = fs.createReadStream(filePath);
    const output = fs.createWriteStream(outputFilePath);

    input.pipe(decipher).pipe(output);

    output.on('finish', () => {
        console.log(`Desencriptación completada: ${outputFilePath}`);
    });

    return outputFilePath;
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

// Ruta para subir archivos (varios)
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

    // Procesar los archivos (encriptar cada uno)
    const filesData = req.files.map(file => {
        const originalFileName = path.basename(file.originalname);
        const encryptedFilePath = encryptFile(file.path);  // Encriptamos el archivo
        const fileName = path.basename(encryptedFilePath);
        const fileDir = path.dirname(encryptedFilePath);

        return {
            fileName, // Nombre del archivo encriptado
            filePath: path.join(fileDir, fileName),
            fileType: file.mimetype, // Tipo MIME del archivo
        };
    });

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
        data: filesData, // Datos de todos los archivos encriptados
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
            data: filesData, // Aquí van los archivos encriptados
        }),
    };

    // Guardamos el bloque con la información de los archivos encriptados en la base de datos
    await db.collection(chain).insertOne(blockData);
    res.json({ message: 'Bloque subido con éxito' });
});


// Ruta para obtener el hash y height actual
app.get('/current-height/:chain', async (req, res) => {
    const db = getDB();
    const { chain } = req.params;
    const count = await db.collection(chain).countDocuments();
    res.json({ height: count || 1 });
});

app.get('/previous-hash/:chain', async (req, res) => {
    const db = getDB();
    const { chain } = req.params;
    const lastBlock = await db.collection(chain).find().sort({ height: -1 }).limit(1).toArray();
    const previousHash = lastBlock.length > 0 ? lastBlock[0].hash : '0512001705';
    res.json({ previousHash });
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Algo salió mal!');
});

// Ruta para obtener todos los bloques de una cadena
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
    const encryptedFilePath = fileData.filePath;

    if (!fs.existsSync(encryptedFilePath)) {
        return res.status(404).send('El archivo encriptado no existe');
    }

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

    // Establecemos los encabezados apropiados para servir el archivo
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${fileData.fileName.replace('.enc', '')}"`);

    // Desencriptamos y servimos el archivo
    const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
        Buffer.from(process.env.IV, 'hex')
    );

    const input = fs.createReadStream(encryptedFilePath);
    input.pipe(decipher).pipe(res);
    
    input.on('end', () => {
        // Si no necesitas mantener el archivo desencriptado, puedes eliminarlo aquí si es necesario
    });
});


// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}/views/login.html`);
    console.log(`Servidor escuchando en http://localhost:${PORT}/views/view.html`);
});

// Función para generar el hash
function generateHash(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

// Función para obtener el previousHash
async function getPreviousHash(chain) {
    const db = getDB();
    const lastBlock = await db.collection(chain).find().sort({ height: -1 }).limit(1).toArray();
    return lastBlock.length > 0 ? lastBlock[0].hash : '0512001705';
}