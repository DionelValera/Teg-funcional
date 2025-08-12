// src/pages/api/data/export.js
import { initializeDatabase } from '../../../db/db.js';
import pkg from 'jsonwebtoken';
const { verify } = pkg;

// Define el secreto JWT (debe ser el mismo que usas en tus archivos Astro)
const JWT_SECRET = '0402Dionel.*'; 

export async function GET({ cookies }) {
    try {
        const token = cookies.get('auth_token')?.value;

        if (!token) {
            return new Response(JSON.stringify({ message: 'No autorizado: Token no proporcionado.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        let decoded;
        try {
            decoded = verify(token, JWT_SECRET);
        } catch (jwtError) {
            console.error("Error al verificar JWT en /api/data/export:", jwtError);
            return new Response(JSON.stringify({ message: 'No autorizado: Token inválido.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const userId = decoded.userId;
        if (!userId) {
            return new Response(JSON.stringify({ message: 'Error: ID de usuario no encontrado en el token.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const db = await initializeDatabase();

        // Obtener todas las transacciones del usuario
        const transactions = await db.all(
            `SELECT * FROM transactions WHERE user_id = ?`,
            userId
        );

        // Obtener todas las cuentas del usuario
        const accounts = await db.all(
            `SELECT * FROM accounts WHERE user_id = ?`,
            userId
        );

        // Puedes añadir más tablas si es necesario (ej. categorías, empresas, etc.)
        // const categories = await db.all(`SELECT * FROM categories WHERE user_id = ?`, userId);

        const exportData = {
            userId: userId,
            timestamp: new Date().toISOString(),
            transactions: transactions,
            accounts: accounts,
            // categories: categories,
        };

        const jsonString = JSON.stringify(exportData, null, 2); // Formateado para legibilidad

        return new Response(jsonString, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': 'attachment; filename="contabilito_data.json"', // Fuerza la descarga
            }
        });

    } catch (error) {
        console.error("Error en /api/data/export:", error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor al exportar datos.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}