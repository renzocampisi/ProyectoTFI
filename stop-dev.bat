@echo off
REM ============================================================
REM  FieldStock AI — para todos los procesos del dev server
REM ============================================================
REM
REM  Util cuando las ventanas se cerraron mal y quedaron procesos
REM  "fantasma" ocupando los puertos 3000 / 5173, o cuando queres
REM  parar todo con un solo doble click sin ir a cerrar ventana
REM  por ventana.
REM
REM  Estrategia:
REM    1) Matar las ventanas cmd.exe con titulo "FieldStock *"
REM       (eso ya elimina los procesos node hijos en cascada).
REM    2) Como red de seguridad, matar lo que este escuchando
REM       en los puertos 3000 (backend) y 5173 (frontend Vite).
REM
REM  NO mata otros procesos Node que tengas corriendo (Discord,
REM  VS Code servers, otras apps) — solo los que ocupan los
REM  puertos del proyecto.
REM ============================================================

setlocal enabledelayedexpansion

echo.
echo Parando FieldStock AI...
echo.

REM ── 1. Cerrar las ventanas marcadas "FieldStock ..." ────────
REM El /F fuerza el cierre, el /FI filtra por titulo de ventana.
REM El "*" en el filtro funciona como wildcard.
echo [1/2] Cerrando ventanas "FieldStock Backend" y "FieldStock Frontend"...
taskkill /F /FI "WINDOWTITLE eq FieldStock Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq FieldStock Frontend*" >nul 2>&1

REM ── 2. Matar procesos huerfanos en los puertos del proyecto ─
REM Si una ventana se cerro mal y dejo el proceso node colgado,
REM netstat lo detecta porque sigue escuchando el puerto.
echo [2/2] Liberando puertos 3000 y 5173...

for %%P in (3000 5173) do (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P " ^| findstr "LISTENING"') do (
        if not "%%A"=="0" (
            taskkill /F /PID %%A >nul 2>&1
            if !errorlevel! equ 0 (
                echo   Puerto %%P libre ^(PID %%A terminado^)
            )
        )
    )
)

echo.
echo Listo. Si todavia tenes problemas con los puertos, abrir un CMD
echo nuevo y correr:
echo     netstat -ano ^| findstr ":3000 :5173"
echo para ver si quedo algo escuchando.
echo.

timeout /t 4 /nobreak >nul
endlocal
