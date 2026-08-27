.PHONY: install dev build test test-watch typecheck lint preview cert serve models

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

cert:
	@command -v mkcert >/dev/null 2>&1 || (echo "Install mkcert: brew install mkcert" && exit 1)
	mkdir -p certs
	@IP=$$(ipconfig getifaddr en0 2>/dev/null || echo 127.0.0.1); \
	mkcert -cert-file certs/cert.pem -key-file certs/key.pem localhost 127.0.0.1 $$IP
	@echo "rootCA.pem: $$(mkcert -CAROOT)/rootCA.pem — install this on the phone"

serve: build
	node scripts/serve.mjs

icons:
	node scripts/generate-icons.mjs

models:
	node scripts/generate-dice-models.mjs
