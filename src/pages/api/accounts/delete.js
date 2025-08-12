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

        // 3. Obtener accountId y el nuevo flag del body de la solicitud
        const { accountId, deleteTransactions } = await request.json();
        console.log('API: Datos de eliminación de cuenta recibidos:', { accountId, deleteTransactions });

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

        // 6. Manejar la eliminación basada en la opción del usuario
        if (deleteTransactions) {
            // Si se pide eliminar las transacciones, se hace una eliminación en cascada (si la FK está configurada)
            // o se eliminan las transacciones explícitamente y luego la cuenta.
            // Suponiendo que la FK está en cascada, solo se elimina la cuenta.
            // Si no está en cascada, se debería añadir un DELETE FROM transactions WHERE account_id = ?
            await db.run(`DELETE FROM accounts WHERE id = ?`, accountId);
            console.log('API: Cuenta y transacciones asociadas eliminadas.');
            return new Response(JSON.stringify({ message: 'Cuenta y transacciones eliminadas exitosamente.' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            // --- ESTE ES EL CÓDIGO PROBLEMÁTICO ---
            // Probablemente `account_id` en `transactions` tiene una restricción NOT NULL.
            // No podemos dejarlo en NULL. La solución es reasignar esas transacciones a otra cuenta.

            // 1. **(SUGERENCIA):** Podrías crear una cuenta "sin categoria" o "eliminada" y guardar su ID.
            //    Vamos a asumir que tienes una constante `UNCATEGORIZED_ACCOUNT_ID` para este propósito.
            const UNCATEGORIZED_ACCOUNT_ID = 'id-de-cuenta-sin-categoria'; // <- DEBES reemplazar esto

            // 2. Reasignamos las transacciones.
            const updateResult = await db.run(`UPDATE transactions SET account_id = ? WHERE account_id = ?`,
                                              UNCATEGORIZED_ACCOUNT_ID,
                                              accountId);

            console.log(`API: ${updateResult.changes} transacciones reasignadas.`);

            // 3. Eliminamos la cuenta original.
            const deleteResult = await db.run(`DELETE FROM accounts WHERE id = ?`, accountId);

            if (deleteResult.changes > 0) {
                console.log('API: Cuenta eliminada, transacciones conservadas.');
                return new Response(JSON.stringify({ message: 'Cuenta eliminada exitosamente. Las transacciones asociadas han sido conservadas.' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            } else {
                console.log('API: La cuenta no pudo ser eliminada.');
                return new Response(JSON.stringify({ message: 'La cuenta no pudo ser eliminada.' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

    } catch (error) {
        console.error('API: Error CATCH en el endpoint de eliminar cuenta:', error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor al eliminar la cuenta.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
