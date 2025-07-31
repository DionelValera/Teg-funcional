// src/pages/api/logout.js
export async function POST({ cookies }) {
    try {
        // Elimina la cookie de autenticación
        cookies.set('auth_token', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 0, // Establece la duración a 0 para que expire inmediatamente
            path: '/',
            sameSite: 'Lax',
        });

        return new Response(JSON.stringify({ message: 'Sesión cerrada exitosamente' }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error en el endpoint de logout:', error);
        return new Response(JSON.stringify({ message: 'Error interno del servidor al cerrar sesión' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
