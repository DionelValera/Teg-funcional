// src/pages/api/transactions/delete.js
import { initializeDatabase } from '../../../db/db.js';
import pkg from 'jsonwebtoken';
const { verify = null } = pkg;

const JWT_SECRET = '0402Dionel.*';

export async function POST({ request, cookies }) {
    console.log('API: /transactions/delete - Solicitud POST recibida.');
    try {
        const db = await initializeDatabase();
        console.log('API: DB inicializada.');

        const token = cookies.get('auth_token')?.value;
        const companyId = cookies.get('active_company_id')?.value;

        if (!token || !companyId) {
            console.log('API: Autenticación o empresa no seleccionada.');
            return new Response(JSON.stringify({ message: 'No autenticado o empresa no seleccionada.' }), {
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

        let requestBody;
        try {
            requestBody = await request.json();
        } catch (jsonError) {
            console.error('API: Error al parsear JSON:', jsonError);
            return new Response(JSON.stringify({ message: 'Cuerpo de la solicitud no válido.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { transactionId, amount, type, accountId } = requestBody;
        console.log('API: Datos de eliminación de transacción recibidos:', { transactionId, amount, type, accountId });

        if (!transactionId || amount === undefined || !type || !accountId) {
            console.log('API: Validación fallida - datos de transacción faltantes.');
            return new Response(JSON.stringify({ message: 'ID, monto, tipo o ID de cuenta de la transacción son obligatorios.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Paso 1: Verificar el rol del usuario
        const userRole = await db.get(
            `SELECT role FROM user_company_roles WHERE user_id = ? AND company_id = ?`,
            userId,
            companyId
        );

        if (!userRole || userRole.role !== 'owner') {
            console.log('API: Permisos insuficientes. El usuario no es el dueño.');
            return new Response(JSON.stringify({ message: 'No tienes permisos para eliminar transacciones.' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Paso 2: Verificar que la transacción existe y pertenece a la empresa activa
        const transactionInCompany = await db.get(
            `SELECT t.id, t.amount, t.type FROM transactions t JOIN accounts a ON t.account_id = a.id WHERE t.id = ? AND a.company_id = ?`,
            transactionId,
            companyId
        );

        if (!transactionInCompany) {
            console.log('API: La transacción no existe o no pertenece a la empresa activa.');
            return new Response(JSON.stringify({ message: 'La transacción no existe o no pertenece a la empresa seleccionada.' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Paso 3: Actualizar el balance de la cuenta
        let newBalanceChange;
        const currentAmount = transactionInCompany.amount;
        const currentType = transactionInCompany.type;

        if (currentType === 'ingreso') {
            newBalanceChange = -currentAmount; // Si era un ingreso, lo restamos para revertirlo
        } else {
            newBalanceChange = currentAmount; // Si era un gasto, lo sumamos para revertirlo
        }

        console.log(`API: Revirtiendo transacción. Cambio de balance en la cuenta ${accountId}: ${newBalanceChange}.`);
        await db.run(
            `UPDATE accounts SET balance = balance + ? WHERE id = ?`,
            newBalanceChange,
            accountId
        );
        console.log('API: Balance de la cuenta actualizado exitosamente.');


        // Paso 4: Eliminar la transacción
        await db.run(
            `DELETE FROM transactions WHERE id = ?`,
            transactionId
        );
        console.log(`API: Transacción con ID ${transactionId} eliminada exitosamente.`);

        return new Response(JSON.stringify({ message: 'Transacción eliminada exitosamente.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('API: Error CATCH general en el endpoint de eliminar transacción:', error);
        console.error('API: Stack del error general:', error.stack);
        return new Response(JSON.stringify({ message: 'Error interno del servidor al eliminar la transacción.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
