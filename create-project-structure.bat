@echo off
REM Judge My Lawyer - Project Structure Creator (Windows)
REM Run this script in your local directory to create the folder structure

echo Creating Judge My Lawyer project structure...
echo.

REM Create main directories
mkdir src\app\components\ui 2>nul
mkdir src\app\components\figma 2>nul
mkdir src\app\data 2>nul
mkdir src\app\utils 2>nul
mkdir src\styles 2>nul
mkdir src\utils\supabase 2>nul
mkdir supabase\functions\server 2>nul
mkdir supabase\migrations 2>nul
mkdir utils\supabase 2>nul
mkdir guidelines 2>nul

echo ✅ Created directory structure!
echo.
echo 📁 Folder structure created:
echo .
echo ├── src/
echo │   ├── app/
echo │   │   ├── components/
echo │   │   │   ├── ui/
echo │   │   │   └── figma/
echo │   │   ├── data/
echo │   │   └── utils/
echo │   ├── styles/
echo │   └── utils/
echo │       └── supabase/
echo ├── supabase/
echo │   ├── functions/
echo │   │   └── server/
echo │   └── migrations/
echo ├── utils/
echo │   └── supabase/
echo └── guidelines/
echo.
echo 🎯 Next steps:
echo 1. Copy files from Figma Make to these folders
echo 2. See DOWNLOAD_GUIDE.md for complete file list
echo 3. Run 'npm install' to install dependencies
echo 4. Run 'npm run dev' to start development server
echo.
echo ✨ Happy coding!
pause
