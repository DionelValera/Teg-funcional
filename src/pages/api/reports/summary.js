// src/pages/api/reports/summary.js
import { initializeDatabase } from '../../../db/db.js';
import pkg from 'jsonwebtoken';
const { verify } = pkg;

const JWT_SECRET = '0402Dionel.*'; // ¡Considera mover esto a una variable de entorno segura!

export async function GET({ request, cookies, url }) {
    console.log('API: /reports/summary - Solicitud recibida.');
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
            console.log('API: Usuario no tiene permisos para acceder a los reportes de esta empresa.');
            return new Response(JSON.stringify({ message: 'No tienes permisos para acceder a los reportes de esta empresa.' }), {
                status: 403, // Forbidden
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 4. Obtener fechas de inicio y fin desde los parámetros de la URL
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');

        if (!startDate || !endDate) {
            return new Response(JSON.stringify({ message: 'Fechas de inicio y fin son requeridas.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 5. Obtener todas las transacciones para el periodo y empresa activa
        const transactions = await db.all(
            `SELECT
            type,
            amount,
            description,
            category,
            transaction_date
            FROM
            transactions
            WHERE
            company_id = ? AND transaction_date BETWEEN ? AND ?
            ORDER BY
            transaction_date ASC, created_at ASC`,
            activeCompanyId,
            startDate,
            endDate
        );
        console.log('API: Transacciones para el periodo:', transactions);

        // 6. Calcular Saldo Neto, Total Ingresos y Total Gastos
        let totalIncome = 0;
        let totalExpense = 0;
        const incomeByCategory = {};
        const expenseByCategory = {};

        transactions.forEach(tx => {
            if (tx.type === 'ingreso') {
                totalIncome += tx.amount;
                incomeByCategory[tx.category || 'Sin Categoría'] = (incomeByCategory[tx.category || 'Sin Categoría'] || 0) + tx.amount;
            } else { // gasto
                totalExpense += tx.amount;
                expenseByCategory[tx.category || 'Sin Categoría'] = (expenseByCategory[tx.category || 'Sin Categoría'] || 0) + tx.amount;
            }
        });

        const netBalance = totalIncome - totalExpense;

        // 7. Calcular la evolución del Saldo Neto (para gráfico de líneas)
        const balanceTrend = [];
        const monthlyBalances = {}; // { 'YYYY-MM': balance }

        const start = new Date(startDate);
        const end = new Date(endDate);
        let currentDate = new Date(start.getFullYear(), start.getMonth(), 1);

        const transactionsByMonth = {};
        transactions.forEach(tx => {
            const date = new Date(tx.transaction_date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!transactionsByMonth[monthKey]) {
                transactionsByMonth[monthKey] = [];
            }
            transactionsByMonth[monthKey].push(tx);
        });

        let cumulativeBalanceInPeriod = 0;

        while (currentDate <= end) {
            const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            let monthNet = 0;

            if (transactionsByMonth[monthKey]) {
                transactionsByMonth[monthKey].forEach(tx => {
                    if (tx.type === 'ingreso') {
                        monthNet += tx.amount;
                    } else {
                        monthNet -= tx.amount;
                    }
                });
            }
            cumulativeBalanceInPeriod += monthNet;
            balanceTrend.push({
                date: monthKey,
                balance: cumulativeBalanceInPeriod
            });
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
        console.log('API: Tendencia de saldo:', balanceTrend);

        // 8. Top Categorías de Gastos (para simplificar, solo top 5)
        const sortedExpenseCategories = Object.entries(expenseByCategory)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .reduce((obj, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {});
        console.log('API: Top categorías de gastos:', sortedExpenseCategories);


        return new Response(JSON.stringify({
            netBalance,
            totalIncome,
            totalExpense,
            incomeByCategory,
            expenseByCategory,
            balanceTrend,
            topExpenseCategories: sortedExpenseCategories,
            allTransactions: transactions // ¡IMPORTANTE! Añadimos todas las transacciones aquí
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('API: Error CATCH en el endpoint de reportes de resumen:', error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor al generar reportes.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
