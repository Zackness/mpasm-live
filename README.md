# MPASM Live — PIC Assembly

Escribe ensamblador PIC en VS Code y usa el MPASM clásico de Microchip para revisar el código mientras escribes y generar archivos HEX. Preparado y probado con PIC18F4550 y MPASM de MPLAB IDE 8.88 en Windows.

## Instalar

Descarga el VSIX desde [GitHub Releases](https://github.com/Zackness/mpasm-live/releases). El código es libre bajo licencia MIT; la versión actual es de prueba y aún necesita validación en otros equipos.

1. En VS Code abre Extensiones → ⋯ → Instalar desde VSIX y selecciona el paquete.
2. Abre una carpeta de práctica y confía en ella para habilitar la ejecución del ensamblador.
3. Ejecuta **MPASM: Configurar ensamblador** desde Ctrl+Shift+P. La extensión busca instalaciones habituales en C:, D:, E: y PATH. También puedes seleccionar MPASMWIN.exe manualmente.
4. Si no tienes MPASM, el asistente abre el [archivo oficial de Microchip](https://www.microchip.com/en-us/tools-resources/archives/mplab-ecosystem). Descarga e instala un paquete que lo incluya, aceptando su licencia, y vuelve a detectar. MPLAB X 5.40 y posteriores no incluyen MPASM.

MPASM, los archivos de dispositivos y MPLAB no están incluidos ni se redistribuyen con esta extensión. Esta versión no descarga ni instala binarios automáticamente. El instalador de Microchip puede instalar también MPLAB, aunque no es necesario abrirlo para editar y ensamblar aquí. El soporte de mpasmx.exe es de detección; solo MPASMWIN.exe 8.88 fue probado en este equipo.

## Una práctica nueva

Ejecuta **MPASM: Crear práctica PIC18F4550**, elige una carpeta padre y un nombre. Se crea una carpeta nueva con una base ASM y configuración del principal. El ejemplo no configura hardware: adapta CONFIG, oscilador, pines y periféricos a tu circuito.

También puedes abrir una carpeta existente y crear archivos con cualquier nombre: no tienen que llamarse main.asm.

## Varios ASM en la misma carpeta

Ejecuta **MPASM: Seleccionar archivo principal**, o **MPASM: Usar archivo activo como principal**. La elección queda en `.vscode/settings.json` y sirve tanto para revisión como para ensamblado. Así puedes editar includes u otras pestañas y seguir ensamblando el principal. Con `mpasm.mainFile` vacío se usa el archivo activo.

## Uso diario

- Los diagnósticos aparecen después de 900 ms de pausa, sin guardar. Ctrl+Shift+M abre Problemas; pulsa un diagnóstico para ir a su archivo y línea, incluidos los `.inc` locales.
- Ctrl+Shift+B, o **MPASM: Ensamblar y generar HEX**, guarda las fuentes abiertas de esa práctica y ensambla el principal.
- La salida se guarda en `build`: `ejemplo.asm` genera `build/ejemplo.hex`. Los archivos originales no reciben salidas del ensamblador.
- **MPASM: Mostrar último HEX válido** abre su ubicación si fue generado en esta sesión y no hubo cambios posteriores detectados.
- Si falla un ensamblado, se retira el HEX anterior de esa ruta de salida. No cargues copias antiguas que tengas en otra carpeta.
- Ctrl+Space sugiere instrucciones y símbolos EQU del include oficial del PIC. Al pasar el cursor se muestra ayuda breve para instrucciones habituales y el valor de registros/constantes.
- Escribe `pic18base`, `cblock`, `rutina` o `macro` para insertar una plantilla.

La barra inferior muestra la revisión o ensamblado; al pulsarla abre la configuración de MPASM. «Código revisado» no significa que el HEX esté actualizado: vuelve a ensamblar después de modificar el programa.

## Proteus y placa física

En Proteus, configura **Program File** del PIC con el HEX de `build` y ajusta la frecuencia conforme al programa. Para una placa, carga ese HEX usando tu programador o bootloader habitual. La extensión no integra simulación, depuración paso a paso ni carga a la placa.

## Ajustes

| Ajuste | Uso |
| --- | --- |
| `mpasm.executable` | Ruta del ensamblador por equipo; vacío para detectar. No compartas rutas personales en el proyecto. |
| `mpasm.processor` | PIC de respaldo, por defecto 18F4550. LIST P= o PROCESSOR en la fuente prevalecen. |
| `mpasm.mainFile` | Principal relativo a cada carpeta de trabajo. |
| `mpasm.liveChecking` | Activa o desactiva la revisión automática. |
| `mpasm.delay` | Pausa entre 300 y 10000 ms. |
| `mpasm.outputDirectory` | Subcarpeta de salida, por defecto build. |

## Alcance de la versión 0.2

- Windows local con MPASM instalado; no funciona como ensamblador en macOS, Linux, WSL o VS Code web.
- Programas absolutos de un principal y sus includes locales. No se enlazan módulos reubicables automáticamente.
- Se copian ASM e INC de la práctica a una carpeta temporal, se aplican los buffers abiertos y se ejecuta allí MPASM. No se incluyen carpetas build, dist, node_modules, .git ni enlaces simbólicos. Los includes externos/absolutos y otros recursos requieren adaptación; mantenlos dentro de la carpeta de práctica.
- Los diagnósticos son los del ensamblador: no prueban el comportamiento del circuito ni detectan todos los errores lógicos.
- La ayuda de instrucciones es introductoria y parcial. El archivo oficial del dispositivo y su hoja de datos son la referencia.
- El seguimiento de HEX en la interfaz cubre los cambios abiertos en esta sesión; vuelve a ensamblar después de cambios externos.
- Solo se ha probado una instalación real de MPASM 8.88; falta validar una segunda PC antes de anunciar compatibilidad amplia.

## Desarrollo y distribución

Código propio bajo MIT; no es un producto oficial ni está afiliado con Microchip. PIC, MPASM y MPLAB son marcas de sus titulares.

Las contribuciones son bienvenidas. Consulta [CONTRIBUTING.md](https://github.com/Zackness/mpasm-live/blob/main/CONTRIBUTING.md) y [SECURITY.md](https://github.com/Zackness/mpasm-live/blob/main/SECURITY.md).

Requisitos de desarrollo: Node.js 22 o posterior y npm. `npm ci`, `npm test` y `npm run package` generan el VSIX mediante @vscode/vsce. Las pruebas con MPASM se omiten si no se detecta; para forzarlas usa `MPASM_TEST_EXE` con la ruta local.

Para probar la integración real con VS Code, ejecuta `node scripts/test-host.js "ruta a Code.exe"`. Agrega `--restricted` para verificar el modo sin confianza. Estas pruebas crean un perfil y una práctica temporales; no usan tus prácticas ni tu configuración habitual.

Consulta el archivo PUBLICACION.md incluido en el código fuente para preparar una publicación en Marketplace. El publisher `local` es provisional: debe sustituirse por una identidad real antes de publicar.
