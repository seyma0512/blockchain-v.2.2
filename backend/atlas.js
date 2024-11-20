const { MongoClient } = require('mongodb');

// Reemplaza esta URL con la de MongoDB Atlas
const url = "mongodb+srv://seyma0512:Sebas1705@blockchain.lzsj1.mongodb.net/?retryWrites=true&w=majority&appName=blockchain";
const dbName = 'blockchain-atlas'; // Cambia esto al nombre de tu base de datos

const listCollections = async () => {
    try {
        const client = new MongoClient(url, {
            serverApi: {
                version: '1',
                strict: true,
                deprecationErrors: true,
            },
        });

        await client.connect();
        const db = client.db(dbName);

        // Listar todas las colecciones
        const collections = await db.listCollections().toArray();
        console.log('Colecciones en la base de datos:', collections.map(c => c.name));

        await client.close(); // Cerrar la conexión
    } catch (err) {
        console.error('Error al listar colecciones:', err);
    }
};

// Llamar a la función para listar colecciones
listCollections();
