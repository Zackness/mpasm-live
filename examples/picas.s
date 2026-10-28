    PROCESSOR 18F4550
    #include <xc.inc>
; Ejemplo de ensamblado PIC-AS. Configura CONFIG y el circuito de tu placa.
; Para este ejemplo: picas.extraArgs = ["-Wl,-presetVec=0h"]
    GLOBAL resetVec
    PSECT resetVec,class=CODE,reloc=2
resetVec:
    goto inicio

    PSECT code
inicio:
    movlw 42
    movwf BANKMASK(LATC),c
bucle:
    bra bucle
    END resetVec
