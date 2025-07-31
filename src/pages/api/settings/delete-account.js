// src/pages/api/settings/delete-account.js
import { initializeDatabase } from '../../../db/db.js';
import pkg from 'jsonwebtoken';
const { verify } = pkg;

// Define el secreto JWT (debe ser el mismo que usas en tus archivos Astro)
const JWT_SECRET = '0402Dionel.*'; 

export async function POST({ request, cookies }) {
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
            console.error("Error al verificar JWT en /api/settings/delete-account:", jwtError);
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

        // Eliminar al usuario de la tabla 'users'
        // Si tus tablas de transacciones, cuentas, etc., tienen claves foráneas
        // con 'ON DELETE CASCADE' referenciando 'users(id)', esto eliminará
        // automáticamente todos los datos relacionados del usuario.
        // Si no, deberás ejecutar eliminaciones para cada tabla relacionada aquí.
        await db.run(`DELETE FROM users WHERE id = ?`, userId);

        // Opcional: Limpiar la cookie de autenticación después de la eliminación exitosa
        cookies.delete('auth_token', { path: '/' });
        cookies.delete('active_company_id', { path: '/' });

        return new Response(JSON.stringify({ message: 'Cuenta eliminada exitosamente.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error en /api/settings/delete-account:", error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor al eliminar la cuenta.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}