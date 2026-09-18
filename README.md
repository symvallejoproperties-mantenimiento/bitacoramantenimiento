# Bitácora Digital de Mantenimiento · Vallejo Properties

Sistema web de bitácoras desarrollado con HTML5, CSS3, JavaScript y servicios de Cloudflare.

## Compatibilidad móvil

Esta edición está optimizada para Safari en iPhone, Chrome, Firefox y navegadores móviles basados en WebKit. Incluye caché mediante Service Worker, guardado local temporal y sincronización automática con Cloudflare cuando vuelve la señal. Las fotografías se comprimen para reducir el consumo de datos y memoria.

Para publicar, sube **todo el contenido de esta carpeta** a la raíz del repositorio de GitHub Pages. El Service Worker requiere HTTPS, que GitHub Pages proporciona automáticamente.

## Ejecución

La aplicación debe abrirse mediante un servidor local (no directamente como archivo) para permitir la carga de los catálogos JSON.

1. Abre esta carpeta en VS Code.
2. Inicia `index.html` con Live Server.
3. Ingresa con uno de los accesos iniciales.

## Accesos iniciales

- Administrativo: `admin` / `Admin123!`
- Encargado: `cristina` / `VP2026`
- Encargado: `jorge` / `VP2026`

Los usuarios, ubicaciones, bitácoras y configuración se sincronizan mediante Cloudflare D1. Las evidencias y firmas se comprimen y se guardan por separado en D1 para mantener el proyecto completamente gratuito y sin registrar tarjeta. El navegador conserva una copia local para trabajar sin conexión.

## Continuidad y accesos

- En **Trabajos**, selecciona “Sí” en continuidad para elegir el número de una bitácora pendiente o en proceso.
- Si el seguimiento concluye, la nueva bitácora y la bitácora original quedan finalizadas.
- Si no concluye, la fecha compromiso es obligatoria y aparece en Administración.
- Los usuarios con rol **Encargado** pueden consultar Resumen, Bitácoras, Encargados y Reportes, pero no pueden eliminar bitácoras ni entrar a Configuración.
- Los usuarios administrativos pueden gestionar accesos desde **Configuración > Usuarios**.
- Los usuarios y sus accesos se guardan en el estado compartido de Cloudflare D1 para que funcionen en otros dispositivos.

## Activación de Cloudflare

1. Crea una base D1 y ejecuta `cloudflare-d1-schema.sql`.
2. En el proyecto Pages agrega el binding D1 `DB`, tanto en producción como en vista previa.
3. Publica el repositorio. La carpeta `functions` proporciona la API y `_routes.json` limita las invocaciones a `/api/*`.

La aplicación no contiene claves privadas. D1 solo es accesible desde Pages Functions mediante su binding.

## Exportación PDF

En el expediente selecciona **Imprimir / PDF** y elige **Guardar como PDF** en el diálogo de impresión. El formato está preparado para tamaño Carta.
