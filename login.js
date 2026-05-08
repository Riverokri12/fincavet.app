const firebaseConfig = {
  apiKey: "AIzaSyAngjdTmF8dJIiX_kB7P_Gql9eZ8d1zXIU",
  authDomain: "fincavet-1.firebaseapp.com",
  projectId: "fincavet-1",
  storageBucket: "fincavet-1.firebasestorage.app",
  messagingSenderId: "852612044396",
  appId: "1:852612044396:web:9b4711c07d36a8ff8dea49",
  measurementId: "G-HDGEM8DM39"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Activar persistencia con manejo de errores
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => console.log('Persistencia local activada'))
    .catch(err => console.error('Error al activar persistencia:', err));

const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        const userDoc = await firebase.firestore().collection('usuarios').doc(cred.user.uid).get();
        
        // Verificar que el usuario exista en Firestore
        if (!userDoc.exists) {
            await auth.signOut();
            loginError.textContent = '❌ Usuario no registrado en el sistema';
            loginError.classList.remove('hidden');
            return;
        }
        
        const userData = userDoc.data();
        
        // Verificar que esté activo
        if (userData.activo === false) {
            await auth.signOut();
            loginError.textContent = '❌ Usuario bloqueado. Contacte al administrador.';
            loginError.classList.remove('hidden');
            return;
        }
        
        // Redirigir según rol
        if (userData.rol === 'admin') {
            window.location.href = 'admin.html';
        } else if (userData.rol === 'veterinario') {
            window.location.href = 'app.html';
        } else {
            await auth.signOut();
            loginError.textContent = '❌ Rol no autorizado para esta aplicación';
            loginError.classList.remove('hidden');
        }
        
    } catch (err) {
        console.error('Login error:', err);
        loginError.textContent = '❌ ' + (err.message || 'Error al iniciar sesión');
        loginError.classList.remove('hidden');
    }
});