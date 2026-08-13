.PHONY: install dev build test test-watch typecheck lint preview

install:
	npm install

dev:
	npm run dev

build:
	npm run build

test:
	npm run test

test-watch:
	npm run test:watch

typecheck:
	npm run typecheck

lint:
	npm run lint

preview:
	npm run preview
