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
  .then(() => {
    console.log('Persistencia local activada');
  })
  .catch((error) => {
    console.error('Error al setear persistencia:', error);
  });

const auth = firebase.auth();
const db = firebase.firestore();

// ========== VERIFICACIÓN DE SESIÓN ==========
auth.onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    const userDoc = await db.collection('usuarios').doc(user.uid).get();
    if (!userDoc.exists || userDoc.data().activo === false) {
        await auth.signOut();
        window.location.href = 'index.html';
        return;
    }
    document.getElementById('user-display').textContent = '👤 ' + (userDoc.data().nombre || user.email);
    await cargarDatalists();
    await cargarNotas();
});

document.getElementById('btn-logout').addEventListener('click', async () => {
    await auth.signOut();
    window.location.href = 'index.html';
});

// ========== FILTROS DE BÚSQUEDA ==========
const numFinca = document.getElementById('filtro-num-finca');
const nombreFinca = document.getElementById('filtro-nombre-finca');
const trabajo = document.getElementById('filtro-trabajo');
const idAnimal = document.getElementById('filtro-id-animal');
const raza = document.getElementById('filtro-raza');
const dueno = document.getElementById('filtro-dueno');
const observaciones = document.getElementById('filtro-observaciones');
const metodo = document.getElementById('filtro-metodo');
const fechaDesde = document.getElementById('filtro-fecha-desde');
const fechaHasta = document.getElementById('filtro-fecha-hasta');
const btnBuscar = document.getElementById('btn-buscar');
const btnLimpiar = document.getElementById('btn-limpiar');
const tbody = document.getElementById('tbody-resultados');
const sinResultados = document.getElementById('sin-resultados');
const resultadosCount = document.getElementById('resultados-count');
const listaFincas = document.getElementById('lista-fincas');
const listaTrabajos = document.getElementById('lista-trabajos');
const listaRazas = document.getElementById('lista-razas');
const listaDuenos = document.getElementById('lista-duenos');
const listaObservaciones = document.getElementById('lista-observaciones');
const listaMetodos = document.getElementById('lista-metodos');

async function cargarDatalists() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const snapshot = await db.collection('registros').where('veterinarioId', '==', user.uid).get();
        const fincasSet = new Set(), trabajosSet = new Set(), razasSet = new Set(), duenosSet = new Set(), observacionesSet = new Set(), metodosSet = new Set();
        const registros = [];
        
        snapshot.forEach(doc => {
            const d = doc.data();
            d.id = doc.id;
            registros.push(d);
            if (d.nombreFinca) fincasSet.add(d.nombreFinca);
            if (d.trabajo) trabajosSet.add(d.trabajo);
            if (d.raza) razasSet.add(d.raza);
            if (d.dueno) duenosSet.add(d.dueno);
            if (d.observaciones) observacionesSet.add(d.observaciones);
            if (d.metodo) metodosSet.add(d.metodo);
        });
        
        localStorage.setItem('fincavet_registros', JSON.stringify(registros));

        listaFincas.innerHTML = [...fincasSet].sort().map(f => `<option value="${f}">`).join('');
        listaTrabajos.innerHTML = [...trabajosSet].sort().map(t => `<option value="${t}">`).join('');
        listaRazas.innerHTML = [...razasSet].sort().map(r => `<option value="${r}">`).join('');
        listaDuenos.innerHTML = [...duenosSet].sort().map(d => `<option value="${d}">`).join('');
        listaObservaciones.innerHTML = [...observacionesSet].sort().map(o => `<option value="${o}">`).join('');
        listaMetodos.innerHTML = [...metodosSet].sort().map(m => `<option value="${m}">`).join('');
        
    } catch(e) { 
        console.warn('Sin conexión. Cargando datalists desde caché local...');
        
        const registros = JSON.parse(localStorage.getItem('fincavet_registros') || '[]');
        const fincasSet = new Set(), trabajosSet = new Set(), razasSet = new Set(), duenosSet = new Set(), observacionesSet = new Set(), metodosSet = new Set();
        
        registros.forEach(d => {
            if (d.nombreFinca) fincasSet.add(d.nombreFinca);
            if (d.trabajo) trabajosSet.add(d.trabajo);
            if (d.raza) razasSet.add(d.raza);
            if (d.dueno) duenosSet.add(d.dueno);
            if (d.observaciones) observacionesSet.add(d.observaciones);
            if (d.metodo) metodosSet.add(d.metodo);
        });
        
        listaFincas.innerHTML = [...fincasSet].sort().map(f => `<option value="${f}">`).join('');
        listaTrabajos.innerHTML = [...trabajosSet].sort().map(t => `<option value="${t}">`).join('');
        listaRazas.innerHTML = [...razasSet].sort().map(r => `<option value="${r}">`).join('');
        listaDuenos.innerHTML = [...duenosSet].sort().map(d => `<option value="${d}">`).join('');
        listaObservaciones.innerHTML = [...observacionesSet].sort().map(o => `<option value="${o}">`).join('');
        listaMetodos.innerHTML = [...metodosSet].sort().map(m => `<option value="${m}">`).join('');
    }
}

async function buscar() {
    const user = auth.currentUser;
    if (!user) return;
    
    if (!numFinca.value.trim() && !nombreFinca.value.trim() && !trabajo.value.trim() && !idAnimal.value.trim() && !raza.value.trim() && !dueno.value.trim() && !observaciones.value.trim() && !metodo.value.trim() && !fechaDesde.value && !fechaHasta.value) {
        alert('⚠️ Complete al menos un filtro.'); 
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">🔍 Buscando...</td></tr>';
    resultadosCount.textContent = ''; 
    sinResultados.classList.add('hidden');
    
    let resultados = [];
    
    if (navigator.onLine) {
        try {
            const snapshot = await db.collection('registros').where('veterinarioId', '==', user.uid).get();
            snapshot.forEach(doc => {
                const d = doc.data();
                d.id = doc.id;
                d.fechaDate = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha);
                resultados.push(d);
            });
            localStorage.setItem('fincavet_registros', JSON.stringify(resultados));
        } catch(e) {
            console.warn('Error Firestore, usando caché local');
            resultados = JSON.parse(localStorage.getItem('fincavet_registros') || '[]');
            resultados = resultados.map(r => ({
                ...r, 
                fechaDate: r.fecha?.toDate ? r.fecha.toDate() : new Date(r.fecha || r.fechaISO || new Date())
            }));
        }
    } else {
        console.log('Modo offline: cargando desde localStorage');
        resultados = JSON.parse(localStorage.getItem('fincavet_registros') || '[]');
        resultados = resultados.map(r => ({
            ...r, 
            fechaDate: r.fecha?.toDate ? r.fecha.toDate() : new Date(r.fecha || r.fechaISO || new Date())
        }));
    }
    
    resultados.sort((a, b) => b.fechaDate - a.fechaDate);
    
    let fn, fnom, ft, fa, fr, fd, fobs, fm;
    
    if (fn = numFinca.value.trim().toLowerCase()) resultados = resultados.filter(r => (r.numFinca || '').toLowerCase().includes(fn));
    if (fnom = nombreFinca.value.trim().toLowerCase()) resultados = resultados.filter(r => (r.nombreFinca || '').toLowerCase().includes(fnom));
    if (ft = trabajo.value.trim().toLowerCase()) resultados = resultados.filter(r => (r.trabajo || '').toLowerCase().includes(ft));
    if (fa = idAnimal.value.trim().toLowerCase()) resultados = resultados.filter(r => (r.idAnimal || '').toLowerCase().includes(fa));
    if (fr = raza.value.trim().toLowerCase()) resultados = resultados.filter(r => (r.raza || '').toLowerCase().includes(fr));
    if (fd = dueno.value.trim().toLowerCase()) resultados = resultados.filter(r => (r.dueno || '').toLowerCase().includes(fd));
    if (fobs = observaciones.value.trim().toLowerCase()) resultados = resultados.filter(r => (r.observaciones || '').toLowerCase().includes(fobs));
    if (fm = metodo.value.trim().toLowerCase()) resultados = resultados.filter(r => (r.metodo || '').toLowerCase().includes(fm));
    if (fechaDesde.value) resultados = resultados.filter(r => r.fechaDate >= new Date(fechaDesde.value + 'T00:00:00'));
    if (fechaHasta.value) resultados = resultados.filter(r => r.fechaDate <= new Date(fechaHasta.value + 'T23:59:59'));
    
    mostrarResultados(resultados);
}

function mostrarResultados(resultados) {
    tbody.innerHTML = '';
    if (!resultados.length) {
        sinResultados.classList.remove('hidden');
        resultadosCount.textContent = '0 registros';
        return;
    }
    sinResultados.classList.add('hidden');
    resultadosCount.textContent = resultados.length + ' registro(s)';
    resultados.forEach(r => {
        const fs = r.fechaDate ? r.fechaDate.toLocaleDateString('es-VE') : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r.numFinca||''}</td><td>${r.nombreFinca||''}</td><td>${r.trabajo||''}</td><td>${fs}</td><td>${r.idAnimal||''}</td><td>${r.raza||''}</td><td>${r.observaciones||''}</td><td>${r.metodo||''}</td><td>${r.dueno||''}</td>`;
        tbody.appendChild(tr);
    });
}

function limpiar() {
    numFinca.value = ''; 
    nombreFinca.value = ''; 
    trabajo.value = ''; 
    idAnimal.value = ''; 
    raza.value = ''; 
    dueno.value = ''; 
    observaciones.value = ''; 
    metodo.value = ''; 
    fechaDesde.value = ''; 
    fechaHasta.value = '';
    tbody.innerHTML = ''; 
    resultadosCount.textContent = ''; 
    sinResultados.classList.add('hidden');
}

btnBuscar.addEventListener('click', buscar);
btnLimpiar.addEventListener('click', limpiar);

// ========== NOTAS RÁPIDAS OFFLINE FIRST ==========
const btnGuardarNota = document.getElementById('btn-guardar-nota');
const notaFinca = document.getElementById('nota-finca');
const notaIdAnimal = document.getElementById('nota-id-animal');
const notaTrabajo = document.getElementById('nota-trabajo');
const notaObservacion = document.getElementById('nota-observacion');
const notaMensaje = document.getElementById('nota-mensaje');
const tbodyNotas = document.getElementById('tbody-notas');
const btnRefrescar = document.getElementById('btn-refrescar-notas');

btnGuardarNota.addEventListener('click', async () => {
    const idAnimal = notaIdAnimal.value.trim();
    const trabajoNota = notaTrabajo.value.trim();
    if (!idAnimal || !trabajoNota) return alert('⚠️ Completa ID Animal y Trabajo.');

    const nota = {
        id: 'local_' + Date.now(),
        veterinarioId: auth.currentUser.uid,
        numFinca: notaFinca.value.trim(),
        idAnimal,
        trabajo: trabajoNota,
        observacion: notaObservacion.value.trim(),
        fecha: new Date().toISOString(),
        sincronizado: false
    };

    const notasLocales = JSON.parse(localStorage.getItem('fincavet_notas') || '[]');
    notasLocales.unshift(nota);
    localStorage.setItem('fincavet_notas', JSON.stringify(notasLocales));

    notaIdAnimal.value = '';
    notaTrabajo.value = '';
    notaObservacion.value = '';

    notaMensaje.style.display = 'inline';
    setTimeout(() => { notaMensaje.style.display = 'none'; }, 2000);

    cargarNotas();

    if (navigator.onLine) {
        try {
            const docRef = await db.collection('notasRapidas').add({
                veterinarioId: auth.currentUser.uid,
                numFinca: nota.numFinca,
                idAnimal: nota.idAnimal,
                trabajo: nota.trabajo,
                observacion: nota.observacion,
                fecha: firebase.firestore.Timestamp.now(),
                estado: 'pendiente'
            });
            const actualizadas = JSON.parse(localStorage.getItem('fincavet_notas') || '[]');
            const index = actualizadas.findIndex(n => n.id === nota.id);
            if (index !== -1) {
                actualizadas[index].sincronizado = true;
                actualizadas[index].remoteId = docRef.id;
                localStorage.setItem('fincavet_notas', JSON.stringify(actualizadas));
            }
            cargarNotas();
        } catch (e) {
            console.warn('Sin conexión. Nota guardada localmente.');
        }
    }
});

btnRefrescar.addEventListener('click', async () => {
    await sincronizarNotasPendientes();
    cargarNotas();
});

async function sincronizarNotasPendientes() {
    if (!navigator.onLine) return;
    const notas = JSON.parse(localStorage.getItem('fincavet_notas') || '[]');
    for (let i = 0; i < notas.length; i++) {
        const n = notas[i];
        if (!n.sincronizado) {
            try {
                const ref = n.remoteId ? db.collection('notasRapidas').doc(n.remoteId) : db.collection('notasRapidas').doc();
                await ref.set({
                    veterinarioId: auth.currentUser.uid,
                    numFinca: n.numFinca || '',
                    idAnimal: n.idAnimal,
                    trabajo: n.trabajo,
                    observacion: n.observacion || '',
                    fecha: firebase.firestore.Timestamp.fromDate(new Date(n.fecha)),
                    estado: 'pendiente'
                });
                notas[i].sincronizado = true;
                notas[i].remoteId = ref.id;
            } catch (e) { console.warn('Error sincronizando nota'); }
        }
    }
    localStorage.setItem('fincavet_notas', JSON.stringify(notas));
}

async function cargarNotas() {
    let remotas = [];
    if (auth.currentUser && navigator.onLine) {
        try {
            const snap = await db.collection('notasRapidas')
                .where('veterinarioId', '==', auth.currentUser.uid)
                .orderBy('fecha', 'desc')
                .limit(100)
                .get();
            remotas = snap.docs.map(d => ({
                ...d.data(),
                id: d.id,
                remoteId: d.id,
                sincronizado: true,
                fecha: d.data().fecha?.toDate().toISOString() || new Date().toISOString()
            }));
        } catch (e) { console.warn('Error cargando notas remotas'); }
    }

    const locales = JSON.parse(localStorage.getItem('fincavet_notas') || '[]');
    
    const mapa = new Map();
    remotas.forEach(r => mapa.set(r.remoteId, r));
    locales.forEach(l => {
        if (l.remoteId && mapa.has(l.remoteId)) return;
        mapa.set(l.id, l);
    });
    
    const todas = Array.from(mapa.values()).sort((a, b) => {
        const fa = a.fecha || a.createdAt || 0;
        const fb = b.fecha || b.createdAt || 0;
        return new Date(fb) - new Date(fa);
    });

    tbodyNotas.innerHTML = todas.length ? todas.map(n => {
        const fecha = n.fecha?.toDate?.() || new Date(n.fecha || n.createdAt);
        const fs = fecha instanceof Date ? fecha.toLocaleString('es-VE') : new Date(fecha).toLocaleString('es-VE');
        return `
            <tr>
                <td>${n.numFinca || ''}</td>
                <td>${fs}</td>
                <td>${n.idAnimal || ''}</td>
                <td>${n.trabajo || ''}</td>
                <td>${n.observacion || ''}</td>
                <td>${n.sincronizado ? '✅' : '📴'}</td>
                <td><button onclick="eliminarNota('${n.id}')" style="background:#c62828;color:white;border:none;padding:3px 8px;border-radius:4px;">🗑️</button></td>
            </tr>`;
    }).join('') : '<tr><td colspan="7" style="text-align:center;">No hay notas aún</td></tr>';
}

async function eliminarNota(id) {
    if (!confirm('¿Eliminar esta nota?')) return;
    
    if (navigator.onLine && id && !id.startsWith('local_')) {
        try { await db.collection('notasRapidas').doc(id).delete(); } catch (e) {}
    }
    
    let notasLocales = JSON.parse(localStorage.getItem('fincavet_notas') || '[]');
    const notaLocal = notasLocales.find(n => n.id === id);
    if (notaLocal) {
        if (notaLocal.remoteId && navigator.onLine) {
            try { await db.collection('notasRapidas').doc(notaLocal.remoteId).delete(); } catch (e) {}
        }
        notasLocales = notasLocales.filter(n => n.id !== id);
    } else {
        notasLocales = notasLocales.filter(n => n.remoteId !== id);
    }
    
    localStorage.setItem('fincavet_notas', JSON.stringify(notasLocales));
    cargarNotas();
}

window.addEventListener('online', () => {
    sincronizarNotasPendientes();
    if (auth.currentUser) cargarNotas();
}); 