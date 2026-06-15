# QA Test Prep API

A small NestJS REST API used as a sandbox for practicing manual and automated QA testing. It implements a minimal e-commerce flow: user registration/login, a seeded product catalog, and order placement with role-based access control.

## Tech stack

- **NestJS 11** (Express platform)
- **TypeORM** with **better-sqlite3** (file-based SQLite database, schema auto-synced)
- **@nestjs/jwt** + **passport-jwt** for authentication
- **class-validator** / **class-transformer** for request validation (global `ValidationPipe` with `whitelist` + `transform`)
- **bcryptjs** for password hashing

## Project structure

```
src/
  app.module.ts       # root module: config, TypeORM connection, feature modules
  main.ts             # bootstraps the app and global validation pipe
  auth/
    auth.controller.ts   # POST /auth/register, POST /auth/login
    auth.service.ts      # registration + login, password hashing, JWT issuing
    dto/                  # RegisterDto, LoginDto
    strategies/           # JwtStrategy (validates Bearer tokens)
    guards/               # JwtAuthGuard, RolesGuard
    decorators/           # @CurrentUser(), @Roles()
  users/
    entities/user.entity.ts  # User entity (email, password hash, name, role)
    users.service.ts         # user lookup/creation, seeds a default admin
    users.controller.ts       # GET /api/admin/users (admin only)
  products/
    entities/product.entity.ts # Product entity (name, price, stock)
    products.service.ts        # lookup/save, seeds a starter catalog
  orders/
    entities/order.entity.ts   # Order entity (status, quantity, total, owner)
    dto/                        # CreateOrderDto, UpdateOrderStatusDto
    orders.service.ts          # create order, fetch order, status transitions
    orders.controller.ts       # POST /api/orders, GET /api/orders/:id, PATCH /api/orders/:id/status
postman/
  NestJS-QA-Collection.postman_collection.json   # Postman collection covering all endpoints
  NestJS-QA.postman_environment.json             # Postman environment (base URL, test creds, tokens)
```

## Current state of the system

### Auth (`/auth`)

| Method | Path             | Description                                  |
| ------ | ---------------- | --------------------------------------------- |
| POST   | `/auth/register` | Create a new user (`email`, `password` min 8 chars, `name`). Returns the created user (no password). |
| POST   | `/auth/login`    | Exchange `email`/`password` for a JWT (`access_token`, 1h expiry). |

### Orders (`/api/orders`) — requires `Authorization: Bearer <token>`

| Method | Path                      | Description |
| ------ | ------------------------- | ----------- |
| POST   | `/api/orders`             | Create an order for `productId` + `quantity` (1–10). Validates stock, decrements it, computes `total`. |
| GET    | `/api/orders/:id`         | Fetch an order. Owners or admins only (403 otherwise). |
| PATCH  | `/api/orders/:id/status`  | Update order status. Allowed transitions: `PENDING → CONFIRMED/CANCELLED`, `CONFIRMED → DELIVERED/CANCELLED`. `DELIVERED`/`CANCELLED` are terminal (422 if violated). |

### Admin (`/api/admin`) — requires `Authorization: Bearer <token>` + `ADMIN` role

| Method | Path              | Description                          |
| ------ | ----------------- | ------------------------------------- |
| GET    | `/api/admin/users` | List all users. Returns 403 for non-admins. |

### Data & seeding

On startup, the app connects to a local SQLite file (`database.sqlite` by default, overridable via `DB_PATH`) and auto-syncs the schema. Two seed steps run once if the tables are empty:

- **Products**: Wireless Mouse ($25, stock 100), Mechanical Keyboard ($75, stock 50), USB-C Hub ($40, stock 30).
- **Admin user**: `admin@example.com` / `Admin@12345` (role `ADMIN`).

### Configuration

Environment variables (all optional, with sensible defaults):

| Variable     | Default              | Purpose                          |
| ------------ | -------------------- | --------------------------------- |
| `DB_PATH`    | `database.sqlite`    | Path to the SQLite database file   |
| `JWT_SECRET` | `dev-secret`         | Secret used to sign/verify JWTs    |
| `PORT`       | `3000`                | HTTP port                          |

## Running the app

```bash
bun install

# development (watch mode)
bun run start:dev

# production
bun run build
bun run start:prod
```

The API listens on `http://localhost:3000` by default.

## Testing

The test suite has three layers, all built on Jest + `@nestjs/testing` + Supertest:

| Layer | Location | What it covers |
| ----- | -------- | --------------- |
| **Unit tests** | `src/**/*.spec.ts` | Services, guards, and strategies in isolation, with repositories/dependencies mocked (`AuthService`, `UsersService`, `ProductsService`, `OrdersService`, `RolesGuard`, `JwtStrategy`). |
| **Integration tests** | `test/*.e2e-spec.ts` | Full HTTP requests against a real Nest app wired with an in-memory SQLite database (`test/utils/test-app.ts`), covering auth, orders, and admin endpoints end-to-end. |
| **Regression tests** | `test/regression/*.e2e-spec.ts` | Pin down specific business rules so future changes can't silently break them: the full order status transition matrix, mass-assignment protection (extra fields like `role`/`userId` in request bodies must be ignored), and stock depletion/overselling behavior. |

```bash
bun run test            # unit tests (src/**/*.spec.ts)
bun run test:e2e        # integration + regression tests (test/**/*.e2e-spec.ts)
bun run test:regression # regression suite only (test/regression/**)
bun run test:cov        # coverage report
```

> Note: use `bun run test`, not bare `bun test`. Bun's native test runner evaluates the TypeORM entity decorators in a different order than Jest and trips over the circular `User` ↔ `Order` reference; the `test` script runs Jest (via `ts-jest`), which NestJS's testing utilities expect.

Integration and regression tests run against an isolated in-memory SQLite database created per test file (no `database.sqlite` file is touched), with the same product/admin seed data as a real run (3 seeded products, `admin@example.com` / `Admin@12345`).

### Manual testing with Postman

A ready-made collection is provided in [`postman/`](postman/):

1. Import `NestJS-QA-Collection.postman_collection.json` and `NestJS-QA.postman_environment.json` into Postman.
2. Select the **NestJS QA - Local** environment and confirm `base_url` points at your running instance (`http://localhost:3000`).
3. Run the **Auth** folder first:
   - *Register — happy path* creates a test user and stores credentials in `test_email` / `test_password`.
   - *Register — duplicate email (negative)* expects a `409 Conflict`.
   - *Login — happy path* stores the resulting token in `jwt_token`. There's also an admin login flow that stores `admin_jwt_token` using `admin_email` / `admin_password`.
   - *Login — wrong password / missing fields (negative)* expect `401`/`400`.
4. Run the **Orders** folder (uses `jwt_token`):
   - *Create order — happy path* stores the new order id in `order_id`.
   - *Create order — no JWT / invalid quantity / product not found (negative)* expect `401`/`400`/`404`.
   - *GET order by id* fetches the created order.
   - *PATCH order status — valid transition* moves the order from `PENDING` to `CONFIRMED`.
   - *PATCH order status — invalid transition (negative)* expects `422` on a terminal order (`order_id_terminal`).
5. Run the **Admin** folder:
   - *GET all users — as ROLE_ADMIN* (uses `admin_jwt_token`) expects `200` with the user list.
   - *GET all users — as ROLE_USER* (uses `jwt_token`) expects `403`.

This gives end-to-end coverage of registration, authentication, validation errors, ownership/role-based authorization, stock handling, and order status transitions.
