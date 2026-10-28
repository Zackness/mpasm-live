# MPASM Live — PIC Assembly

Escribe ensamblador PIC en VS Code con colores, diagnósticos y generación de HEX mediante MPASM clásico o **PIC-AS de XC8**. Probado con PIC18F4550, MPASM 8.88 y XC8 PIC-AS 3.10 en Windows.

## PIC-AS / XC8: archivos .s y .S

La versión 0.4 añade el lenguaje **PIC-AS (XC8)**, con colores para instrucciones PIC, registros, etiquetas, números, comentarios, preprocesador y directivas como `PROCESSOR`, `PSECT`, `CONFIG`, `GLOBAL` y `BANKMASK`.

1. Instala el VSIX actualizado y recarga la ventana de VS Code.
2. Abre tu `.s` o `.S`. En la esquina inferior derecha debe aparecer **PIC-AS (XC8)**. Si aparece Texto sin formato u otro ensamblador, pulsa ahí y selecciona PIC-AS (XC8), o ejecuta **PIC-AS: Activar colores para .s y .S en esta carpeta**.
3. Conserva las extensiones oficiales de Microchip para gestionar y construir el proyecto del profesor. El coloreado no cambia sus archivos de proyecto. Ctrl+Shift+B no se intercepta en el lenguaje PIC-AS.
4. Opcionalmente ejecuta **PIC-AS: Configurar XC8 y paquete del dispositivo** para usar nuestro ensamblado independiente. Se detectan `pic-as.exe` y el DFP instalado en `.mchp_packs/Microchip`. Puedes seleccionar ambos manualmente.
5. **PIC-AS: Ensamblar y generar HEX** ensambla y enlaza el principal en `build`. La revisión mientras escribes utiliza el modo de ensamblado `-c` y muestra diagnósticos de PIC-AS, diferenciados de MPASM.

`mpasm.toolchain = auto` usa PIC-AS para .s/.S y MPASM para .asm. Para un .asm ya migrado puedes elegir `mpasm.toolchain = picas`. Los ajustes compartidos `mpasm.processor`, `mpasm.mainFile` y `mpasm.outputDirectory` también se usan con PIC-AS. `PROCESSOR` en la fuente prevalece sobre el dispositivo de respaldo.

Los ajustes nuevos son `picas.executable` (ruta de pic-as.exe), `picas.devicePack` (carpeta **xc8** de un DFP), `picas.extraArgs` (opciones del compilador/enlazador) y `picas.sources` (fuentes adicionales explícitas). Por defecto solo se ensambla el principal: no se combinan todos los .s de la carpeta. La extensión procesa #include también en .s minúscula mediante `-xassembler-with-cpp`.

**PIC-AS: Crear práctica básica PIC18F4550** genera una carpeta y un main.s con un ejemplo y sus opciones de enlace. También existe el snippet `picas18base` y el ejemplo `examples/picas.s`; este último usa `picas.extraArgs = ["-Wl,-presetVec=0h"]` para colocar su sección de reinicio en cero.

Este modo independiente **no importa automáticamente** las configuraciones, flags, file sets, paquetes fijados o scripts de los proyectos MPLAB X / Microchip. Para reproducir exactamente la compilación de clase utiliza la extensión oficial, o configura explícitamente las fuentes y opciones necesarias. MPASM y PIC-AS tienen diferencias de sintaxis y de enlace: cambiar la extensión del archivo no convierte el programa.

Los diagramas de la versión anterior siguen siendo análisis de fuente orientado a MPASM; no resuelven la colocación de PSECT ni el preprocesador de XC8. PIC-AS no añade simulación, programación de placas ni depuración a nuestra extensión. Los colores funcionan sin XC8 instalado; revisión y ensamblado requieren XC8 y soporte para el dispositivo.

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
- En MPASM usa Ctrl+Shift+B; en PIC-AS usa **PIC-AS: Ensamblar y generar HEX**, o el comando compartido **PIC: Ensamblar y generar HEX (MPASM / PIC-AS)**. Se guardan las fuentes abiertas de esa práctica antes de ensamblar.
- La salida se guarda en `build`: `ejemplo.asm` genera `build/ejemplo.hex`. Los archivos originales no reciben salidas del ensamblador.
- **MPASM: Mostrar último HEX válido** abre su ubicación si fue generado en esta sesión y no hubo cambios posteriores detectados.
- Si falla un ensamblado, se retira el HEX anterior de esa ruta de salida. No cargues copias antiguas que tengas en otra carpeta.
- Ctrl+Space sugiere instrucciones y símbolos EQU del include oficial del PIC. Al pasar el cursor se muestra ayuda breve para instrucciones habituales y el valor de registros/constantes.
- Escribe `pic18base`, `cblock`, `rutina` o `macro` para insertar una plantilla.

La barra inferior muestra la revisión o ensamblado; al pulsarla abre la configuración de MPASM. «Código revisado» no significa que el HEX esté actualizado: vuelve a ensamblar después de modificar el programa.

## Diagrama de flujo

Abre tu ASM y ejecuta **MPASM: Generar diagrama de flujo** desde Ctrl+Shift+P o desde el botón del editor. Si configuraste un principal, se utiliza ese archivo, incluso con cambios sin guardar. No necesitas ejecutar MPASM para generar el diagrama.

- **Resumida / detallada:** agrupa operaciones consecutivas o muestra las instrucciones por separado.
- **Pulsa un bloque** para ir a su línea. El selector permite localizar etiquetas y subrutinas dentro del diagrama.
- **Actualizar** reconstruye el diagrama después de modificar el código. Se bloquean la navegación y exportación de una vista desactualizada.
- **Exportar SVG** guarda una imagen vectorial para tus informes. Puedes abrirla en un navegador o un editor compatible. Esta versión no exporta PDF directamente.
- Los controles de zoom y ajuste de ancho permiten recorrer diagramas grandes.

Los símbolos se basan en [ISO 5807:1985](https://www.iso.org/standard/11955.html): terminal para entradas/retornos, rectángulo de proceso, rombo de decisión y proceso predefinido para llamadas. No se afirma certificación ni conformidad completa. El color naranja y el borde discontinuo identifican casos no resueltos por nuestro analizador.

Se interpretan saltos directos a etiquetas, bucles, decisiones PIC18, skips como BTFSC/BTFSS/DECFSZ, llamadas, retornos y segmentos ORG (incluidos los vectores 0, 8 y 18H). Una llamada tiene una conexión discontinua a la rutina y otra «Al regresar» a la continuación: no se garantiza que esa rutina llegue a retornar. Los retornos se muestran como salidas de rutina, no como fin de todo el programa.

El diagrama representa **el archivo principal a nivel de fuente**, no el programa expandido ni su ejecución real. No expande macros, includes o ensamblado condicional. Los includes de usuario y las operaciones cuyo flujo no puede resolverse se muestran como bloques opacos, sin inventar su continuación. Los includes oficiales de dispositivo se omiten como declaraciones y se anotan. Los saltos calculados, expresiones complejas, datos en programa, SLEEP y ciertos formatos requieren revisión manual. El propio diagrama señala estas observaciones. No detecta errores de lógica ni verifica el circuito.

Puedes probarlo con `examples/flowchart.asm` del repositorio. El análisis inicial está dirigido al PIC18F4550 con juego de instrucciones estándar; otros dispositivos y modos extendidos no están validados.

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

## Alcance del modo MPASM

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
