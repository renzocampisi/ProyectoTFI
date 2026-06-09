@echo off
REM ============================================================
REM  FieldStock AI — arranca backend + frontend con un doble click
REM ============================================================
REM
REM  Abre dos ventanas de terminal:
REM    1) Backend  Node/Express en :3000
REM    2) Frontend Vite HTTPS    en :5173
REM
REM  Despues abre el browser apuntando al login.
REM
REM  Para parar todo: cerra las dos ventanas (X de cada una).
REM  Si una se cae sola, la podes relanzar corriendo este mismo
REM  archivo de nuevo — las que ya estan vivas las ignora porque
REM  los puertos quedan ocupados (Vite te avisa y usa otro puerto).
REM ============================================================

setlocal

REM Ubicacion del proyecto. Si moves la carpeta, editar esta linea.
set PROYECTO=D:\UAI\SAP\ProyectoFinal_TFI

REM Sanity check: si la carpeta no existe, frenar con mensaje claro
REM en vez de tirar errores de "ruta no encontrada" en cada ventana.
if not exist "%PROYECTO%" (
    echo.
    echo [ERROR] No se encontro la carpeta del proyecto:
    echo         %PROYECTO%
    echo.
    echo Editar este .bat y ajustar la variable PROYECTO arriba.
    pause
    exit /b 1
)

cd /d "%PROYECTO%"

echo.
echo Arrancando FieldStock AI...
echo   Backend:  http://localhost:3000
echo   Frontend: https://localhost:5173
echo.

REM Ventana 1: backend. El "/k" deja la terminal abierta despues del comando
REM (sino se cerraria al instante y no veriamos logs ni errores).
start "FieldStock Backend" cmd /k "cd /d %PROYECTO% && npm run dev --prefix fieldstock-backend"

REM Pequena pausa para que el backend levante antes que el frontend.
REM No es estrictamente necesario (Vite no depende del backend al arrancar)
REM pero evita que el primer request del front falle por backend no listo.
timeout /t 3 /nobreak >nul

REM Ventana 2: frontend con HTTPS para que la camara QR funcione desde mobile.
start "FieldStock Frontend" cmd /k "cd /d %PROYECTO% && npm run dev:https --prefix fieldstock-frontend"

REM Esperar a que Vite levante (~5-8s en cold start) antes de abrir browser.
timeout /t 8 /nobreak >nul

REM Abrir el login en el browser por defecto.
start "" "https://localhost:5173"

echo.
echo Listo. Si la pagina no carga, esperar 5-10 segundos mas y refrescar (F5).
echo La primera vez vas a tener que aceptar el cert autofirmado (Avanzado -> Continuar).
echo.
echo Esta ventana se puede cerrar.
echo Para parar la app, cerrar las dos ventanas "FieldStock Backend" y "FieldStock Frontend".
echo.

timeout /t 5 /nobreak >nul
endlocal
