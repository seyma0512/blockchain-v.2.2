
// Función para obtener el emoji basado en el tipo de archivo
function getEmojiForFileType(type) {
    switch (type) {
        case "audio":
            return "🎵"; // Audio
        case "video":
            return "📹"; // Video
        default:
            return "📄"; // Documento
    }
}

// Comprobar la firma digital al cargar la página
async function checkDigitalSignature() {
    try {
        const response = await fetch('/digital-signature');
        if (!response.ok) throw new Error('No se pudo obtener la firma digital');
        const data = await response.json();
        if (!data.signature) {
            throw new Error('Firma digital no disponible');
        }
        return true;  // Firma digital disponible
    } catch (error) {
        // Redirigir inmediatamente al login sin mostrar alerta
        window.location.href = '/views/login.html'; // Redirigir si no se encuentra la firma digital
        return false;
    }
}

// Verificar la firma digital al cargar la página
window.addEventListener('DOMContentLoaded', async () => {
    const signatureValid = await checkDigitalSignature();
    if (!signatureValid) return;

    // Si la firma es válida, se habilita el botón para cargar bloques
    document.getElementById('loadBlocks').disabled = false;
});

// Manejar la carga de bloques cuando el botón es presionado
document.getElementById('loadBlocks').addEventListener('click', async () => {
    const chain = document.getElementById('chain').value;
    const blockDetailsDiv = document.getElementById('blockDetails');
    
    // Obtener los parámetros de búsqueda
    const searchName = document.getElementById('searchName').value.toLowerCase();
    const searchLocation = document.getElementById('location').value.toLowerCase();
    const searchIncidentType = document.getElementById('incident-type').value.toLowerCase();
    const searchDate = document.getElementById('searchDate').value;

    if (!chain) {
        alert('Por favor selecciona el tipo de cadena.');
        return;
    }

    // Si se selecciona "all", se buscan bloques de todos los tipos de cadena
    const endpoint = chain === "all" ? '/blocks' : `/blocks/${chain}`;

    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error('Error al obtener los bloques');
        }
        const blocks = await response.json();

        // Filtrar bloques según los parámetros de búsqueda
        const filteredBlocks = blocks.filter(block => {
            const blockDate = new Date(block.timestamp).toISOString().split('T')[0];  // Fecha en formato YYYY-MM-DD
            return (
                (searchName === '' || block.name.toLowerCase().includes(searchName)) &&
                (searchLocation === '' || block.location.toLowerCase().includes(searchLocation)) &&
                (searchIncidentType === '' || block.incidentType.toLowerCase().includes(searchIncidentType)) &&
                (searchDate === '' || blockDate === searchDate)
            );
        });

        // Limpiar el contenido anterior
        blockDetailsDiv.innerHTML = '';

        if (filteredBlocks.length === 0) {
            blockDetailsDiv.innerHTML = '<p>No hay bloques disponibles que coincidan con los criterios de búsqueda.</p>';
        } else {
            filteredBlocks.forEach(block => {
                blockDetailsDiv.innerHTML += `
                    <hr>
                    <div>
                        <h3><strong>Nombre:</strong> ${block.name}</h3>
                        <p><strong>Descripción:</strong> ${block.description}</p>
                        <p><strong>Ubicación:</strong> ${block.location}</p>
                        <p><strong>Tipo de Incidente:</strong> ${block.incidentType}</p>
                        <p><strong>Fecha:</strong> ${new Date(block.timestamp).toLocaleString()}</p>
                        <h3><p><strong>Archivos:</strong></p>
                        <ul>
                            ${block.data.map(file => {
                                // Determinar el tipo de archivo basado en la extensión
                                let fileType = "document"; // Valor por defecto
                                const fileExtension = file.fileName.split('.').pop().toLowerCase();
                                let emoji = getEmojiForFileType(fileType);  // Obtener el emoji según el tipo de archivo

                                if (fileExtension === "pdf") {
                                    fileType = "document";
                                    emoji = getEmojiForFileType("document");
                                } else if (fileExtension === "mpeg") {
                                    fileType = "audio"; // Usamos audio para MPEG
                                    emoji = getEmojiForFileType("audio");
                                } else if (fileExtension === "mp4") {
                                    fileType = "video";
                                    emoji = getEmojiForFileType("video");
                                }

                                return `
                                    <li>
                                        <a href="/view-file/${chain}/${block.name}-${file.fileName}" target="_blank" data-type="${fileType}">
                                            ${emoji} ${file.fileName}
                                        </a>
                                    </li>
                                `;
                            }).join('')}
                        </ul>
                    </div>
                `;
            });
        }

        // Mostrar los detalles del bloque
        blockDetailsDiv.style.display = 'block';

    } catch (error) {
        console.error(error);
        alert('Hubo un problema al cargar los bloques.');
    }
});