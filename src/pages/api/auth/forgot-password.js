// src/pages/api/auth/forgot-password.js
import { initializeDatabase } from '../../../db/db.js'; // Importa la función centralizada
import crypto from 'crypto'; // Para generar tokens seguros

export async function POST({ request }) {
  try {
    const db = await initializeDatabase(); // Ahora llama a la función importada

    const { email } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ message: 'El correo electrónico es requerido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Buscar al usuario por email
    const user = await db.get('SELECT id, email FROM users WHERE email = ?', email);

    if (!user) {
      // Por seguridad, siempre enviamos un mensaje genérico para no revelar si el email existe o no
      return new Response(JSON.stringify({ message: 'Si tu correo electrónico está registrado, recibirás un enlace para restablecer tu contraseña.' }), {
        status: 200, // Siempre 200 para evitar enumeración de usuarios
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Generar un token único y su fecha de expiración (ej. 1 hora)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora en el futuro

    // 3. Guardar el token y su expiración en la base de datos para el usuario
    await db.run(
      'UPDATE users SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?',
      resetToken,
      resetTokenExpiresAt,
      user.id
    );

    // 4. SIMULACIÓN de envío de correo electrónico
    const resetLink = `http://localhost:4321/reset-password?token=${resetToken}`;
    console.log(`--- SIMULACIÓN DE ENVÍO DE EMAIL ---`);
    console.log(`Para: ${user.email}`);
    console.log(`Asunto: Restablece tu contraseña de Contabilito`);
    console.log(`Haz clic en este enlace para restablecer tu contraseña: ${resetLink}`);
    console.log(`-------------------------------------`);

    return new Response(JSON.stringify({ message: 'Si tu correo electrónico está registrado, recibirás un enlace para restablecer tu contraseña.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error en el endpoint de forgot-password:', error);
    return new Response(JSON.stringify({ message: 'Error interno del servidor al procesar la solicitud de restablecimiento.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
