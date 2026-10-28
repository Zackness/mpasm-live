# Historial

## 0.4.0 — 2026-10-28

- Lenguaje PIC-AS (XC8) para .s y .S, gramática TextMate y snippets propios.
- Colores para directivas PSECT/PROCESSOR/CONFIG, preprocesador, registros, constantes y etiquetas.
- Detección de XC8 PIC-AS y DFP por dispositivo, con selección manual.
- Revisión sin guardar con PIC-AS y ensamblado/enlace independiente a HEX.
- Fuentes adicionales y argumentos de enlace configurables; MPASM se conserva para .asm.
- Autocompletado desde el include del dispositivo de XC8 y configuración de colores por carpeta.
- Creación de práctica básica PIC-AS y pruebas reales con XC8 3.10.
- Compatibilidad con la extensión oficial: no se modifican sus proyectos ni se intercepta Ctrl+Shift+B para PIC-AS.

## 0.3.0 — 2026-10-18

- Diagrama de flujo del principal dentro de VS Code, sin ejecutar el ensamblador.
- Vistas resumida y detallada, zoom, navegación a líneas y búsqueda por etiquetas.
- Exportación SVG con símbolos basados en ISO 5807, sin afirmar certificación.
- Interpretación de decisiones/skip PIC18, saltos, llamadas, retornos y vectores ORG.
- Avisos explícitos para includes, macros, ensamblado condicional y destinos no resueltos.
- Detección de diagrama desactualizado y bloqueo de navegación/exportación hasta actualizarlo.
- Pruebas de flujo y prueba del comando en un host real de VS Code.

## 0.2.0 — 2026-10-18

- Detección de MPASM y asistente con selección manual y acceso al instalador oficial.
- Selección de principal por carpeta y creación de prácticas PIC18F4550.
- Revisión sobre copias temporales con buffers sin guardar e includes locales.
- Diagnósticos vinculados a sus archivos, control de resultados obsoletos y ejecución serializada.
- Salidas en build y retirada del HEX anterior si falla el ensamblado.
- Sugerencias de instrucciones y símbolos del dispositivo, ayuda al pasar el cursor y snippets.
- Restricciones de ejecución en carpetas sin confianza y Windows como plataforma inicial.
- Pruebas automáticas y documentación de instalación, límites y publicación.

## 0.1.0

- Prototipo local: revisión de un ASM y ensamblado con MPASMWIN.exe.
