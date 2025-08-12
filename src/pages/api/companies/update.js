// src/pages/api/companies/update.astro
import type { APIRoute } from 'astro';
import pkg from 'jsonwebtoken';
const { verify } = pkg;
import { initializeDatabase } from '../../db/db.js';
import { dbConfig } from '../../db/config';

// Define la clave secreta de tu JWT
const JWT_SECRET = '0402Dionel.*';

export const PUT: APIRoute = async ({ request, cookies }) => {
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

    const { companyId, newCompanyName } = data;

    if (!companyId || !newCompanyName) {
        return new Response(JSON.stringify({
            message: 'Faltan campos obligatorios: companyId y newCompanyName.'
        }), { status: 400 });
    }

    if (newCompanyName.length < 3 || newCompanyName.length > 100) {
        return new Response(JSON.stringify({
            message: 'El nombre de la empresa debe tener entre 3 y 100 caracteres.'
        }), { status: 400 });
    }

    try {
        // 3. Inicializar la base de datos
        const db = await initializeDatabase(dbConfig);

        // 4. Verificar si el usuario tiene permiso para editar (rol de owner o admin)
        const userRole = await db.get(
            `SELECT role FROM user_company_roles WHERE user_id = ? AND company_id = ?`,
            userId, companyId
        );

        if (!userRole || (userRole.role !== 'owner' && userRole.role !== 'admin')) {
            return new Response(JSON.stringify({
                message: 'Permiso denegado. Solo el propietario o un administrador pueden editar esta empresa.'
            }), { status: 403 });
        }

        // 5. Actualizar el nombre de la empresa
        await db.run(
            `UPDATE companies SET company_name = ? WHERE id = ?`,
            newCompanyName, companyId
        );

        return new Response(JSON.stringify({
            message: 'El nombre de la empresa se ha actualizado correctamente.',
            companyId: companyId,
            newCompanyName: newCompanyName
        }), { status: 200 });

    } catch (error) {
        console.error("Error al actualizar la empresa:", error);
        return new Response(JSON.stringify({
            message: 'Error interno del servidor al actualizar la empresa.'
        }), { status: 500 });
    }
};
