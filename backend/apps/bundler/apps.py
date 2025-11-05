"""App configuration for the bundler gateway domain."""

from django.apps import AppConfig


class BundlerConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.bundler'
    verbose_name = 'Bundler Gateway'
