const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Ruta al archivo JSON de la cuenta de servicio
const credentials = require('../service_account.json');

// ID de la carpeta de destino
const folderId = '1osMiPwAPaa5nCWDwymkhksEyRopdl-8t'; // Carpeta en la que deseas subir el archivo

// Crear cliente de autenticación
const authenticate = async () => {
    const auth = new google.auth.GoogleAuth({
        credentials, // Carga las credenciales de la cuenta de servicio
        scopes: ['https://www.googleapis.com/auth/drive.file'], // Permiso para gestionar archivos en Google Drive
    });

    const drive = google.drive({ version: 'v3', auth });
    return drive;
};

// Función para subir un archivo a Google Drive
const uploadFileToDrive = async (filePath) => {
    const drive = await authenticate();

    const fileMetadata = {
        'name': path.basename(filePath), // El nombre que tendrá el archivo en Drive
        'parents': [folderId], // Carpeta donde se subirá el archivo
    };

    const media = {
        mimeType: 'application/pdf', // Cambia esto dependiendo del tipo de archivo
        body: fs.createReadStream(filePath), // El archivo local que quieres subir
    };

    try {
        // Llamada a la API de Google Drive para subir el archivo
        const res = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id', // Devuelve solo el ID del archivo subido
        });

        const fileId = res.data.id; // Obtén el ID del archivo
        const fileUrl = `https://drive.google.com/file/d/${fileId}/view`; // Crea la URL

        console.log('Archivo subido con éxito. ID:', fileId);
        console.log('URL del archivo:', fileUrl); // Muestra la URL del archivo subido
        return fileUrl; // Devuelve la URL del archivo
    } catch (error) {
        console.error('Error al subir el archivo:', error);
        throw error;
    }
};

// Ejemplo de cómo usar la función para subir un archivo
const filePath = "C:/Users/sebas/Downloads/a.pdf"; 
uploadFileToDrive(filePath)
    .then((fileUrl) => {
        console.log('Archivo subido exitosamente. URL:', fileUrl);
    })
    .catch((error) => {
        console.error('Error al subir el archivo:', error);
    });
