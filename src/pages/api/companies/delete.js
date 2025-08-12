// src/pages/api/companies/delete.astro
import type { APIRoute } from 'astro';
import pkg from 'jsonwebtoken';
const { verify } = pkg;
import { initializeDatabase } from '../../db/db.js';
import { dbConfig } from '../../db/config';

// Define la clave secreta de tu JWT
const JWT_SECRET = '0402Dionel.*';

export const DELETE: APIRoute = async ({ request, cookies }) => {
    // 1. Verificar la autenticación del usuario
    const token = cookies.get('auth_token')?.value;

    if (!token) {
        return new Response(JSON.stringify({
            message: 'No autorizado. Por favor, inicia sesión.'
        }), { status: 401 });
    }

    let userId: number | null = null;
    try {
        const decoded = verify(token, JWT_SECRET);
        if (typeof decoded === 'object' && decoded !== null && decoded.userId) {
            userId = decoded.userId;
        } else {
            return new Response(JSON.stringify({
                message: 'Token inválido.'
            }), { status: 401 });
        }
    } catch (err) {
        return new Response(JSON.stringify({
            message: 'Token inválido o expirado.'
        }), { status: 401 });
    }

    // 2. Obtener los datos del cuerpo de la solicitud
    let data;
    try {
        data = await request.json();
    } catch (e) {
        return new Response(JSON.stringify({
            message: 'Cuerpo de la solicitud inválido. Se esperaba JSON.'
        }), { status: 400 });
    }

    const { companyId } = data;

    if (!companyId) {
        return new Response(JSON.stringify({
            message: 'Falta el ID de la empresa.'
        }), { status: 400 });
    }

    try {
        // 3. Inicializar la base de datos
        const db = await initializeDatabase(dbConfig);

        // 4. Verificar si el usuario es el propietario para poder eliminar
        const userRole = await db.get(
            `SELECT role FROM user_company_roles WHERE user_id = ? AND company_id = ?`,
            userId, companyId
        );

        if (!userRole || userRole.role !== 'owner') {
            return new Response(JSON.stringify({
                message: 'Permiso denegado. Solo el propietario puede eliminar la empresa.'
            }), { status: 403 });
        }

        // 5. Iniciar una transacción para asegurar que ambas tablas se actualicen
        await db.exec('BEGIN TRANSACTION;');

        // 6. Eliminar la empresa de la tabla 'companies'
        await db.run(
            `DELETE FROM companies WHERE id = ?`,
            companyId
        );

        // 7. Eliminar todas las relaciones de usuarios con esta empresa
        await db.run(
            `DELETE FROM user_company_roles WHERE company_id = ?`,
            companyId
        );

        // 8. Confirmar la transacción
        await db.exec('COMMIT;');

        // Opcional: limpiar la cookie de empresa activa si la empresa eliminada era la activa
        if (cookies.get('active_company_id')?.value === companyId.toString()) {
            cookies.set('active_company_id', '', { expires: new Date(0), path: '/' });
        }

        return new Response(JSON.stringify({
            message: `La empresa con ID ${companyId} y sus relaciones han sido eliminadas correctamente.`
        }), { status: 200 });

    } catch (error) {
        // En caso de error, deshacer la transacción
        await db.exec('ROLLBACK;');
        console.error("Error al eliminar la empresa:", error);
        return new Response(JSON.stringify({
            message: 'Error interno del servidor al eliminar la empresa.'
        }), { status: 500 });
    }
};
