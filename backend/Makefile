.PHONY: help install dev-install test clean migrate run-django run-fastapi run-celery docker-up docker-down format lint

help:
	@echo "CPPay Backend - Available Commands:"
	@echo "  make install        - Install production dependencies"
	@echo "  make dev-install    - Install development dependencies"
	@echo "  make test           - Run tests with coverage"
	@echo "  make migrate        - Run database migrations"
	@echo "  make run-django     - Run Django development server"
	@echo "  make run-fastapi    - Run FastAPI development server"
	@echo "  make run-celery     - Run Celery worker"
	@echo "  make docker-up      - Start all Docker containers"
	@echo "  make docker-down    - Stop all Docker containers"
	@echo "  make format         - Format code with black and isort"
	@echo "  make lint           - Run flake8 linter"
	@echo "  make clean          - Clean up generated files"

install:
	pip install -r requirements/production.txt

dev-install:
	pip install -r requirements/development.txt

test:
	pytest

test-cov:
	pytest --cov=apps --cov=services --cov=api --cov-report=html --cov-report=term

migrate:
	python manage.py makemigrations
	python manage.py migrate

run-django:
	python manage.py runserver 8001

run-fastapi:
	uvicorn api.main:app --reload --port 8000

run-celery:
	celery -A config worker --loglevel=info

run-celery-beat:
	celery -A config beat --loglevel=info

docker-up:
	docker-compose up --build

docker-up-d:
	docker-compose up --build -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

format:
	black .
	isort .

lint:
	flake8 .
	mypy .

clean:
	find . -type f -name '*.pyc' -delete
	find . -type d -name '__pycache__' -delete
	find . -type d -name '*.egg-info' -exec rm -rf {} +
	rm -rf build/
	rm -rf dist/
	rm -rf .pytest_cache/
	rm -rf htmlcov/
	rm -rf .coverage

superuser:
	python manage.py createsuperuser

shell:
	python manage.py shell_plus

collectstatic:
	python manage.py collectstatic --noinput

check:
	python manage.py check

makemigrations:
	python manage.py makemigrations

showmigrations:
	python manage.py showmigrations
