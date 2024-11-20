document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('file');
    const previewContainer = document.getElementById('preview');
    const nameInput = document.getElementById('name');
    const statusMessageContainer = document.getElementById('status-message');
    const chainSelect = document.getElementById('chain'); // Selección de cadena

    // Establecer el tipo de archivo según la cadena seleccionada
    chainSelect.addEventListener('change', () => {
        const selectedChain = chainSelect.value;
        
        switch (selectedChain) {
            case 'block_pdf':
                fileInput.accept = 'application/pdf'; // Solo PDF
                break;
            case 'block_pdf_audio':
                fileInput.accept = 'application/pdf, audio/mp3'; // PDF + MP3
                break;
            case 'block_pdf_video':
                fileInput.accept = 'application/pdf, video/mp4'; // PDF + MP4
                break;
            case 'block_pdf_audio_video':
                fileInput.accept = 'application/pdf, audio/mp3, video/mp4'; // PDF + MP3 + MP4
                break;
            default:
                fileInput.accept = '*/*'; // Aceptar todos los tipos por defecto
        }
    });

    // Inicializar el valor del atributo accept según la selección inicial (por si ya se tiene un valor)
    chainSelect.dispatchEvent(new Event('change'));

    // Obtener la firma digital del usuario
    fetch('/digital-signature')
        .then(response => {
            if (!response.ok) throw new Error('No se pudo obtener la firma digital');
            return response.json();
        })
        .then(data => {
            const signatureInput = document.getElementById('digital-signature');
            if (data.signature) {
                signatureInput.value = data.signature;
            } else {
                throw new Error('Firma digital no disponible');
            }
        })
        .catch(error => {
            console.error(error);
            alert('Error al obtener la firma digital: ' + error.message);
            window.location.href = '/views/login.html';
        });

    // Previsualización de archivos seleccionados
    fileInput.addEventListener('change', () => {
        previewContainer.innerHTML = '';

        if (fileInput.files.length > 0) {
            previewContainer.style.display = 'grid';

            Array.from(fileInput.files).forEach(file => {
                const fileType = file.type;
                const reader = new FileReader();

                const fileDiv = document.createElement('div');
                fileDiv.classList.add('file-preview');

                const previewWidth = 600;
                const previewHeight = 500;

                if (fileType === 'application/pdf') {
                    reader.onload = () => {
                        const pdfIframe = document.createElement('iframe');
                        pdfIframe.src = reader.result;
                        pdfIframe.width = previewWidth;
                        pdfIframe.height = previewHeight;
                        pdfIframe.style.border = '1px solid #ddd';
                        fileDiv.appendChild(pdfIframe);
                    };
                    reader.readAsDataURL(file);
                } else if (fileType === 'audio/mpeg') {
                    reader.onload = () => {
                        const audioElement = document.createElement('audio');
                        audioElement.controls = true;
                        audioElement.style.width = '450px';
                        audioElement.style.height = '200px';
                        audioElement.src = reader.result;
                        fileDiv.appendChild(audioElement);
                    };
                    reader.readAsDataURL(file);
                } else if (fileType === 'video/mp4') {
                    reader.onload = () => {
                        const videoElement = document.createElement('video');
                        videoElement.controls = true;
                        videoElement.width = previewWidth;
                        videoElement.height = previewHeight;
                        videoElement.src = reader.result;
                        fileDiv.appendChild(videoElement);
                    };
                    reader.readAsDataURL(file);
                } else {
                    fileDiv.innerText = `Archivo: ${file.name} (No previsualizable)`;
                }

                previewContainer.appendChild(fileDiv);
            });
        } else {
            previewContainer.style.display = 'none';
        }
    });

    // Función para limpiar el nombre del archivo
    function cleanName(name) {
        let cleanedName = name.replace(/-/g, ' ');
        const specialChars = /[><\/\*\+#\$%&()=?¡¿\{\[\}\]]/g;
        cleanedName = cleanedName.replace(specialChars, ' ');
        return cleanedName;
    }

    // Manejar la subida del formulario
    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        let name = nameInput.value;
        name = cleanName(name);

        const formData = new FormData(uploadForm);
        formData.set('name', name);

        const timeout = 60000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Tiempo de espera excedido')), timeout)
        );

        try {
            const uploadResponse = await Promise.race([
                fetch('/upload', { 
                    method: 'POST', 
                    body: formData 
                }),
                timeoutPromise
            ]);

            const result = await uploadResponse.json();

            if (result.success) {
                statusMessageContainer.textContent = result.message;
                statusMessageContainer.className = 'status-message success';
            } else {
                statusMessageContainer.textContent = 'Error al subir el bloque: ' + result.message;
                statusMessageContainer.className = 'status-message error';
            }
        } catch (error) {
            console.error(error);
            statusMessageContainer.textContent = 'Error al subir el bloque: ' + error.message;
            statusMessageContainer.className = 'status-message error';
        }
    });
});
