// src/pages/api/settings/notifications.js
import { initializeDatabase } from '../../../db/db.js';
import pkg from 'jsonwebtoken';
const { verify } = pkg;

// Define el secreto JWT (debe ser el mismo que usas en tus archivos Astro)
const JWT_SECRET = '0402Dionel.*'; 

// Función para verificar el token y obtener el userId
async function getUserIdFromToken(cookies) {
    const token = cookies.get('auth_token')?.value;
    if (!token) {
        return { userId: null, response: new Response(JSON.stringify({ message: 'No autorizado: Token no proporcionado.' }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
    }
    try {
        const decoded = verify(token, JWT_SECRET);
        if (!decoded.userId) {
            return { userId: null, response: new Response(JSON.stringify({ message: 'Error: ID de usuario no encontrado en el token.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }) };
        }
        return { userId: decoded.userId, response: null };
    } catch (jwtError) {
        console.error("Error al verificar JWT en /api/settings/notifications:", jwtError);
        return { userId: null, response: new Response(JSON.stringify({ message: 'No autorizado: Token inválido.' }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
    }
}

export async function GET({ cookies }) {
    try {
        const { userId, response } = await getUserIdFromToken(cookies);
        if (response) return response; // Si hay un error de autenticación, devolver la respuesta de error

        const db = await initializeDatabase();

        // Obtener las preferencias de notificación del usuario
        const settings = await db.get(
            `SELECT email_notifications, in_app_notifications FROM user_settings WHERE user_id = ?`,
            userId
        );

        if (settings) {
            return new Response(JSON.stringify({
                emailNotifications: settings.email_notifications === 1, // Convertir a booleano
                inAppNotifications: settings.in_app_notifications === 1
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            // Si no hay configuración, devolver valores por defecto
            return new Response(JSON.stringify({
                emailNotifications: false,
                inAppNotifications: false,
                message: 'No se encontraron preferencias, devolviendo valores por defecto.'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

    } catch (error) {
        console.error("Error en GET /api/settings/notifications:", error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor al cargar preferencias de notificación.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function POST({ request, cookies }) {
    try {
        const { userId, response } = await getUserIdFromToken(cookies);
        if (response) return response; // Si hay un error de autenticación, devolver la respuesta de error

        const { emailNotifications, inAppNotifications } = await request.json();

        // Convertir booleanos a enteros para SQLite (0 o 1)
        const emailNotifInt = emailNotifications ? 1 : 0;
        const inAppNotifInt = inAppNotifications ? 1 : 0;

        const db = await initializeDatabase();

        // Insertar o actualizar las preferencias de notificación
        await db.run(
            `INSERT INTO user_settings (user_id, email_notifications, in_app_notifications)
             VALUES (?, ?, ?)
             ON CONFLICT(user_id) DO UPDATE SET
                email_notifications = EXCLUDED.email_notifications,
                in_app_notifications = EXCLUDED.in_app_notifications`,
            userId,
            emailNotifInt,
            inAppNotifInt
        );

        return new Response(JSON.stringify({ message: 'Preferencias de notificación guardadas exitosamente.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error en POST /api/settings/notifications:", error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor al guardar preferencias de notificación.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}