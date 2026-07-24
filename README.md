# Bitácora Digital de Mantenimiento · Vallejo Properties

Sistema web local desarrollado únicamente con HTML5, CSS3 y JavaScript ES6.

## Ejecución

La aplicación debe abrirse mediante un servidor local (no directamente como archivo) para permitir la carga de los catálogos JSON.

1. Abre esta carpeta en VS Code.
2. Inicia `index.html` con Live Server.
3. Ingresa con uno de los accesos iniciales.

## Accesos iniciales

- Administrativo: `admin` / `Admin123!`
- Encargado: `cristina` / `VP2026`
- Encargado: `jorge` / `VP2026`

Los usuarios, ubicaciones, bitácoras, evidencias, firmas y configuración se sincronizan mediante Supabase. El navegador conserva una copia local para facilitar la migración de registros existentes.

## Activación de Supabase

1. En el proyecto de Supabase abre **Editor SQL**.
2. Crea una consulta nueva.
3. Copia y ejecuta todo el contenido de `supabase-setup.sql`.
4. Publica nuevamente esta carpeta en GitHub Pages.

La aplicación usa únicamente la clave publicable. Nunca agregues una llave que comience con `sb_secret_`.

## Exportación PDF

En el expediente selecciona **Imprimir / PDF** y elige **Guardar como PDF** en el diálogo de impresión. El formato está preparado para tamaño Carta.
