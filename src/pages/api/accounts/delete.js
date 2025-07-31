// src/pages/api/accounts/delete.js
import { initializeDatabase } from '../../../db/db.js';
import pkg from 'jsonwebtoken';
const { verify } = pkg;

const JWT_SECRET = '0402Dionel.*'; 

export async function POST({ request, cookies }) {
    console.log('API: /accounts/delete - Solicitud POST recibida.');
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

        // 2. Obtener el ID de la empresa activa desde la cookie
        const companyId = cookies.get('active_company_id')?.value;
        if (!companyId) {
            console.log('API: No hay empresa activa seleccionada en la cookie.');
            return new Response(JSON.stringify({ message: 'No hay empresa activa seleccionada. Por favor, selecciona una empresa en tu dashboard.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 3. Obtener accountId de la solicitud
        const { accountId } = await request.json();
        console.log('API: Datos de eliminación de cuenta recibidos:', { accountId });

        if (!accountId) {
            console.log('API: Validación fallida - ID de cuenta faltante.');
            return new Response(JSON.stringify({ message: 'ID de cuenta es obligatorio.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 4. Verificar que el usuario tiene permiso para eliminar cuentas de esta empresa (owner, admin)
        const userRole = await db.get(
            `SELECT role FROM user_company_roles WHERE user_id = ? AND company_id = ?`,
            userId,
            companyId
        );

        if (!userRole || !['owner', 'admin'].includes(userRole.role)) {
            console.log('API: Usuario no tiene permisos para eliminar cuentas en esta empresa.');
            return new Response(JSON.stringify({ message: 'No tienes permisos para eliminar cuentas en esta empresa.' }), {
                status: 403, // Forbidden
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 5. Verificar que la cuenta pertenece a la empresa activa
        const accountExistsInCompany = await db.get(
            `SELECT id FROM accounts WHERE id = ? AND company_id = ?`,
            accountId,
            companyId
        );

        if (!accountExistsInCompany) {
            console.log('API: La cuenta no existe o no pertenece a la empresa activa.');
            return new Response(JSON.stringify({ message: 'La cuenta no existe o no pertenece a la empresa seleccionada.' }), {
                status: 404, // Not Found
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 6. Eliminar la cuenta
        const result = await db.run(`DELETE FROM accounts WHERE id = ?`, accountId);
        console.log('API: Resultado de eliminación de cuenta:', result);

        if (result.changes > 0) {
            return new Response(JSON.stringify({ message: 'Cuenta eliminada exitosamente.' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            return new Response(JSON.stringify({ message: 'La cuenta no pudo ser eliminada.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

    } catch (error) {
        console.error('API: Error CATCH en el endpoint de eliminar cuenta:', error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor al eliminar la cuenta.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}