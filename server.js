// Importar dependencias
const path = require('path');
require('dotenv').config(); // Asegúrate de cargar las variables del archivo .env
const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const { connectDB, getDB } = require('./backend/db-atlas');
const { loginUser } = require('./backend/authController');
const multer = require('multer');
const cors = require('cors');
const { google } = require('googleapis');
const FormData = require('form-data');
const fetch = require('node-fetch'); // Asegúrate de usar node-fetch para realizar la solicitud HTTP
const app = express();
const PORT = 3000;

// Servir archivos estáticos desde la carpeta 'frontend/modules' para que estén disponibles a través de '/modules'
app.use('/modules', express.static(path.join(__dirname, 'frontend', 'views', 'modules')));

// Servir archivos CSS y JS en sus respectivas rutas
app.use(express.static(path.join(__dirname, 'frontend', 'css')));
app.use(express.static(path.join(__dirname, 'frontend', 'js')));
app.use(express.static(path.join(__dirname, 'frontend', 'views'))); // Asegúrate de servir la carpeta 'views' correctamente
app.use(express.static(path.join(__dirname, 'frontend')));

// Ruta para login.html
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'views', 'login.html')); // Ajusta la ruta para que coincida con la ubicación real del archivo
});

// Redirigir '/' a 'index.html'
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.use(cors({
    origin: [
        'https://blockchain-v2-1.onrender.com',  // Origen del servidor 1
        'https://nodo-blockchain-v1-0.onrender.com'  // Origen del servidor 2
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(bodyParser.urlencoded({ extended: true, limit: '25mb' }));
app.use(bodyParser.json({ limit: '25mb' }));
app.use(express.static('frontend'));
app.use('/database', express.static('database'));

// Configuración de sesión
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

const credentials_google = {
    private_key: process.env.GOOGLE_SERVICE_KEY,
    client_email: process.env.GOOGLE_SERVICE_EMAIL,
    project_id: process.env.GOOGLE_SERVICE_ID,
};
  
// Autenticación con Google Drive
const auth = new google.auth.GoogleAuth({
    credentials: credentials_google,
    scopes: ['https://www.googleapis.com/auth/drive'],
});
const drive = google.drive({ version: 'v3', auth });

// Configuración de multer para almacenar archivos en memoria
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // Limitar tamaño de archivo a 25MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['video/mp4', 'audio/mp3', 'application/pdf', 'audio/mpeg'];
        console.log('Tipo MIME del archivo:', file.mimetype);  // Log del tipo MIME
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);  // El archivo es permitido
        } else {
            cb(new Error('Tipo de archivo no permitido'), false); // Error si el archivo no es permitido
        }
    }
});

// Conectar a la base de datos
connectDB();

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await loginUser(username, password);

    if (user) {
        try {
            // Obtener los privilegios del rol y el nombre del rol
            const { roleName, privilages } = await getRolePrivileges(user.roleID);

            // Almacenar roleName y privilages en la sesión
            req.session.roleName = roleName;
            req.session.privilages = privilages;

            // Imprimir en consola
            console.log(`Role Name: ${roleName}`);
            console.log(`Privileges: ${privilages}`);

            // Almacenar la información de la sesión
            req.session.userId = user._id;
            req.session.cookieId = user.cookieID;
            req.session.roleID = user.roleID;

            res.redirect('/views/center.html');  // Redirigir al centro de la aplicación
        } catch (error) {
            console.error('Error al obtener privilegios del rol:', error);
            res.status(500).send('Error al obtener privilegios del rol');
        }
    } else {
        res.status(401).send('Usuario o contraseña incorrectos');
    }
});

// Función para obtener los privilegios y el nombre del rol desde la colección 'roles'
const getRolePrivileges = async (roleID) => {
    const db = getDB();  // Obtener la conexión a la base de datos
    
    try {
        // Buscar el rol por su _id
        const role = await db.collection('roles').findOne({ _id: roleID });

        if (!role) {
            throw new Error('Rol no encontrado');
        }

        // Devolver tanto el nombre del rol como los privilegios
        return { roleName: role.roleName, privilages: role.privilages };
    } catch (error) {
        throw new Error('Error al obtener privilegios del rol');
    }
};

// Asegúrate de que esta ruta esté en tu servidor
app.get('/get-privileges', (req, res) => {
    if (req.session.privilages) {
        // Enviar los privilegios almacenados en la sesión
        res.json({ privilages: req.session.privilages });
    } else {
        res.status(404).json({ error: 'Privilegios no encontrados en la sesión' });
    }
});

// Ruta para obtener la firma digital del usuario
app.get('/digital-signature', async (req, res) => {
    const db = getDB();
    const userId = req.session.userId;

    // Verificar si hay sesión activa
    if (!userId) {
        // Si no hay sesión activa, enviamos un mensaje de error y no redirigimos aquí
        return res.status(401).json({ error: 'No session found, please log in.' });
    }

    const user = await db.collection('users').findOne({ _id: userId });
    if (user && user.digital_signatureID) {
        // Si el usuario tiene una firma digital
        res.json({ signature: user.digital_signatureID });
    } else {
        // Si no tiene firma digital, enviamos un mensaje de error
        return res.status(404).json({ error: 'No digital signature found.' });
    }
});
app.post('/logout', (req, res) => {
    // Mostrar los datos de la sesión antes de destruirla
    console.log('Datos de sesión antes de destruir:', req.session);

    // Primero, destruye la sesión
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('No se pudo cerrar la sesión');
        }

        // Verificar que la sesión ha sido destruida
        console.log('Sesión destruida');

        // Limpiar también las cookies asociadas si las hubiera
        res.clearCookie('connect.sid');  // Limpiar la cookie de sesión
        console.log('Cookie de sesión eliminada: connect.sid');

        // Redirigir a la página de login
        res.redirect('/views/login.html');  // Redirigir al login después de cerrar la sesión
    });
});

app.post('/upload', upload.array('file'), async (req, res) => {
    const db = getDB();
    const { name, description, location, incidentType, chain } = req.body;

    // Verificar si se recibieron archivos
    if (req.files.length === 0) return res.status(400).send('No se recibió ningún archivo');

    // Verificar la sesión del usuario
    const userId = req.session.userId;
    if (!userId) return res.status(403).send('No autorizado');

    const user = await db.collection('users').findOne({ _id: userId });
    if (!user) return res.status(404).send('Usuario no encontrado');

    // Obtener el digital_signatureID del usuario
    const digitalSignatureID = user.digital_signatureID;

    // Buscar la firma digital en la colección 'digital_signatures' usando el digital_signatureID
    const digitalSignatureDoc = await db.collection('digital_signatures').findOne({ _id: digitalSignatureID });

    // Verificar si se encontró la firma digital
    if (!digitalSignatureDoc) {
        return res.status(404).send('Firma digital no encontrada');
    }

    // Obtener la firma digital real
    const digitalSignature = digitalSignatureDoc.signature;

    // Preparar los datos del bloque para enviarlos
    const blockData = {
        name,
        description,
        location,
        incidentType,
        chain,
        digitalSignature,  // Usar la firma digital obtenida
        data: req.files.map(file => ({
            fileName: file.originalname,
            fileType: file.mimetype,
            fileBuffer: file.buffer.toString('base64'), // Convertir el archivo a base64 para enviarlo en el cuerpo
        })),
    };

    // Enviar la data al servidor en el puerto 3001 para que calcule height, timestamp, y previousHash
    try {
        const response = await fetch('https://nodo-blockchain-v1-0.onrender.com', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json', // Establecer el tipo de contenido como JSON
            },
            body: JSON.stringify(blockData), // Convertir el objeto a JSON para enviarlo
        });

        // Verificar si la respuesta es JSON antes de intentar parsearlo
        const text = await response.text();
        try {
            const result = JSON.parse(text);
            if (result.message === 'Bloque subido exitosamente') {
                // Si la respuesta es exitosa, envia la confirmación al cliente
                return res.json({
                    success: true,
                    message: 'Data enviada con éxito al servidor 3001 y bloque creado',
                    blockData: result.blockData,
                });
            } else {
                return res.status(500).json({ success: false, message: 'Error al enviar la data al servidor 3001' });
            }
        } catch (error) {
            console.error('Error al parsear JSON:', error);
            console.log('Respuesta del servidor:', text);
            return res.status(500).json({ success: false, message: 'Error al procesar la respuesta de 3001' });
        }
    } catch (error) {
        console.error('Error al enviar la data:', error);
        return res.status(500).json({ success: false, message: 'Error al enviar la data al servidor 3001' });
    }
});

// Ruta para ver y desencriptar el archivo desde Google Drive
app.get('/view-file/:chain/:name-:fileName', async (req, res) => {
    const { chain, fileName } = req.params;
    const db = getDB();

    let collectionsToSearch = [];

    // Si el parámetro 'chain' es 'all', se deben buscar en todas las colecciones
    if (chain === 'all') {
        collectionsToSearch = ['block_pdf', 'block_pdf_audio', 'block_pdf_video', 'block_pdf_audio_video'];
    } else {
        // Si no es 'all', se busca en la colección especificada
        collectionsToSearch = [chain];
    }

    try {
        let block;
        let fileData;

        // Buscar en cada colección hasta encontrar el bloque y archivo
        for (const collection of collectionsToSearch) {
            block = await db.collection(collection).findOne({ "data.fileName": fileName });
            if (block) {
                // Si se encuentra el bloque, buscar el archivo dentro del bloque
                fileData = block.data.find(file => file.fileName === fileName);
                if (fileData) {
                    break;  // Salir del loop si encontramos el archivo
                }
            }
        }

        // Si no se encuentra el archivo en ninguna colección
        if (!fileData) {
            return res.status(404).send('Archivo no encontrado en ninguna de las colecciones');
        }

        const driveFileUrl = fileData.filePath;

        // Obtenemos el ID del archivo de Google Drive desde la URL
        const fileId = new URL(driveFileUrl).searchParams.get('id');
        if (!fileId) {
            return res.status(400).send('No se pudo obtener el ID del archivo de Google Drive');
        }

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

// Ruta para obtener los bloques de una cadena específica o de todas las cadenas
app.get('/blocks/:chain?', async (req, res) => {
    const db = getDB();
    const { chain } = req.params;

    try {
        // Si se selecciona 'all', obtenemos los bloques de las 4 colecciones específicas
        if (chain === 'all' || !chain) {
            // Definir las colecciones específicas que queremos obtener
            const collections = ['block_pdf', 'block_pdf_audio', 'block_pdf_video', 'block_pdf_audio_video'];
            let allBlocks = [];

            // Obtener los bloques de cada una de las colecciones
            for (const collectionName of collections) {
                const blocks = await db.collection(collectionName).find().toArray();
                allBlocks = allBlocks.concat(blocks);  // Agrega los bloques de esta colección a todos los bloques
            }

            res.json(allBlocks);  // Devuelve todos los bloques combinados
        } else {
            // Si se selecciona una cadena específica, solo obtenemos los bloques de esa colección
            const blocks = await db.collection(chain).find().toArray();
            res.json(blocks);  // Devuelve los bloques de la colección seleccionada
        }
    } catch (error) {
        console.error('Error al obtener los bloques:', error);
        res.status(500).send('Error al obtener los bloques');
    }
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}/views/login.html`);
    console.log(`Servidor escuchando en http://localhost:${PORT}/index.html`);
});
