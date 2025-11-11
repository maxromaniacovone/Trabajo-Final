CONFIGURACIÓN INICIAL

A. Base de Datos (MySQL)

Abrir server.js y confirmar que 'database' apunta a 'sistema_escolar'.

Ejecutar el script db.sql en tu cliente MySQL para crear la base de datos 'sistema_escolar' y las tablas.

B. Servidor (Node.js)

Abrir la terminal en la carpeta del proyecto.

Instalar dependencias necesarias:

npm install express mysql2 cors

Instalar nodemon (Recomendado para desarrollo):

npm install -D nodemon

INICIO DEL SISTEMA

A. Iniciar el Servidor API

El servidor debe estar activo para que el frontend funcione.

nodemon server.js

La consola debe mostrar: conexión a "sistema_escolar" exitosa. y Servidor corriendo en http://localhost:3000.

B. Acceder a la Interfaz

Abrir el archivo index.html directamente en el navegador.

ARCHIVOS CLAVE

db.sql - Script para crear la estructura de la base de datos. server.js - Conexión a MySQL y definición de todos los endpoints. main.js - Lógica del frontend y llamadas fetch a server.js. index.html - Interfaz de usuario. style.css - Estilos CSS.

