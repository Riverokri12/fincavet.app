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

// ========== PERSISTENCIA DE SESIÓN ==========
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => console.log('Persistencia local activada'))
  .catch((error) => console.error('Error al activar persistencia:', error));

const auth = firebase.auth();
const db = firebase.firestore();

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        const userDoc = await db.collection('usuarios').doc(user.uid).get();
        if (!userDoc.exists || userDoc.data().rol !== 'admin') {
            await auth.signOut();
            window.location.href = 'index.html';
            return;
        }
        
        document.getElementById('admin-display').textContent = '👤 ' + (userDoc.data().nombre || user.email);
        
        document.getElementById('btn-admin-logout').addEventListener('click', async () => {
            await auth.signOut();
            window.location.href = 'index.html';
        });
        
        await cargarUsuarios();
        await cargarLista();
        await cargarSelectVeterinarios();
        await cargarNotasAdmin();
    } catch (err) {
        console.error('Error en autenticación admin:', err);
        window.location.href = 'index.html';
    }
});

// ========== GESTIÓN DE USUARIOS ==========
async function cargarUsuarios() {
    try {
        const snap = await db.collection('usuarios').get();
        const tbody = document.getElementById('tabla-usuarios');
        tbody.innerHTML = '';
        snap.forEach(doc => {
            const d = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${d.nombre || ''}</td><td>${d.email || ''}</td><td>${d.rol || ''}</td><td>${d.activo ? '✅' : '❌'}</td>
            <td><button onclick="editarUsuario('${doc.id}')">✏️</button></td>`;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error cargando usuarios:', err);
        alert('❌ Error al cargar usuarios: ' + err.message);
    }
}

async function editarUsuario(uid) {
    try {
        const doc = await db.collection('usuarios').doc(uid).get();
        if (!doc.exists) {
            alert('❌ Usuario no encontrado');
            return;
        }
        const d = doc.data();
        document.getElementById('usuario-uid').value = uid;
        document.getElementById('usuario-email').value = d.email || '';
        document.getElementById('usuario-nombre').value = d.nombre || '';
        document.getElementById('usuario-rol').value = d.rol || 'veterinario';
        document.getElementById('usuario-activo').value = d.activo ? 'true' : 'false';
    } catch (err) {
        console.error('Error editando usuario:', err);
        alert('❌ Error al cargar usuario');
    }
}

document.getElementById('usuario-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('usuario-email').value.trim();
    const password = document.getElementById('usuario-password').value;
    const nombre = document.getElementById('usuario-nombre').value.trim();
    const rol = document.getElementById('usuario-rol').value;
    const activo = document.getElementById('usuario-activo').value === 'true';
    const uid = document.getElementById('usuario-uid').value;
    
    try {
        if (uid) {
            // Actualizar usuario existente
            const updateData = { nombre, rol, activo };
            await db.collection('usuarios').doc(uid).update(updateData);
        } else {
            // Crear nuevo usuario - NO usar createUserWithEmailAndPassword porque desloguea al admin
            // En su lugar, usar una Cloud Function o pedir al admin que cree el usuario manualmente en Firebase Console
            alert('⚠️ Para crear usuarios nuevos, use el panel de Firebase Authentication o implemente una Cloud Function.');
            return;
        }
        document.getElementById('usuario-form').reset();
        document.getElementById('usuario-uid').value = '';
        await cargarUsuarios();
        await cargarSelectVeterinarios();
        alert('✅ Usuario guardado correctamente');
    } catch(err) { 
        console.error('Error guardando usuario:', err);
        alert('❌ Error: ' + err.message); 
    }
});

// ========== REGISTRO DE ANIMALES ==========
document.getElementById('registro-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const docId = document.getElementById('doc-id').value;
    const data = {
        veterinarioId: document.getElementById('registro-veterinario').value,
        numFinca: document.getElementById('num-finca').value.trim(),
        nombreFinca: document.getElementById('nombre-finca').value.trim(),
        trabajo: document.getElementById('trabajo').value.trim(),
        fecha: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('fecha').value + 'T00:00:00')),
        idAnimal: document.getElementById('id-animal').value.trim(),
        raza: document.getElementById('raza').value.trim(),
        observaciones: document.getElementById('observaciones').value.trim(),
        metodo: document.getElementById('metodo').value.trim(),
        dueno: document.getElementById('dueno-animal').value.trim()
    };
    
    try {
        if (docId) {
            // Actualizar registro existente
            await db.collection('registros').doc(docId).update(data);
            alert('✅ Registro actualizado correctamente');
        } else {
            // Crear nuevo registro
            await db.collection('registros').add(data);
            alert('✅ Registro guardado correctamente');
        }
        document.getElementById('registro-form').reset();
        document.getElementById('doc-id').value = '';
        document.getElementById('btn-cancelar').classList.add('hidden');
        await cargarLista();
    } catch(err) { 
        console.error('Error guardando registro:', err);
        alert('❌ Error al guardar: ' + err.message); 
    }
});

// ========== LISTA DE REGISTROS ==========
let todosRegistros = [];

async function cargarLista() {
    try {
        const snap = await db.collection('registros').orderBy('fecha', 'desc').limit(300).get();
        todosRegistros = [];
        snap.forEach(doc => { 
            const d = doc.data(); 
            d.id = doc.id; 
            d.fechaDate = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha); 
            todosRegistros.push(d); 
        });
        renderizarLista(todosRegistros);
    } catch(e) {
        console.error('Error al cargar lista:', e);
        alert('❌ Error al cargar registros: ' + e.message);
    }
}

function renderizarLista(lista) {
    const tbody = document.getElementById('tabla-admin');
    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;">No hay registros aún.</td></tr>';
        return;
    }
    tbody.innerHTML = lista.map(r => {
        const fs = r.fechaDate ? r.fechaDate.toLocaleDateString('es-VE', {year:'numeric',month:'2-digit',day:'2-digit'}) : '';
        return `<tr>
            <td>${r.veterinarioId?.slice(-5)||''}</td>
            <td>${r.numFinca||''}</td>
            <td>${r.nombreFinca||''}</td>
            <td>${r.trabajo||''}</td>
            <td>${fs}</td>
            <td>${r.idAnimal||''}</td>
            <td>${r.raza||''}</td>
            <td>${r.observaciones||''}</td>
            <td>${r.metodo||''}</td>
            <td>${r.dueno||''}</td>
            <td>
                <button onclick="editarRegistro('${r.id}')">✏️</button>
                <button onclick="eliminarRegistro('${r.id}')">🗑️</button>
            </td>
        </tr>`;
    }).join('');
}

async function editarRegistro(id) {
    try {
        const doc = await db.collection('registros').doc(id).get();
        if (!doc.exists) {
            alert('❌ Registro no encontrado');
            return;
        }
        const d = doc.data();
        document.getElementById('doc-id').value = id;
        document.getElementById('registro-veterinario').value = d.veterinarioId || '';
        document.getElementById('num-finca').value = d.numFinca || '';
        document.getElementById('nombre-finca').value = d.nombreFinca || '';
        document.getElementById('trabajo').value = d.trabajo || '';
        document.getElementById('id-animal').value = d.idAnimal || '';
        document.getElementById('raza').value = d.raza || '';
        document.getElementById('observaciones').value = d.observaciones || '';
        document.getElementById('metodo').value = d.metodo || '';
        document.getElementById('dueno-animal').value = d.dueno || '';
        const fd = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha);
        document.getElementById('fecha').value = fd.toISOString().split('T')[0];
        document.getElementById('btn-cancelar').classList.remove('hidden');
    } catch (err) {
        console.error('Error editando registro:', err);
        alert('❌ Error al cargar registro');
    }
}

async function eliminarRegistro(id) {
    if (!confirm('¿Eliminar este registro?')) return;
    try {
        await db.collection('registros').doc(id).delete(); 
        await cargarLista(); 
    } catch (err) {
        console.error('Error eliminando registro:', err);
        alert('❌ Error al eliminar: ' + err.message);
    }
}

async function cargarSelectVeterinarios() {
    try {
        const snap = await db.collection('usuarios').where('rol', 'in', ['veterinario', 'dueno']).where('activo', '==', true).get();
        const sel = document.getElementById('registro-veterinario');
        sel.innerHTML = '<option value="">Seleccione...</option>';
        snap.forEach(doc => { 
            const d = doc.data(); 
            sel.innerHTML += `<option value="${doc.id}">${d.nombre || ''} (${d.email || ''})</option>`; 
        });
    } catch (err) {
        console.error('Error cargando veterinarios:', err);
    }
}

document.getElementById('busqueda-rapida').addEventListener('input', (e) => {
    const t = e.target.value.toLowerCase();
    if (!t) { renderizarLista(todosRegistros); return; }
    renderizarLista(todosRegistros.filter(r => JSON.stringify(r).toLowerCase().includes(t)));
});

document.getElementById('btn-cancelar').addEventListener('click', () => {
    document.getElementById('registro-form').reset();
    document.getElementById('doc-id').value = '';
    document.getElementById('btn-cancelar').classList.add('hidden');
});

// ========== NOTAS RÁPIDAS (ADMIN) ==========
async function cargarNotasAdmin() {
    try {
        const snap = await db.collection('notasRapidas')
            .where('estado', '==', 'pendiente')
            .orderBy('fecha', 'desc')
            .limit(50)
            .get();
            
        const tbody = document.getElementById('tabla-notas-admin');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        // Cargar todos los veterinarios de una vez para evitar N+1 queries
        const vetIds = [...new Set(snap.docs.map(d => d.data().veterinarioId))];
        const vetMap = new Map();
        
        await Promise.all(vetIds.map(async (vid) => {
            try {
                const vetDoc = await db.collection('usuarios').doc(vid).get();
                if (vetDoc.exists) vetMap.set(vid, vetDoc.data().nombre || vid.slice(-5));
            } catch(e) {
                vetMap.set(vid, vid.slice(-5));
            }
        }));
        
        snap.forEach(doc => {
            const d = doc.data();
            const fecha = d.fecha?.toDate ? d.fecha.toDate() : new Date();
            const fs = fecha.toLocaleDateString('es-VE') + ' ' + fecha.toLocaleTimeString('es-VE', {hour:'2-digit',minute:'2-digit'});
            const vetNombre = vetMap.get(d.veterinarioId) || d.veterinarioId?.slice(-5) || '';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${vetNombre}</td>
                <td>${fs}</td>
                <td>${d.idAnimal || ''}</td>
                <td>${d.trabajo || ''}</td>
                <td>${d.observacion || ''}</td>
                <td>
                    <button onclick="procesarNota('${doc.id}', '${d.idAnimal}', '${d.trabajo}', '${d.observacion || ''}', '${d.veterinarioId}')">📋 Procesar</button>
                    <button onclick="descartarNota('${doc.id}')">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        if (!snap.size) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay notas pendientes.</td></tr>';
        }
    } catch(e) { 
        console.error('Error notas admin:', e);
        alert('❌ Error al cargar notas: ' + e.message);
    }
}

async function procesarNota(idNota, idAnimal, trabajo, observacion, veterinarioId) {
    try {
        await db.collection('notasRapidas').doc(idNota).update({ estado: 'procesado' });
        
        document.getElementById('id-animal').value = idAnimal;
        document.getElementById('trabajo').value = trabajo;
        document.getElementById('observaciones').value = observacion;
        document.getElementById('registro-veterinario').value = veterinarioId;
        document.getElementById('fecha').value = new Date().toISOString().split('T')[0];
        
        document.getElementById('registro-form').scrollIntoView({ behavior: 'smooth' });
        
        await cargarNotasAdmin();
        alert('✅ Nota procesada. Complete los datos faltantes y guarde el registro.');
    } catch (err) {
        console.error('Error procesando nota:', err);
        alert('❌ Error al procesar nota');
    }
}

async function descartarNota(idNota) {
    if (!confirm('¿Descartar esta nota?')) return;
    try {
        await db.collection('notasRapidas').doc(idNota).update({ estado: 'descartado' });
        await cargarNotasAdmin();
    } catch (err) {
        console.error('Error descartando nota:', err);
        alert('❌ Error al descartar nota');
    }
}

async function eliminarNotaAdmin(id) {
    if (!confirm('¿Eliminar definitivamente esta nota?')) return;
    try {
        await db.collection('notasRapidas').doc(id).delete();
        await cargarNotasAdmin();
    } catch (err) {
        console.error('Error eliminando nota:', err);
        alert('❌ Error al eliminar nota');
    }
} 