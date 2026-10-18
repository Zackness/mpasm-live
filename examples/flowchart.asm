        LIST P=18F4550
        #include <p18f4550.inc>
; Ejemplo para el diagrama, no configura el hardware de una placa.
        ORG 0
        GOTO inicio

inicio
        MOVLW .0
        MOVWF 0x20, ACCESS

bucle
        BTFSC PORTB, 0, ACCESS
        CALL incrementar
        BRA bucle

incrementar
        INCF 0x20, F, ACCESS
        RETURN
        END
