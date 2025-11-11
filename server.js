const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const SERVER_PORT = 3000;

app.use(cors());
app.use(express.json());

// -------------------------------------------------------------------
// 1. CONFIGURACIÓN DB
// -------------------------------------------------------------------
const dbConfig = {
    host: '127.0.0.1', 
    user: 'root', 
    password: '',     // <<-- Confirma tu contraseña de MySQL aquí
    database: 'asistencia', // <<-- Nuevo nombre de la DB
    port: 3306, 
};

const dbClient = mysql.createConnection(dbConfig);

dbClient.connect(err => {
    if (err) {
        console.error('Database connection error:', err.stack);
        console.log('🔴 ERROR: Check MySQL (XAMPP/WAMP) status.');
        return;
    }
    console.log(`✅ Server connected to DB "${dbConfig.database}".`);
});


// -------------------------------------------------------------------
// 2. ENDPOINTS DE DATOS
// -------------------------------------------------------------------

// Get all Classes
app.get('/all-classes', (req, res) => {
    dbClient.query('SELECT id, nombre FROM cursos ORDER BY id', (err, results) => {
        if (err) return res.status(500).json({ message: 'Error retrieving classes.' });
        res.json(results);
    });
});

// Get subjects by Class ID
app.get('/class-subjects/:classId', (req, res) => {
    const { classId } = req.params;
    const sql = `
        SELECT m.id, m.nombre
        FROM materias m
        JOIN curso_materia cm ON m.id = cm.materia_id
        WHERE cm.curso_id = ?
        ORDER BY m.nombre`;
    dbClient.query(sql, [classId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error retrieving subjects.' });
        res.json(results);
    });
});

// Get students by Class ID
app.get('/class-students/:classId', (req, res) => {
    const { classId } = req.params;
    const sql = 'SELECT id, nombre, apellido FROM alumnos WHERE curso_id = ? ORDER BY apellido';
    dbClient.query(sql, [classId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error retrieving students.' });
        res.json(results);
    });
});

// Get most recent attendance for a student/subject
app.get('/recent-attendance/:studentId/:classId/:subjectId', (req, res) => {
    const { studentId, classId, subjectId } = req.params;
    const sql = `
        SELECT estado 
        FROM asistencia 
        WHERE alumno_id = ? AND curso_id = ? AND materia_id = ?
        ORDER BY fecha DESC LIMIT 1`;
    dbClient.query(sql, [studentId, classId, subjectId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error retrieving recent attendance.' });
        if (results.length === 0) return res.json({});
        res.json(results[0]);
    });
});

// Register attendance
app.post('/save-attendance', (req, res) => {
    const { student_id, class_id, status, subject_id } = req.body;
    
    const validStatuses = ['P', 'A', 'T', 'RA', 'AP']; // <<-- VALIDACIÓN ACTUALIZADA
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid status: ${status}.` });
    }

    if (!student_id || !class_id || !subject_id || !status) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    const sql = 'INSERT INTO asistencia (alumno_id, curso_id, materia_id, estado) VALUES (?, ?, ?, ?)';
    dbClient.query(sql, [student_id, class_id, subject_id, status], (err, result) => {
        if (err) {
            console.error('Error saving attendance:', err);
            return res.status(500).json({ message: 'Error inserting record into DB.' });
        }
        res.status(201).json({ message: 'Attendance record saved successfully.', id: result.insertId });
    });
});


// Get attendance history (filtered by date)
app.get('/attendance-history', (req, res) => {
    const { start_date, end_date } = req.query; // Query parameter names changed

    let sql = `
        SELECT 
            a.id AS record_id,
            a.fecha,
            DATE_FORMAT(a.fecha, '%d/%m/%Y %H:%i') AS formatted_date,
            a.estado,
            al.nombre AS student_name,
            al.apellido AS student_lastname,
            c.nombre AS class_name,
            m.nombre AS subject_name
        FROM asistencia a
        JOIN alumnos al ON a.alumno_id = al.id
        JOIN cursos c ON a.curso_id = c.id
        JOIN materias m ON a.materia_id = m.id
    `;
    let params = [];

    if (start_date && end_date) {
        sql += ' WHERE DATE(a.fecha) BETWEEN ? AND ?';
        params = [start_date, end_date];
    }
    
    sql += ' ORDER BY a.fecha DESC';

    dbClient.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ message: 'Error retrieving history.' });
        res.json(results);
    });
});


// -------------------------------------------------------------------
// 3. ENDPOINTS PARA EDICIÓN Y BORRADO (GESTIÓN DE REGISTROS)
// -------------------------------------------------------------------

// EDIT record status (Button E)
app.put('/attendance-record/:id', (req, res) => {
    const recordId = req.params.id;
    const { status } = req.body; // New field name

    const validStatuses = ['P', 'A', 'T', 'RA', 'AP']; // <<-- VALIDACIÓN ACTUALIZADA
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid status: ${status}. Valid options are ${validStatuses.join(', ')}.` });
    }

    // Update status and set current date/time for modification
    const sql = 'UPDATE asistencia SET estado = ?, fecha = CURRENT_TIMESTAMP WHERE id = ?';
    dbClient.query(sql, [status, recordId], (err, result) => {
        if (err) {
            console.error('Error updating record:', err);
            return res.status(500).json({ message: 'Error updating record.' });
        }
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Record not found.' });
        res.json({ message: 'Attendance record updated successfully.' });
    });
});

// DELETE a record (Button X)
app.delete('/attendance-record/:id', (req, res) => {
    const recordId = req.params.id;

    const sql = 'DELETE FROM asistencia WHERE id = ?';
    dbClient.query(sql, [recordId], (err, result) => {
        if (err) {
            console.error('Error deleting record:', err);
            return res.status(500).json({ message: 'Error deleting record.' });
        }
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Record not found.' });
        res.json({ message: 'Attendance record deleted successfully.' });
    });
});


// -------------------------------------------------------------------
// 4. ENDPOINTS PARA ALTA DE ALUMNO
// -------------------------------------------------------------------

// Add new student
app.post('/new-student', (req, res) => {
    const { name, lastname, class_id } = req.body; // New field names
    
    if (!name || !lastname || !class_id) {
        return res.status(400).json({ message: 'Missing fields: name, lastname, or class_id.' });
    }

    const sql = 'INSERT INTO alumnos (nombre, apellido, curso_id) VALUES (?, ?, ?)';
    dbClient.query(sql, [name, lastname, class_id], (err, result) => {
        if (err) {
            console.error('Error adding student:', err);
            return res.status(500).json({ message: 'Error inserting new student into DB.' });
        }
        res.status(201).json({ message: 'Student added successfully.', id: result.insertId });
    });
});

app.listen(SERVER_PORT, () => {
    console.log(`🚀 Server running on http://localhost:${SERVER_PORT}`);
});