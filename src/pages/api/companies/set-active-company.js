// src/pages/api/companies/set-active-company.js
import { initializeDatabase } from '../../../db/db.js';
import pkg from 'jsonwebtoken';
const { verify } = pkg;

const JWT_SECRET = '0402Dionel.*'; // MISMA CLAVE SECRETA

export async function POST({ request, cookies }) {
    try {
        const db = await initializeDatabase();

        // 1. Verificar autenticación del usuario
        const token = cookies.get('auth_token')?.value;
        if (!token) {
            return new Response(JSON.stringify({ message: 'No autenticado.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let decoded;
        try {
            decoded = verify(token, JWT_SECRET);
        } catch (error) {
            return new Response(JSON.stringify({ message: 'Token inválido o expirado.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const userId = decoded.userId;
        if (!userId) {
            return new Response(JSON.stringify({ message: 'ID de usuario no encontrado en el token.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 2. Obtener el companyId de la solicitud
        const { companyId } = await request.json();

        if (!companyId) {
            return new Response(JSON.stringify({ message: 'El ID de la empresa es requerido.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 3. Verificar que el usuario pertenece a esta empresa y tiene permiso
        const userHasRoleInCompany = await db.get(
            `SELECT 1 FROM user_company_roles WHERE user_id = ? AND company_id = ?`,
            userId,
            companyId
        );

        if (!userHasRoleInCompany) {
            return new Response(JSON.stringify({ message: 'No tienes permisos para acceder a esta empresa.' }), {
                status: 403, // Forbidden
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 4. Establecer la cookie 'active_company_id'
        cookies.set('active_company_id', companyId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 30, // 30 días de duración para la empresa activa
            path: '/',
            sameSite: 'Lax',
        });

        return new Response(JSON.stringify({ message: 'Empresa activa establecida exitosamente.', activeCompanyId: companyId }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error en el endpoint de establecer empresa activa:', error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor al establecer la empresa activa.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}