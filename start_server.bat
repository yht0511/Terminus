@echo off
:: Set encoding to UTF-8
chcp 65001 >nul

:: Define the local Node.js installer file name (ensure it matches the downloaded file name)
set "NODE_INSTALLER=node-v20.17.0-x64.msi"

:: Define the desired port (force to 3322)
set PORT=3322

:: Check if Node.js is installed
node -v >nul 2>&1
if errorlevel 1 (
    echo Node.js is not installed.

    :: Change to the script directory (project root)
    cd /d "%~dp0"

    :: Check if the Node.js installer exists in the same directory
    if exist %NODE_INSTALLER% (
        echo Installing Node.js from local installer with progress...
        
        :: Install Node.js with progress bar (passive mode)
        msiexec /i %NODE_INSTALLER% /passive

        :: Manually update the PATH for the current session
        set "PATH=%PATH%;C:\Program Files\nodejs\"

        :: Check if Node.js is now available in the current session
        node -v >nul 2>&1
        if errorlevel 1 (
            echo Node.js installation failed or PATH update failed.
            pause
            exit /b 1
        )

        :: Update PATH environment variable globally for future sessions
        setx PATH "%PATH%;C:\Program Files\nodejs\"
        
        echo Node.js installation completed.

        :: Ensure npm is available
        npm -v >nul 2>&1
        if errorlevel 1 (
            echo npm is not available, Node.js installation may have failed.
            pause
            exit /b 1
        )

        :: Start the development server strictly on port 3322
        echo Starting development server on port %PORT%...
        start cmd /k "npm run dev -- --port %PORT% --strictPort"

        :: Wait for server to start
        timeout /t 5 /nobreak >nul

        :: Automatically open the browser with the correct port
        start http://localhost:%PORT%
    ) else (
        echo Node.js installer not found. Please ensure %NODE_INSTALLER% is in the same directory as this script.
        pause
        exit /b 1
    )
) else (
    echo Node.js detected.
    :: Change to the script directory (project root)
    cd /d "%~dp0"

    :: Ensure npm is available
    npm -v >nul 2>&1
    if errorlevel 1 (
        echo npm is not available, Node.js installation may have failed.
        pause
        exit /b 1
    )

    :: Start the development server strictly on port 3322
    echo Starting development server on port %PORT%...
    start cmd /k "npm run dev -- --port %PORT% --strictPort"

    :: Wait for server to start
    timeout /t 5 /nobreak >nul

    :: Automatically open the browser with the correct port
    start http://localhost:%PORT%
)
