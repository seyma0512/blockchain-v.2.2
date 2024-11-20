document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault(); // Evitar que se envíe el formulario de manera tradicional

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage'); // Obtener el contenedor del mensaje de error

    // Limpiar cualquier mensaje de error previo
    errorMessage.textContent = '';
    errorMessage.style.display = 'none';

    // Validación básica: asegurarse de que ambos campos no estén vacíos
    if (username === '' || password === '') {
        errorMessage.textContent = 'Por favor, ingresa usuario y contraseña.';
        errorMessage.style.display = 'block';
        return; // Evitar continuar si los campos están vacíos
    }

    const response = await fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
        window.location.href = '/views/center.html'; // Redirigir a upload.html si la validación es exitosa
    } else {
        // Si la validación falla, limpiar los campos y mostrar el mensaje de error
        errorMessage.textContent = 'Usuario o contraseña incorrectos';
        errorMessage.style.display = 'block';
        document.getElementById('username').value = ''; // Limpiar campo de usuario
        document.getElementById('password').value = ''; // Limpiar campo de contraseña
    }
});

// Función para alternar la visibilidad de la contraseña
document.getElementById('togglePassword').addEventListener('click', function () {
    const passwordField = document.getElementById('password');
    const type = passwordField.type === 'password' ? 'text' : 'password';
    passwordField.type = type;
    this.textContent = type === 'password' ? '👁️' : '🙈';
});
