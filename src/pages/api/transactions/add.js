// src/pages/api/transactions/add.js
import { initializeDatabase } from '../../../db/db.js';
import pkg from 'jsonwebtoken';
const { verify } = pkg;

const JWT_SECRET = '0402Dionel.*'; 

export async function POST({ request, cookies }) {
    console.log('API: /transactions/add - Solicitud POST recibida.');
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

        // 3. Obtener los datos de la transacción del cuerpo de la solicitud
        const { type, amount, description, category, transactionDate, accountId } = await request.json();
        console.log('API: Datos de transacción recibidos:', { type, amount, description, category, transactionDate, accountId });

        // 4. Validar datos básicos
        if (!type || !['ingreso', 'gasto'].includes(type) || isNaN(amount) || amount <= 0 || !transactionDate || !accountId) {
            console.log('API: Validación fallida - Campos obligatorios o valores inválidos.');
            return new Response(JSON.stringify({ message: 'Faltan campos obligatorios o los valores son inválidos (Tipo, Cantidad, Fecha, Cuenta).' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 5. Verificar que la cuenta seleccionada pertenece a la empresa activa del usuario
        const account = await db.get(
            `SELECT id, initial_balance FROM accounts WHERE id = ? AND company_id = ?`,
            accountId,
            companyId
        );

        if (!account) {
            console.log('API: La cuenta seleccionada no existe o no pertenece a la empresa activa.');
            return new Response(JSON.stringify({ message: 'La cuenta seleccionada no es válida para tu empresa.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 6. ¡NUEVO! Lógica de verificación de saldo para gastos
        if (type === 'gasto') {
            // Calcular el saldo actual de la cuenta
            const transactionsSum = await db.get(
                `SELECT COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount ELSE -amount END), 0) AS balance_change
                 FROM transactions
                 WHERE account_id = ?`,
                accountId
            );
            const currentBalance = account.initial_balance + transactionsSum.balance_change;
            console.log(`API: Saldo actual de la cuenta ${accountId}: ${currentBalance}. Monto del gasto: ${amount}`);

            if (currentBalance < amount) {
                console.log('API: Saldo insuficiente para el gasto.');
                return new Response(JSON.stringify({ message: 'Usted no posee saldo en la cuenta seleccionada para poder registrar algún gasto.' }), {
                    status: 400, // Bad Request
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        const createdAt = new Date().toISOString();

        // 7. Iniciar una transacción de base de datos para asegurar atomicidad
        await db.run('BEGIN TRANSACTION;');

        try {
            // 8. Insertar la transacción
            const transactionResult = await db.run(
                `INSERT INTO transactions (company_id, user_id, account_id, type, amount, description, category, transaction_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                companyId,
                userId,
                accountId,
                type,
                amount,
                description,
                category,
                transactionDate,
                createdAt
            );
            console.log('API: Transacción insertada. lastID:', transactionResult.lastID);

            await db.run('COMMIT;'); // Confirmar la transacción
            console.log('API: Transacción completada exitosamente.');

            return new Response(JSON.stringify({ message: 'Transacción registrada exitosamente.' }), {
                status: 201, // Created
                headers: { 'Content-Type': 'application/json' },
            });

        } catch (dbError) {
            await db.run('ROLLBACK;'); // Revertir la transacción si algo falla
            console.error('API: Error de base de datos durante la transacción. Rollback ejecutado:', dbError);
            throw dbError; // Relanzar el error para que el catch externo lo maneje
        }

    } catch (error) {
        console.error('API: Error CATCH en el endpoint de añadir transacción:', error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor al registrar la transacción.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}