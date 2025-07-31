// src/pages/api/transactions/get-by-company.js
import { initializeDatabase } from '../../../db/db.js';
import pkg from 'jsonwebtoken';
const { verify } = pkg;

const JWT_SECRET = '0402Dionel.*'; 

export async function GET({ request, cookies }) {
    console.log('API: /transactions/get-by-company - Solicitud recibida.');
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
        const activeCompanyId = cookies.get('active_company_id')?.value;
        console.log('API: active_company_id de cookie:', activeCompanyId);

        if (!activeCompanyId) {
            console.log('API: No hay empresa activa seleccionada en la cookie.');
            return new Response(JSON.stringify({ message: 'No hay empresa activa seleccionada.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 3. Verificar que el usuario tiene acceso a esta empresa activa
        const userHasRoleInCompany = await db.get(
            `SELECT 1 FROM user_company_roles WHERE user_id = ? AND company_id = ?`,
            userId,
            activeCompanyId
        );

        if (!userHasRoleInCompany) {
            console.log('API: Usuario no tiene permisos para acceder a las transacciones de esta empresa.');
            return new Response(JSON.stringify({ message: 'No tienes permisos para acceder a las transacciones de esta empresa.' }), {
                status: 403, // Forbidden
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 4. Obtener las transacciones para la empresa activa, ordenadas por fecha (ascendente)
        const transactions = await db.all(
            `SELECT
                t.id,
                t.type,
                t.amount,
                t.description,
                t.category,
                t.transaction_date,
                a.account_name AS accountName -- Obtener el nombre de la cuenta
             FROM
                transactions t
             JOIN
                accounts a ON t.account_id = a.id
             WHERE
                t.company_id = ?
             ORDER BY
                t.transaction_date ASC, t.created_at ASC`, // Ordenar por fecha de transacción y luego por fecha de creación
            activeCompanyId
        );
        console.log('API: Transacciones encontradas (ordenadas):', transactions);

        // 5. Calcular el saldo total consolidado de la empresa
        // Sumar los saldos actuales de todas las cuentas de la empresa
        const accountsWithBalances = await db.all(
            `SELECT
                a.id,
                a.initial_balance,
                COALESCE(SUM(CASE WHEN t.type = 'ingreso' THEN t.amount ELSE -t.amount END), 0) AS transactions_sum
             FROM
                accounts a
             LEFT JOIN
                transactions t ON a.id = t.account_id
             WHERE
                a.company_id = ?
             GROUP BY
                a.id, a.initial_balance`,
            activeCompanyId
        );

        let totalCompanyBalance = 0;
        accountsWithBalances.forEach(account => {
            totalCompanyBalance += (account.initial_balance + account.transactions_sum);
        });
        console.log('API: Saldo total consolidado de la empresa:', totalCompanyBalance);


        return new Response(JSON.stringify({ transactions: transactions, totalCompanyBalance: totalCompanyBalance }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('API: Error CATCH en el endpoint de obtener transacciones por empresa:', error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor al obtener las transacciones.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}