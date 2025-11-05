#!/bin/bash

# Script to create initial placeholder files for all Django apps

# Define apps
APPS=("wallets" "transactions" "payments" "kyc" "gas_sponsorship" "notifications")

for app in "${APPS[@]}"; do
    echo "Creating files for apps/$app..."
    
    # Create __init__.py
    touch "apps/$app/__init__.py"
    
    # Create apps.py
    cat > "apps/$app/apps.py" << EOF
"""
${app^} App Configuration
"""
from django.apps import AppConfig


class ${app^}Config(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.$app'
    verbose_name = '${app^}'
EOF

    # Create models.py placeholder
    cat > "apps/$app/models.py" << EOF
"""
${app^} Models
Will be implemented in subsequent phases
"""
from django.db import models

# Models will be added here
EOF

    # Create admin.py placeholder
    cat > "apps/$app/admin.py" << EOF
"""
${app^} Admin Configuration
"""
from django.contrib import admin

# Admin configurations will be added here
EOF

    # Create views.py placeholder (if needed for Django views)
    touch "apps/$app/views.py"
    
    # Create tests directory
    mkdir -p "apps/$app/tests"
    touch "apps/$app/tests/__init__.py"
    
done

echo "✅ All app placeholder files created successfully!"
