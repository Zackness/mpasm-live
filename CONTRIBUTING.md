# Contribuir a MPASM Live

Se aceptan informes de errores, mejoras de documentación y propuestas de código. El proyecto está bajo licencia MIT; los cambios aportados deben poder distribuirse bajo esa licencia.

## Informar un problema

Incluye la versión de Windows, VS Code, MPASM y la extensión; el dispositivo PIC; los pasos para reproducirlo y un ejemplo mínimo de código propio que puedas compartir. Adjunta los mensajes del panel MPASM Live si ayudan. Retira rutas personales, credenciales y material de clase que no tengas permiso de publicar.

## Preparar cambios

1. Instala Node.js 22 o posterior y npm.
2. Ejecuta `npm ci`.
3. Trabaja en una rama y documenta el cambio de comportamiento.
4. Ejecuta `npm run check`, `npm test` y `npm run package`.
5. Si el cambio afecta al editor, ejecuta las pruebas de integración descritas en README.md con VS Code y tu instalación de MPASM.
6. Abre un pull request con el problema, la solución y las pruebas realizadas.

Las pruebas del ensamblador se omiten cuando no está instalado. Indica claramente si no las ejecutaste. No añadas ejecutables, instaladores ni archivos de dispositivos de Microchip al repositorio; cada usuario obtiene esas herramientas de su proveedor.

Mantén compatibles las fuentes MPASM clásicas. El soporte de otros ensambladores, enlazadores, simuladores y programadores debe documentarse y probarse por separado.
