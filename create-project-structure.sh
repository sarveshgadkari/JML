#!/bin/bash

# Judge My Lawyer - Project Structure Creator
# Run this script in your local directory to create the folder structure

echo "🏗️  Creating Judge My Lawyer project structure..."

# Create main directories
mkdir -p src/app/components/ui
mkdir -p src/app/components/figma
mkdir -p src/app/data
mkdir -p src/app/utils
mkdir -p src/styles
mkdir -p src/utils/supabase
mkdir -p supabase/functions/server
mkdir -p supabase/migrations
mkdir -p utils/supabase
mkdir -p guidelines

echo "✅ Created directory structure!"
echo ""
echo "📁 Folder structure:"
echo "."
echo "├── src/"
echo "│   ├── app/"
echo "│   │   ├── components/"
echo "│   │   │   ├── ui/"
echo "│   │   │   └── figma/"
echo "│   │   ├── data/"
echo "│   │   └── utils/"
echo "│   ├── styles/"
echo "│   └── utils/"
echo "│       └── supabase/"
echo "├── supabase/"
echo "│   ├── functions/"
echo "│   │   └── server/"
echo "│   └── migrations/"
echo "├── utils/"
echo "│   └── supabase/"
echo "└── guidelines/"
echo ""
echo "🎯 Next steps:"
echo "1. Copy files from Figma Make to these folders"
echo "2. See DOWNLOAD_GUIDE.md for complete file list"
echo "3. Run 'npm install' to install dependencies"
echo "4. Run 'npm run dev' to start development server"
echo ""
echo "✨ Happy coding!"
