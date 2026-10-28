# Validación de la versión 0.2.0

## Actualización 0.4.0 — XC8 PIC-AS

Se verificaron XC8 PIC-AS 3.10 y PIC18Fxxxx_DFP 1.8.178 instalados en el equipo. Las pruebas cubren gramática TextMate con Oniguruma real (instrucciones, PSECT, #include, etiquetas, números y registros), parsing de diagnósticos, compilación de buffers sin guardar, generación y retirada de HEX. La integración en VS Code comprueba reconocimiento .s, autocompletado PSECT/LATC, errores sin guardar, corrección y comando de enlace. También se revisó una fuente real de clase sobre copia temporal, sin modificarla.

En otros equipos pueden cambiar la versión de XC8, el dispositivo y el DFP. Los proyectos oficiales se siguen construyendo con Microchip; nuestra compilación independiente requiere configurar sus opciones y fuentes explícitamente.

## Actualización 0.3.0 — diagramas

Se añadieron pruebas de skips (incluido GOTO de dos palabras), condiciones, llamadas/retornos, bucles, vectores ORG, destinos numéricos/relativos, macros e includes opacos, ensamblado condicional, agrupación y escape del SVG. El comando de generación se incluye en la prueba de integración con VS Code. Se genera además un diagrama de la práctica real sobre su texto, sin modificar la fuente.

Las limitaciones de interpretación y la ausencia de certificación ISO se describen en README.md y en la propia vista.

Fecha: 18 de octubre de 2026.

## Entorno comprobado

- Windows, MPASMWIN.exe 8.88.00.00 de la instalación existente.
- PIC18F4550, fuente absoluta y archivos INC locales.
- Node.js 24.19.0 para pruebas y empaquetado con @vscode/vsce 4.0.0.
- VS Code 1.100.3 en una copia temporal independiente para las pruebas de integración. La instalación habitual estaba actualizándose; no se interrumpió.

## Resultados

- 7 pruebas automáticas del núcleo: análisis de mensajes y dispositivo, límites de salida, copia de buffers sin modificar originales, generación real de HEX, errores en includes, corrección de errores, retirada del HEX antiguo, fallo de ejecución y protección frente a una salida enlazada fuera del proyecto.
- Integración en VS Code: reconocimiento de ASM, sugerencias de instrucciones y registros del include oficial, error antes de guardar, desaparición al corregir, comando de ensamblado, diagnóstico en el archivo INC correcto y retirada del HEX tras fallo.
- Modo restringido de VS Code: edición disponible, revisión y ensamblado deshabilitados.
- Una práctica real del usuario se ensambló sobre copia temporal sin errores ni advertencias. Sus fuentes y salidas originales no se modificaron.
- Empaquetado mediante la herramienta oficial vsce y comprobación de instalación por la CLI de VS Code.

## Pendiente para publicación amplia

- Validación en otra PC Windows, especialmente una sin MPASM preinstalado.
- Prueba manual del asistente y de creación de carpetas con un usuario nuevo.
- Prueba del HEX con el circuito específico de Proteus y el programador físico del curso.
- Identidad definitiva de publicador y material de Marketplace.

No se ha publicado en Marketplace, no se han redistribuido binarios de Microchip y no se anuncia simulación o programación de placas integrada.
