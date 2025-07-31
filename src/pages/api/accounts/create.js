// src/pages/api/accounts/create.js
import { initializeDatabase } from '../../../db/db.js';
import pkg from 'jsonwebtoken';
const { verify } = pkg;

const JWT_SECRET = '0402Dionel.*'; 

export async function POST({ request, cookies }) {
    console.log('API: /accounts/create - Solicitud POST recibida.');
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

        // 3. Obtener los demás datos de la cuenta desde el body
        const { accountName, initialBalance } = await request.json();
        console.log('API: Datos de cuenta recibidos:', { accountName, initialBalance });

        if (!accountName || accountName.trim() === '' || isNaN(initialBalance)) {
            console.log('API: Validación fallida - campos obligatorios o saldo inicial inválido.');
            return new Response(JSON.stringify({ message: 'Faltan campos obligatorios o el saldo inicial es inválido.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 4. Verificar que el usuario tiene permiso para añadir cuentas a esta empresa (owner, admin)
        const userRole = await db.get(
            `SELECT role FROM user_company_roles WHERE user_id = ? AND company_id = ?`,
            userId,
            companyId
        );

        if (!userRole || !['owner', 'admin'].includes(userRole.role)) {
            console.log('API: Usuario no tiene permisos para crear cuentas en esta empresa.');
            return new Response(JSON.stringify({ message: 'No tienes permisos para crear cuentas en esta empresa.' }), {
                status: 403, // Forbidden
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const createdAt = new Date().toISOString();

        // 5. Verificar si ya existe una cuenta con ese nombre para esta empresa
        const existingAccount = await db.get(
            `SELECT id FROM accounts WHERE company_id = ? AND account_name = ?`,
            companyId,
            accountName.trim()
        );
        if (existingAccount) {
            console.log('API: Ya existe una cuenta con este nombre para esta empresa.');
            return new Response(JSON.stringify({ message: 'Ya existe una cuenta con este nombre para esta empresa.' }), {
                status: 409, // Conflict
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 6. Insertar la nueva cuenta
        const result = await db.run(
            `INSERT INTO accounts (company_id, account_name, initial_balance, created_at)
            VALUES (?, ?, ?, ?)`,
            companyId,
            accountName.trim(),
            initialBalance,
            createdAt
        );
        console.log('API: Cuenta creada exitosamente. lastID:', result.lastID);

        return new Response(JSON.stringify({ message: 'Cuenta creada exitosamente.', accountId: result.lastID }), {
            status: 201, // Created
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('API: Error CATCH en el endpoint de crear cuenta:', error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor al crear la cuenta.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}