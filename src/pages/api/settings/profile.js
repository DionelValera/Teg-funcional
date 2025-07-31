// src/pages/api/settings/profile.js
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
            console.error("Error al verificar JWT en /api/settings/profile:", jwtError);
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

        const { username, email } = await request.json();

        if (!username || !email) {
            return new Response(JSON.stringify({ message: 'Nombre de usuario y correo electrónico son requeridos.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const db = await initializeDatabase();

        // Actualizar el nombre de usuario y el correo electrónico en la base de datos
        await db.run(
            `UPDATE users SET username = ?, email = ? WHERE id = ?`,
            username,
            email,
            userId
        );

        return new Response(JSON.stringify({ message: 'Perfil actualizado exitosamente.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error en /api/settings/profile:", error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor al actualizar el perfil.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}