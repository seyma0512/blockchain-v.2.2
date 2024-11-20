document.addEventListener('DOMContentLoaded', () => {
    const savedSignature = sessionStorage.getItem('digital-signature');
    const signatureInput = document.getElementById('digital-signature');
    const modulesContainer = document.getElementById('modules-container'); // Contenedor donde se agregarán los módulos

    // Asegúrate de que el contenedor de módulos esté vacío al principio
    modulesContainer.innerHTML = '';

    // Si la firma ya está guardada, asignarla directamente al campo oculto
    if (savedSignature) {
        signatureInput.value = savedSignature;
        fetchUserRole();  // Verificar el rol después de obtener la firma
    } else {
        // Si no está guardada, obtenerla del servidor
        fetch('/digital-signature')
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errorData => {
                        console.error(errorData.error);
                        window.location.href = '/views/login.html';  // Redirigir al login si no se encuentra la firma o sesión
                    });
                }
                return response.json(); // Si es OK, continuamos con el procesamiento
            })
            .then(data => {
                if (data.signature) {
                    signatureInput.value = data.signature;
                    // Guardar la firma digital en sessionStorage
                    sessionStorage.setItem('digital-signature', data.signature);
                    fetchUserRole();  // Verificar el rol después de obtener la firma
                } else {
                    throw new Error('Firma digital no disponible');
                }
            })
            .catch(error => {
                console.error(error);
                alert('Error al obtener la firma digital: ' + error.message);
            });
    }

    // Función para obtener los privilegios del usuario según su rol
    function fetchUserRole() {
        fetch('/get-privileges')
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errorData => {
                        console.error('Error al obtener privilegios:', errorData);
                    });
                }
                return response.json();
            })
            .then(async data => {
                if (data && data.privilages) {  // Cambié 'privileges' a 'privilages'
                    console.log('Privilegios:', data.privilages);  // Mostrar los privilegios en la consola

                    // Verificar si el privilegio 'create' está presente para cargar el módulo "Subir Archivos"
                    if (data.privilages.includes('create')) {  // Cambié 'privileges' a 'privilages'
                        try {
                            const createResponse = await fetch('/views/modules/btn-create.html');
                            const createHTML = await createResponse.text();
                            const uploadModule = document.createElement('div');
                            uploadModule.innerHTML = createHTML;
                            modulesContainer.appendChild(uploadModule); // Agregar el módulo de subir archivos
                        } catch (error) {
                            console.error('Error al cargar el módulo "Subir Archivos":', error);
                        }
                    }

                    // Verificar si el privilegio 'read' está presente para cargar el módulo "Ver Bloques"
                    if (data.privilages.includes('read')) {  // Cambié 'privileges' a 'privilages'
                        try {
                            const readResponse = await fetch('/views/modules/btn-read.html');
                            const readHTML = await readResponse.text();
                            const viewModule = document.createElement('div');
                            viewModule.innerHTML = readHTML;
                            modulesContainer.appendChild(viewModule); // Agregar el módulo de ver bloques
                        } catch (error) {
                            console.error('Error al cargar el módulo "Ver Bloques":', error);
                        }
                    }

                    // Si no hay privilegios, mostramos un mensaje
                    if (modulesContainer.children.length === 0) {
                        const noPrivilegesMessage = document.createElement('p');
                        noPrivilegesMessage.textContent = 'No tienes privilegios para ver los módulos.';
                        modulesContainer.appendChild(noPrivilegesMessage);
                    }
                } else {
                    console.error('No se recibieron privilegios válidos.');
                }
            })
            .catch(error => {
                console.error('Error al obtener los privilegios:', error);
            });
    }

    // Lógica para cerrar sesión y eliminar la firma digital y los privilegios de sessionStorage
    const logoutButton = document.getElementById('logout-btn');
    logoutButton.addEventListener('click', () => {
        // Hacer la solicitud POST al servidor para destruir la sesión
        fetch('/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then(response => {
            if (response.ok) {
                // Eliminar la firma digital y los privilegios de sessionStorage
                sessionStorage.removeItem('digital-signature');
                sessionStorage.removeItem('privilages');  // Cambié 'privileges' a 'privilages'

                // Verificar que los datos fueron eliminados
                console.log('Firma digital y privilegios eliminados:', !sessionStorage.getItem('digital-signature') && !sessionStorage.getItem('privilages'));  // Cambié 'privileges' a 'privilages'

                // Redirigir al login después de cerrar sesión
                window.location.href = '/views/login.html';  // Redirigir al login
            } else {
                console.error('Error al cerrar sesión en el servidor');
            }
        })
        .catch(error => {
            console.error('Error al hacer la solicitud de logout:', error);
        });
    });
});
