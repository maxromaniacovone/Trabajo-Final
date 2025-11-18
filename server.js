const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const webServer = express();
const PORT = 3000;

webServer.use(cors());
webServer.use(express.json());

const dbConfiguration = {
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'asistencia',
    port: 3306,
};

const databaseConnection = mysql.createConnection(dbConfiguration);

databaseConnection.connect(error => {
    if (error) {
        console.error('Error de conexión a la Base de Datos:', error.stack);
        console.log('ERROR: Verifica el estado de MySQL (XAMPP/WAMP).');
        return;
    }
    console.log(`Servidor conectado a la DB "${dbConfiguration.database}".`);
});

webServer.get('/clases-disponibles', (peticion, respuesta) => {
    databaseConnection.query('SELECT id, nombre FROM cursos ORDER BY id', (error, resultados) => {
        if (error) return respuesta.status(500).json({ mensaje: 'Error al obtener las clases.' });
        respuesta.json(resultados);
    });
});

webServer.get('/materias-por-clase/:identificadorClase', (peticion, respuesta) => {
    const { identificadorClase } = peticion.params;
    const consultaSQL = `
        SELECT m.id, m.nombre
        FROM materias m
        JOIN curso_materia cm ON m.id = cm.materia_id
        WHERE cm.curso_id = ?
        ORDER BY m.nombre`;
    databaseConnection.query(consultaSQL, [identificadorClase], (error, resultados) => {
        if (error) return respuesta.status(500).json({ mensaje: 'Error al obtener las materias.' });
        respuesta.json(resultados);
    });
});

webServer.get('/alumnos-por-clase/:identificadorClase', (peticion, respuesta) => {
    const { identificadorClase } = peticion.params;
    const consultaSQL = 'SELECT id, nombre, apellido FROM alumnos WHERE curso_id = ? ORDER BY apellido';
    databaseConnection.query(consultaSQL, [identificadorClase], (error, resultados) => {
        if (error) return respuesta.status(500).json({ mensaje: 'Error al obtener los alumnos.' });
        respuesta.json(resultados);
    });
});

webServer.get('/asistencia-reciente/:identificadorAlumno/:identificadorClase/:identificadorMateria', (peticion, respuesta) => {
    const { identificadorAlumno, identificadorClase, identificadorMateria } = peticion.params;
    const consultaSQL = `
        SELECT estado 
        FROM asistencia 
        WHERE alumno_id = ? AND curso_id = ? AND materia_id = ?
        ORDER BY fecha DESC LIMIT 1`;
    databaseConnection.query(consultaSQL, [identificadorAlumno, identificadorClase, identificadorMateria], (error, resultados) => {
        if (error) return respuesta.status(500).json({ mensaje: 'Error al obtener la asistencia reciente.' });
        if (resultados.length === 0) return respuesta.json({});
        respuesta.json(resultados[0]);
    });
});

webServer.post('/registrar-asistencia', (peticion, respuesta) => {
    const { alumno_id, curso_id, estado_asistencia, materia_id } = peticion.body;
    
    const estadosValidos = ['P', 'A', 'T', 'RA', 'AP'];
    if (!estadosValidos.includes(estado_asistencia)) {
        return respuesta.status(400).json({ mensaje: `Estado inválido: ${estado_asistencia}.` });
    }

    if (!alumno_id || !curso_id || !materia_id || !estado_asistencia) {
        return respuesta.status(400).json({ mensaje: 'Faltan campos requeridos.' });
    }

    const consultaSQL = 'INSERT INTO asistencia (alumno_id, curso_id, materia_id, estado) VALUES (?, ?, ?, ?)';
    databaseConnection.query(consultaSQL, [alumno_id, curso_id, materia_id, estado_asistencia], (error, resultado) => {
        if (error) {
            console.error('Error al guardar asistencia:', error);
            return respuesta.status(500).json({ mensaje: 'Error al insertar registro en la DB.' });
        }
        respuesta.status(201).json({ mensaje: 'Registro de asistencia guardado con éxito.', id: resultado.insertId });
    });
});

webServer.get('/historial-asistencia', (peticion, respuesta) => {
    const { fecha_inicio, fecha_fin } = peticion.query;

    let consultaSQL = `
        SELECT 
            a.id AS identificador_registro,
            a.fecha,
            DATE_FORMAT(a.fecha, '%d/%m/%Y %H:%i') AS fecha_formateada,
            a.estado,
            al.nombre AS nombre_alumno,
            al.apellido AS apellido_alumno,
            c.nombre AS nombre_clase,
            m.nombre AS nombre_materia
        FROM asistencia a
        JOIN alumnos al ON a.alumno_id = al.id
        JOIN cursos c ON a.curso_id = c.id
        JOIN materias m ON a.materia_id = m.id
    `;
    let parametros = [];

    if (fecha_inicio && fecha_fin) {
        consultaSQL += ' WHERE DATE(a.fecha) BETWEEN ? AND ?';
        parametros = [fecha_inicio, fecha_fin];
    }
    
    consultaSQL += ' ORDER BY a.fecha DESC';

    databaseConnection.query(consultaSQL, parametros, (error, resultados) => {
        if (error) return respuesta.status(500).json({ mensaje: 'Error al obtener el historial.' });
        respuesta.json(resultados);
    });
});

webServer.put('/registro-asistencia/:id', (peticion, respuesta) => {
    const identificadorRegistro = peticion.params.id;
    const { nuevo_estado } = peticion.body;

    const estadosValidos = ['P', 'A', 'T', 'RA', 'AP'];
    if (!estadosValidos.includes(nuevo_estado)) {
        return respuesta.status(400).json({ mensaje: `Estado inválido: ${nuevo_estado}. Las opciones válidas son ${estadosValidos.join(', ')}.` });
    }

    const consultaSQL = 'UPDATE asistencia SET estado = ?, fecha = CURRENT_TIMESTAMP WHERE id = ?';
    databaseConnection.query(consultaSQL, [nuevo_estado, identificadorRegistro], (error, resultado) => {
        if (error) {
            console.error('Error al actualizar registro:', error);
            return respuesta.status(500).json({ mensaje: 'Error al actualizar el registro.' });
        }
        if (resultado.affectedRows === 0) return respuesta.status(404).json({ mensaje: 'Registro no encontrado.' });
        respuesta.json({ mensaje: 'Registro de asistencia actualizado con éxito.' });
    });
});

webServer.delete('/registro-asistencia/:id', (peticion, respuesta) => {
    const identificadorRegistro = peticion.params.id;

    const consultaSQL = 'DELETE FROM asistencia WHERE id = ?';
    databaseConnection.query(consultaSQL, [identificadorRegistro], (error, resultado) => {
        if (error) {
            console.error('Error al eliminar registro:', error);
            return respuesta.status(500).json({ mensaje: 'Error al eliminar el registro.' });
        }
        if (resultado.affectedRows === 0) return respuesta.status(404).json({ mensaje: 'Registro no encontrado.' });
        respuesta.json({ mensaje: 'Registro de asistencia eliminado con éxito.' });
    });
});

webServer.post('/nuevo-alumno', (peticion, respuesta) => {
    const { nombre_alumno, apellido_alumno, id_clase } = peticion.body;
    
    if (!nombre_alumno || !apellido_alumno || !id_clase) {
        return respuesta.status(400).json({ mensaje: 'Faltan campos: nombre_alumno, apellido_alumno, o id_clase.' });
    }

    const consultaSQL = 'INSERT INTO alumnos (nombre, apellido, curso_id) VALUES (?, ?, ?)';
    databaseConnection.query(consultaSQL, [nombre_alumno, apellido_alumno, id_clase], (error, resultado) => {
        if (error) {
            console.error('Error al añadir alumno:', error);
            return respuesta.status(500).json({ mensaje: 'Error al insertar nuevo alumno en la DB.' });
        }
        respuesta.status(201).json({ mensaje: 'Alumno añadido con éxito.', id: resultado.insertId });
    });
});

webServer.use((peticion, respuesta) => {
    respuesta.status(404).json({ mensaje: 'Error 404: La ruta solicitada no es igual a ninguna definida.' });
});

webServer.listen(PORT, () => {
    console.log(`Servidor en ejecución en http://localhost:${PORT}`);
});
