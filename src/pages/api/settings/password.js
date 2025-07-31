// src/pages/api/settings/password.js
import { initializeDatabase } from '../../../db/db.js';
import pkg from 'jsonwebtoken';
const { verify } = pkg;
import bcrypt from 'bcryptjs'; // Importa bcryptjs

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
            console.error("Error al verificar JWT en /api/settings/password:", jwtError);
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

        const { currentPassword, newPassword } = await request.json();

        if (!currentPassword || !newPassword) {
            return new Response(JSON.stringify({ message: 'Contraseña actual y nueva son requeridas.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (newPassword.length < 6) {
            return new Response(JSON.stringify({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const db = await initializeDatabase();

        // Obtener la contraseña hasheada actual del usuario
        const user = await db.get(`SELECT password FROM users WHERE id = ?`, userId);

        if (!user) {
            return new Response(JSON.stringify({ message: 'Usuario no encontrado.' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Comparar la contraseña actual proporcionada con la hasheada en la DB
        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return new Response(JSON.stringify({ message: 'Contraseña actual incorrecta.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Hashear la nueva contraseña
        const hashedNewPassword = await bcrypt.hash(newPassword, 10); // 10 es el saltRounds

        // Actualizar la contraseña en la base de datos
        await db.run(
            `UPDATE users SET password = ? WHERE id = ?`,
            hashedNewPassword,
            userId
        );

        return new Response(JSON.stringify({ message: 'Contraseña cambiada exitosamente.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error en /api/settings/password:", error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor al cambiar la contraseña.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}