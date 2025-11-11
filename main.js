const API_BASE = 'http://localhost:3000'; 
const VALID_STATUSES = ['P', 'A', 'T', 'RA', 'AP']; // <<-- Array de estados actualizado

// ====================================================================
// --- FUNCIONES DE CARGA Y GESTIÓN DE DATOS ---
// ====================================================================

// 1. Cargar Cursos
async function loadClasses() {
    const ClassSelector = document.getElementById('ClassSelector');
    const NewStudentClassSelector = document.getElementById('NewStudentClassSelector');
    
    try {
        const response = await fetch(`${API_BASE}/all-classes`); // Endpoint renombrado
        const classes = await response.json(); 
        
        const optionsHTML = classes.map(cls => 
            `<option value="${cls.id}">${cls.nombre}</option>`
        ).join('');

        ClassSelector.innerHTML = '<option value="">-- SELECCIONE UN CURSO --</option>' + optionsHTML;
        NewStudentClassSelector.innerHTML = '<option value="">-- SELECCIONE CURSO --</option>' + optionsHTML;
        
    } catch (error) {
        console.error('Error loading classes:', error);
    }
}

// 2. Cargar Materias
async function loadSubjects(classId) {
    const SubjectSelector = document.getElementById('SubjectSelector');
    SubjectSelector.innerHTML = '<option value="">-- CARGANDO MATERIAS --</option>';
    SubjectSelector.disabled = true;

    if (!classId) {
        SubjectSelector.innerHTML = '<option value="">-- SELECCIONE CURSO PRIMERO --</option>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/class-subjects/${classId}`); // Endpoint renombrado
        const subjects = await response.json();
        
        if (subjects.length === 0) {
            SubjectSelector.innerHTML = '<option value="">-- NO HAY MATERIAS ASIGNADAS --</option>';
        } else {
            const optionsHTML = subjects.map(subject => 
                `<option value="${subject.id}">${subject.nombre}</option>`
            ).join('');
            SubjectSelector.innerHTML = '<option value="">-- SELECCIONE UNA MATERIA --</option>' + optionsHTML;
            SubjectSelector.disabled = false;
        }

    } catch (error) {
        console.error('Error loading subjects:', error);
        SubjectSelector.innerHTML = '<p>ERROR DE CONEXIÓN.</p>';
    }
}

// 3. Cargar Lista de Alumnos (Genera la tabla con botones)
async function getStudentList(classId, subjectId) {
    const StudentListContainer = document.getElementById('StudentListContainer');
    StudentListContainer.innerHTML = '<p>Cargando alumnos...</p>';

    if (!classId || !subjectId) {
        StudentListContainer.innerHTML = '<p>Selecciona un curso y una materia para cargar la lista de alumnos</p>';
        return;
    }

    try {
        const studentsResponse = await fetch(`${API_BASE}/class-students/${classId}`); // Endpoint renombrado
        const students = await studentsResponse.json();

        if (students.length === 0) {
            StudentListContainer.innerHTML = '<p>No se encontraron alumnos para este curso.</p>';
            return;
        }

        let tableHTML = `
            <table class="AttendanceTable">
                <thead>
                    <tr>
                        <th>APELLIDO, NOMBRE</th>
                        <th>PRESENTE</th>
                        <th>AUSENTE</th>
                        <th>TARDE</th>
                        <th>RET. C/ AV.</th>
                        <th>ABS. JUST.</th> <th>ÚLTIMO REGISTRO</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (const student of students) {
            const recentResponse = await fetch(`${API_BASE}/recent-attendance/${student.id}/${classId}/${subjectId}`); // Endpoint renombrado
            const recentRecord = await recentResponse.json();
            const lastStatus = recentRecord.estado || 'N/A';
            
            const getActiveClass = (status) => lastStatus === status ? 'ACTIVE' : '';

            tableHTML += `
                <tr>
                    <td style="text-align: left;">${student.apellido}, ${student.nombre}</td>
                    <td><button class="StatusButton ${getActiveClass('P')}" data-student-id="${student.id}" data-status="P" onclick="saveAttendance(this)">P</button></td>
                    <td><button class="StatusButton ${getActiveClass('A')}" data-student-id="${student.id}" data-status="A" onclick="saveAttendance(this)">A</button></td>
                    <td><button class="StatusButton ${getActiveClass('T')}" data-student-id="${student.id}" data-status="T" onclick="saveAttendance(this)">T</button></td>
                    <td><button class="StatusButton ${getActiveClass('RA')}" data-student-id="${student.id}" data-status="RA" onclick="saveAttendance(this)">RA</button></td>
                    <td><button class="StatusButton ${getActiveClass('AP')}" data-student-id="${student.id}" data-status="AP" onclick="saveAttendance(this)">AP</button></td> <td><span class="last_status">${lastStatus}</span></td>
                </tr>
            `;
        }

        tableHTML += `</tbody></table>`;
        StudentListContainer.innerHTML = tableHTML;

    } catch (error) {
        console.error('Error loading students:', error);
        StudentListContainer.innerHTML = '<p>ERROR AL CARGAR LA LISTA DE ALUMNOS.</p>';
    }
}

// 4. Guardar Asistencia (Al hacer click en el botón de estado)
window.saveAttendance = async function(buttonElement) {
    const ClassSelector = document.getElementById('ClassSelector');
    const SubjectSelector = document.getElementById('SubjectSelector');
    const FilterStart = document.getElementById('FilterStart');
    const FilterEnd = document.getElementById('FilterEnd');
    
    const student_id = buttonElement.dataset.studentId;
    const status = buttonElement.dataset.status;
    const class_id = ClassSelector.value;
    const subject_id = SubjectSelector.value;

    if (!class_id || !subject_id) {
        alert('¡ERROR! Debe seleccionar un Curso y una Materia.');
        return;
    }
    
    const data = { student_id, class_id, status, subject_id };

    try {
        const response = await fetch(`${API_BASE}/save-attendance`, { // Endpoint renombrado
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const row = buttonElement.closest('tr');
        const lastStatusCell = row.querySelector('.last_status');
        
        if (response.ok) {
            row.querySelectorAll('.StatusButton').forEach(b => b.classList.remove('ACTIVE'));
            buttonElement.classList.add('ACTIVE');
            lastStatusCell.textContent = status;
            
            // Recargar historial para ver el nuevo registro
            loadRecords(FilterStart.value, FilterEnd.value); 
        } else {
            const errorData = await response.json();
            alert(`ERROR SAVING RECORD. Server Message: ${errorData.message}`);
        }

    } catch (error) {
        console.error('Error saving attendance:', error);
        alert('CRITICAL CONNECTION ERROR. Check server status.');
    }
}

// 5. Cargar Historial de Registros
async function loadRecords(startDate, endDate) {
    const HistoryTableWrapper = document.getElementById('HistoryTableWrapper');
    HistoryTableWrapper.innerHTML = '<p>Cargando registros...</p>';

    if (!startDate || !endDate) {
         HistoryTableWrapper.innerHTML = '<p>Ingrese las fechas para ver el historial.</p>';
         return;
    }

    try {
        const url = `${API_BASE}/attendance-history?start_date=${startDate}&end_date=${endDate}`; // Endpoint y params renombrados
        const response = await fetch(url);
        const records = await response.json();

        if (records.length === 0) {
            HistoryTableWrapper.innerHTML = '<p>No se encontraron registros en el rango de fechas.</p>';
            return;
        }

        let tableHTML = `
            <table class="RecordTable">
                <thead>
                    <tr>
                        <th>FECHA Y HORA</th>
                        <th>ALUMNO</th>
                        <th>CURSO</th>
                        <th>MATERIA</th>
                        <th>ESTADO</th>
                        <th>ACCIÓN</th> </tr>
                </thead>
                <tbody>
        `;

        records.forEach(rec => {
            tableHTML += `
                <tr>
                    <td>${rec.formatted_date}</td>
                    <td>${rec.student_lastname}, ${rec.student_name}</td>
                    <td>${rec.class_name}</td>
                    <td>${rec.subject_name}</td>
                    <td class="StatusCell-${rec.estado}">${rec.estado}</td>
                    <td class="RecordActions" style="text-align: center;">
                        <button class="EditBtn" onclick="editRecord(${rec.record_id})">E</button>
                        <button class="DeleteBtn" onclick="deleteRecord(${rec.record_id})">X</button>
                    </td>
                </tr>
            `;
        });

        tableHTML += `</tbody></table>`;
        HistoryTableWrapper.innerHTML = tableHTML;

    } catch (error) {
        console.error('Error loading records:', error);
        HistoryTableWrapper.innerHTML = '<p>ERROR DE CONEXIÓN AL CARGAR EL HISTORIAL.</p>';
    }
}

// 6. Editar el Registro (Botón E)
window.editRecord = async function(recordId) {
    const FilterStart = document.getElementById('FilterStart');
    const FilterEnd = document.getElementById('FilterEnd');

    const newStatus = prompt(`EDITAR REGISTRO ID ${recordId}.\nIngrese el nuevo estado: ${VALID_STATUSES.join(', ')}`);
    
    if (!newStatus) {
        return; 
    }
    
    const statusUpper = newStatus.toUpperCase();

    if (!VALID_STATUSES.includes(statusUpper)) {
        alert(`Estado "${newStatus}" inválido. Por favor, use uno de: ${VALID_STATUSES.join(', ')}`);
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/attendance-record/${recordId}`, { // Endpoint renombrado
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ status: statusUpper }) // Campo de body renombrado
        });

        if (response.ok) {
            alert('✅ Registro actualizado con éxito.');
            loadRecords(FilterStart.value, FilterEnd.value);
        } else {
            const errorData = await response.json();
            alert(`❌ Error al actualizar: ${errorData.message}`);
        }
    } catch (error) {
        console.error('Error editing record:', error);
        alert('❌ CRITICAL CONNECTION ERROR during editing.');
    }
}

// 7. Eliminar el Registro (Botón X)
window.deleteRecord = async function(recordId) {
    if (!confirm(`¿CONFIRMAR ELIMINACIÓN del registro ID ${recordId}?`)) {
        return;
    }

    const FilterStart = document.getElementById('FilterStart');
    const FilterEnd = document.getElementById('FilterEnd');

    try {
        const response = await fetch(`${API_BASE}/attendance-record/${recordId}`, { // Endpoint renombrado
            method: 'DELETE'
        });

        if (response.ok) {
            alert('🗑️ Registro eliminado con éxito.');
            loadRecords(FilterStart.value, FilterEnd.value);
        } else {
            const errorData = await response.json();
            alert(`❌ Error al eliminar: ${errorData.message}`);
        }
    } catch (error) {
        console.error('Error deleting record:', error);
        alert('❌ CRITICAL CONNECTION ERROR during deletion.');
    }
}


// 8. Configurar fechas por defecto
function setDefaultDates() {
    const FilterStart = document.getElementById('FilterStart');
    const FilterEnd = document.getElementById('FilterEnd');
    
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const dateFormat = (date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    FilterEnd.value = dateFormat(today);
    FilterStart.value = dateFormat(thirtyDaysAgo);
}


// --- EVENT LISTENER PRINCIPAL ---

document.addEventListener('DOMContentLoaded', () => {
    // Selectors
    const ClassSelector = document.getElementById('ClassSelector');
    const SubjectSelector = document.getElementById('SubjectSelector');
    const FilterStart = document.getElementById('FilterStart');
    const FilterEnd = document.getElementById('FilterEnd');
    const ApplyFilterButton = document.getElementById('ApplyFilterButton');
    
    const NewStudentForm = document.getElementById('NewStudentForm');
    const NewStudentClassSelector = document.getElementById('NewStudentClassSelector');
    const NewNameInput = document.getElementById('NewNameInput'); 
    const NewLastNameInput = document.getElementById('NewLastNameInput'); 
    const ResponseMsg = document.getElementById('ResponseMsg');

    // 1. Selector de Curso
    ClassSelector.addEventListener('change', () => {
        const classId = ClassSelector.value;
        const subjectId = SubjectSelector.value;
        loadSubjects(classId);
        getStudentList(classId, subjectId);
    });

    // 2. Selector de Materia
    SubjectSelector.addEventListener('change', () => {
        const classId = ClassSelector.value;
        const subjectId = SubjectSelector.value;
        getStudentList(classId, subjectId);
    });
    
    // 3. Botón Filtrar Historial
    ApplyFilterButton.addEventListener('click', () => {
        const start = FilterStart.value;
        const end = FilterEnd.value;
        loadRecords(start, end);
    });

    // 4. Alta de nuevo alumno (Formulario)
    NewStudentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            name: NewNameInput.value, // Nombre de campo renombrado
            lastname: NewLastNameInput.value, // Nombre de campo renombrado
            class_id: NewStudentClassSelector.value // Nombre de campo renombrado
        };

        if (!data.name || !data.lastname || !data.class_id) {
            ResponseMsg.textContent = 'COMPLETE TODOS LOS CAMPOS.';
            ResponseMsg.style.color = '#e74c3c';
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/new-student`, { // Endpoint renombrado
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                ResponseMsg.textContent = `✅ ÉXITO: ${result.message} (ID: ${result.id})`;
                ResponseMsg.style.color = '#2ecc71';
                
                NewStudentForm.reset();
                
                // Recargar lista si el curso coincide
                if (ClassSelector.value === data.class_id) {
                    const subjectId = SubjectSelector.value;
                    getStudentList(data.class_id, subjectId);
                }
                
            } else {
                ResponseMsg.textContent = `❌ ERROR: ${result.message}`;
                ResponseMsg.style.color = '#e74c3c';
            }
        } catch (error) {
            ResponseMsg.textContent = '❌ ERROR DE RED O CONEXIÓN CON EL SERVIDOR.';
            ResponseMsg.style.color = '#e74c3c';
        }
    });


    // --- INICIALIZACIÓN ---
    
    loadClasses();
    setDefaultDates(); 
    loadRecords(FilterStart.value, FilterEnd.value);
});