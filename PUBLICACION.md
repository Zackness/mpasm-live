# Publicar MPASM Live

El VSIX puede compartirse manualmente. Marketplace requiere completar estos pasos finales con la cuenta del propietario.

1. Elegir el nombre público y crear una identidad de publicador en Visual Studio Marketplace. Cambiar `publisher: local` por esa identidad; el identificador de la extensión cambiará y debe desinstalarse la copia local para evitar duplicados.
2. Crear un repositorio público si se desea, añadir los enlaces reales `repository`, `bugs` y `homepage` al manifiesto, y un icono PNG propio. No inventar enlaces ni utilizar logos de Microchip para aparentar afiliación.
3. Validar el VSIX en otra PC Windows, incluyendo una sin MPASM: asistente, selección del ejecutable, compilación y HEX en Proteus. Validar también el programador real si se quiere anunciar soporte de esa combinación.
4. Ejecutar `npm ci`, `npm test` y `npm run package`. Confirmar que las pruebas de MPASM no se omiten en el equipo de validación.
5. Revisar README, capturas y límites declarados. Mantener MPASM y los includes de Microchip fuera del paquete.
6. Publicar manualmente el VSIX en la administración del publicador o seguir la autenticación vigente de `vsce publish`. No guardar credenciales en este repositorio ni en chats.

Guía oficial: https://code.visualstudio.com/api/working-with-extensions/publishing-extension

No se ha publicado ni creado una cuenta automáticamente. El asistente abre el archivo de Microchip; no garantiza una descarga directa ni una instalación silenciosa del ensamblador.
