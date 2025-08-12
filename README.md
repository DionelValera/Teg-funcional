# Contabilito - Notas Completas del Proyecto

Este documento sirve como un registro central de la visión del proyecto, decisiones clave, estado actual y próximos pasos para la aplicación Contabilito.

---

## 1. Visión General del Proyecto

* **Objetivo Principal:** Crear una aplicación web contable personal/empresarial con gestión de usuarios, empresas y colaboración.
* **Tecnologías Clave:** Astro (SSR/SSG), SQLite (base de datos), Node.js (endpoints API), Tailwind CSS (estilos), JavaScript (frontend interactivo), Gemini API (sugerencias inteligentes).

---

## 2. Estado Actual del Desarrollo (Fecha: 19 de Julio de 2025)

### **2.1. Autenticación y Gestión de Sesión**

* **Registro de Usuarios:** Formulario completo con nombre, apellido, username, email, nombre de empresa (opcional), contraseña (con mostrar/ocultar), y aceptación de términos.
* **Inicio de Sesión:** Formulario que permite iniciar sesión con email o nombre de usuario, con opción "Recordarme" (persistencia de sesión).
* **Cierre de Sesión:** Funcionalidad para invalidar la sesión.
* **Recuperación de Contraseña:**
    * Página de solicitud de restablecimiento (introduce email).
    * Endpoint que genera un token, lo guarda en DB y simula el envío de un email con el enlace de restablecimiento.
    * **PENDIENTE:** Página y endpoint para restablecer la contraseña con el token.
    * **PENDIENTE:** Integración real de envío de emails.

### **2.2. Diseño de UI y Componentes**

* **Página de Inicio (`index.astro`):** Diseño de dos columnas (texto/botones + imagen), fondo degradado, tarjeta central.
* **Header Global (`Header.astro`):**
    * Fijo en la parte superior, con transparencia (`bg-blue-700/80`) y efecto `backdrop-blur-md`.
    * Se oculta al hacer scroll hacia abajo y reaparece al scroll hacia arriba.
    * Logo personalizado (asumido) y navegación dinámica (login/registro vs. dashboard/cerrar sesión).
    * Estilos coherentes con la paleta azul/blanco/negro.
* **Formularios de Autenticación:**
    * `LoginForm.astro` y `RegisterForm.astro` con diseño compacto y horizontal.
    * Campos de entrada con estilos uniformes y efecto de enfoque.
    * Botones de acción con degradados y efectos hover/scale.
    * Funcionalidad de "Mostrar/Ocultar" contraseña implementada y accesible.
* **Página de Recuperación de Contraseña (`forgot-password.astro`):** Formulario simple para introducir el email.
* **Dashboard (`dashboard.astro`):**
    * Página protegida (redirecciona si no hay sesión).
    * **Integración Gemini:** Sección para obtener sugerencias de categoría/descripción de transacciones usando IA.
    * **PENDIENTE:** Rediseño completo para la gestión de empresas y transacciones por empresa.

### **2.3. Base de Datos (SQLite)**

* **Estructura Actualizada:** El esquema de la base de datos ha sido modificado para soportar la nueva visión de empresas y roles.
    * **¡IMPORTANTE!** Si no se ha hecho, el archivo `src/db/ingreso.db` debe ser eliminado para que se recree con el esquema más reciente.
