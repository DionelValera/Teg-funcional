// src/pages/api/companies/switch.js
import { initializeDatabase } from '../../../db/db.js';
import pkg from 'jsonwebtoken';
const { verify } = pkg;

const JWT_SECRET = '0402Dionel.*'; // Asegúrate de que esta clave sea la misma que usas en otros lugares

export async function POST({ request, cookies }) {
    console.log('API: /companies/switch - Solicitud recibida.');
    try {
        const db = await initializeDatabase();
        console.log('API: DB inicializada.');

        // 1. Verificar autenticación del usuario
        const token = cookies.get('auth_token')?.value;
        if (!token) {
            console.log('API: No autenticado - Token no encontrado.');
            return new Response(JSON.stringify({ message: 'No autenticado.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let decoded;
        try {
            decoded = verify(token, JWT_SECRET);
            console.log('API: Token verificado. Decoded userId:', decoded.userId);
        } catch (error) {
            console.error('API: Error al verificar token:', error);
            return new Response(JSON.stringify({ message: 'Token inválido o expirado.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const userId = decoded.userId;
        if (!userId) {
            console.log('API: ID de usuario no encontrado en el token.');
            return new Response(JSON.stringify({ message: 'ID de usuario no encontrado en el token.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 2. Obtener el companyId del cuerpo de la solicitud
        const { companyId } = await request.json();
        console.log('API: companyId recibido en la solicitud:', companyId);


        if (!companyId) {
            console.log('API: ID de empresa no proporcionado para el cambio.');
            return new Response(JSON.stringify({ message: 'El ID de la empresa es requerido para cambiar.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 3. Verificar que el usuario tiene acceso a la empresa que intenta seleccionar
        const userHasAccess = await db.get(
            `SELECT 1 FROM user_company_roles WHERE user_id = ? AND company_id = ?`,
            userId,
            companyId
        );

        if (!userHasAccess) {
            console.warn(`API: Usuario ${userId} intentó cambiar a empresa ${companyId} sin permisos.`);
            return new Response(JSON.stringify({ message: 'No tienes permisos para acceder a esta empresa.' }), {
                status: 403, // Forbidden
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 4. Actualizar la cookie 'active_company_id'
        cookies.set('active_company_id', companyId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 30, // 30 días de duración
            path: '/',
            sameSite: 'Lax',
        });
        console.log(`API: Cookie 'active_company_id' establecida a ${companyId}.`);

        return new Response(JSON.stringify({ message: 'Empresa activa cambiada exitosamente.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('API: Error general en el endpoint /companies/switch:', error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor al cambiar de empresa.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
