"""ASGI config for CPPay project - mounts Django under FastAPI."""
import os
from django.core.wsgi import get_wsgi_application
from fastapi import FastAPI
from fastapi.middleware.wsgi import WSGIMiddleware

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

# Get Django WSGI application for mounting
django_wsgi_app = get_wsgi_application()

# Import FastAPI app (after Django setup)
from api.main import app as fastapi_app

# Mount Django under FastAPI
# This allows FastAPI to handle all requests first, 
# then fall back to Django for admin and other Django views
fastapi_app.mount("/", WSGIMiddleware(django_wsgi_app))

# Export as application
application = fastapi_app
