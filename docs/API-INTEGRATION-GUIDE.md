# Troziana Enterprise Travel & Umrah ERP — Frontend & QA API Integration Guide

This document is the **single authoritative API integration contract** for the independent **Next.js Frontend** and QA teams integrating with the **Troziana Enterprise Travel & Umrah ERP Backend**.

All endpoints, DTOs, permission codes, and workflows documented here have been programmatically verified against the live Express router (`src/main.ts` and `src/modules/**`).

---

## 1. Contract Files & Locations

| File | Path | Purpose |
| :--- | :--- | :--- |
| **OpenAPI 3.0.3 Specification** | [docs/openapi.json](file:///d:/00-%20Private/TrozianaSite/roziana-backend/docs/openapi.json) | Complete OpenAPI 3.0.3 JSON specification (also served live at `GET /api/v1/openapi.json` and rendered at `GET /api/v1/docs`) |
| **Postman Collection v2.1** | [docs/Troziana-API.postman_collection.json](file:///d:/00-%20Private/TrozianaSite/roziana-backend/docs/Troziana-API.postman_collection.json) | Importable Postman v2.1 collection with 21 module folders, pre-request scripts, and automated test assertions |
| **Postman Local Environment** | [docs/Troziana-Local.postman_environment.json](file:///d:/00-%20Private/TrozianaSite/roziana-backend/docs/Troziana-Local.postman_environment.json) | Importable Postman environment defining `baseUrl`, `accessToken`, `refreshToken`, `branchId`, `userId`, `tripId`, `bookingId`, etc. |
| **Standalone TypeScript Contract** | [src/contracts/frontend-api.contract.ts](file:///d:/00-%20Private/TrozianaSite/roziana-backend/src/contracts/frontend-api.contract.ts) | Zero-dependency TypeScript interfaces ready to copy into the Next.js repository |

---

## 2. Backend Base URL & Environment Variables

### Base URLs
- **Local Development Root**: `http://localhost:3000`
- **Versioned API Base URL**: `http://localhost:3000/api/v1`
- **Interactive Swagger UI**: `http://localhost:3000/api/v1/docs`
- **OpenAPI JSON Endpoint**: `http://localhost:3000/api/v1/openapi.json`

### Environment Variables (`.env` / `.env.example`)

| Variable | Default / Example | Required in Prod | Description |
| :--- | :--- | :---: | :--- |
| `NODE_ENV` | `development` | Yes | `development`, `test`, or `production` |
| `PORT` | `3000` | Yes | HTTP listening port |
| `DB_URI` | `mongodb://127.0.0.1:27017/TrozianaERP?replicaSet=rs0` | Yes | MongoDB connection string (Replica Set recommended for multi-document ACID transactions) |
| `ORIGINS` | `http://localhost:3000,http://localhost:3001` | Yes | Comma-separated list of allowed Next.js frontend origins for CORS (`credentials: true`) |
| `USER_TOKEN_SIGNTURE` | *(32+ char secret)* | Yes | HMAC secret for signing staff Access JWTs |
| `USER_REFRESH_TOKEN_SIGNTURE` | *(32+ char secret)* | Yes | HMAC secret for signing staff Refresh JWTs |
| `ADMIN_TOKEN_SIGNTURE` | *(32+ char secret)* | Yes | HMAC secret for signing Admin Access JWTs |
| `ADMIN_REFRESH_TOKEN_SIGNTURE` | *(32+ char secret)* | Yes | HMAC secret for signing Admin Refresh JWTs |
| `ACCESS_TOKEN_EXPIRES_IN` | `1800` (30 mins) | No | Access token lifetime in seconds |
| `REFRESH_TOKEN_EXPIRES_IN` | `31536000` (1 year) | No | Refresh token lifetime in seconds |
| `COOKIE_DOMAIN` | `localhost` | No | Domain attribute for `HttpOnly` auth cookies in production |
| `ENCRYPTION_SECRET` | *(32-char hex/string)* | Yes | AES-256-CBC secret key for encrypting sensitive fields |
| `SALT_ROUND` | `12` | No | Password hashing cost factor |
| `ENABLE_REDIS` | `false` | No | When `false`, falls back cleanly to an in-process memory TTL cache |
| `REDIS_URI` | `redis://127.0.0.1:6379` | Conditional | Required only when `ENABLE_REDIS=true` |
| `FILE_STORAGE_PROVIDER` | `LOCAL` | No | `LOCAL` (`./assets`) or `S3` |
| `PASSPORT_MIN_VALIDITY_MONTHS` | `6` | No | Minimum passport validity in months from trip departure date |
| `PASSPORT_VALIDITY_MODE` | `REJECT` | No | `REJECT` (blocks booking if passport < 6 months) or `WARN` |
| `DEFAULT_RESERVATION_HOLD_MINUTES` | `1440` (24 hours) | No | Default TTL hold duration for `ON_HOLD` seat reservations |
| `JOB_QUEUE_INTERVAL_MS` | `60000` | No | Background operational alert/hold-expiration job interval in ms |

---

## 3. Authentication, Token Rotation, Cookie Handling & Logout

### Dual Token Delivery (Bearer Header + HttpOnly Cookies)
When a user logs in via `POST /api/v1/auth/login` or refreshes via `POST /api/v1/auth/refresh-token`, the backend supports **both** Next.js Server/Client patterns simultaneously:
1. **JSON Response Body**: Returns `data.access_token` and `data.refresh_token`.
2. **HttpOnly Cookies**: Automatically sets `access_token` and `refresh_token` cookies (`HttpOnly; SameSite=Lax; Secure` in production).

### Sending Authenticated Requests from Next.js
The authentication middleware (`src/middleware/authentication.middleware.ts`) accepts tokens in any of the following ways:
- **Standard Bearer Header (Recommended for API clients & Next.js Server Actions)**:
  ```http
  Authorization: Bearer <access_token>
  ```
- **Legacy Prefix Header**:
  ```http
  Authorization: System <access_token>
  ```
- **Automatic Cookie Fallback**: If `credentials: "include"` is set on `fetch`/`axios`, the backend automatically reads `req.cookies.access_token`.

### Refreshing Tokens (`POST /api/v1/auth/refresh-token`)
- Pass the refresh token via header:
  ```http
  Authorization: Refresh <refresh_token>
  ```
  *(or `Authorization: Bearer <refresh_token>`, or via the `refresh_token` HttpOnly cookie)*.
- **Token Rotation & Reuse Detection**:
  - Every refresh token is stored as a SHA-256 hash in `UserSessionModel` grouped by `familyId`.
  - Calling `/api/v1/auth/refresh-token` marks the old session token as rotated (`isRevoked: true`, `replacedByJti`) and issues a new `access_token` and `refresh_token`.
  - **Security Breach Detection**: If a previously rotated refresh token is ever re-submitted, the backend immediately revokes **all sessions in that `familyId`** and returns `401 UNAUTHORIZED` (`Token reuse detected. All sessions in this family have been revoked`).

### Logout (`POST /api/v1/auth/logout`)
- Request body:
  - `{ "action": 0 }` — Revokes only the current device session (`LogoutEnum.only`).
  - `{ "action": 1 }` — Revokes **all** active sessions across all devices (`LogoutEnum.all`).
- Clears both `access_token` and `refresh_token` cookies.

---

## 4. Numeric Role Authorization System (`roleNumber` 1–8)

Each user holds a single numeric role (`roleNumber: UserRole`) stored directly on the `User` document and embedded in the JWT payload. Route-level authorization is enforced via `authorizeRoles(...allowedRoles: UserRole[])` in `src/middleware/authentication.middleware.ts`.

### User Role Enum (`UserRole`)

| `roleNumber` | Enum Name | Scope | Responsibilities |
| :---: | :--- | :---: | :--- |
| `1` | `SUPER_ADMIN` | Company-Wide (`isCentralAdmin: true`) | Full unrestricted access across all modules, branches, settings, and user roles. Protected from modification/deletion by non-`SUPER_ADMIN`. |
| `2` | `ADMIN` | Company-Wide (`isCentralAdmin: true`) | General Manager / Company-wide administrator across all operational & financial modules. Can manage users and assign roles `3..8` (cannot modify `SUPER_ADMIN` or other `ADMIN` accounts). |
| `3` | `BRANCH_MANAGER` | Branch-Scoped | Manages assigned branch bookings, confirmations, cancellations, passengers, branch cashbox, receipts, expenses, and branch reports; can view staff in own branch. |
| `4` | `ACCOUNTANT` | Company-Wide (`isCentralAdmin: true`) | Manages cashboxes, customer receipts, refunds, operational expenses, supplier payment vouchers, inter-cashbox transfers, and simplified double-entry accounting (CoA, automatic journals, P&L, and Balance Sheet). |
| `5` | `SALES` | Branch-Scoped | Manages branch/B2B passengers, bookings, seat reservations, receipts, and wholesale contracts within authorized branch scope. |
| `6` | `PROCUREMENT` | Company-Wide (`isCentralAdmin: true`) | Manages suppliers, flight lots (`DIRECT` / `BROKER`), hotel contracts (`FLAT_RATE` / `TIERED_RATE`), and pricing versions. |
| `7` | `OPERATIONS` | Company-Wide (`isCentralAdmin: true`) | Manages suppliers, flights, hotels, pricing + approval, trips, operational groups, seat quotas, bookings, manifests, rooming lists, and reports. |
| `8` | `EMPLOYEE` | Branch-Scoped | Branch POS employee: registers passengers, creates bookings/seat reservations, collects receipts, and generates operational documents within assigned branch. |

### Authenticated User Response Structure (`GET /api/v1/auth/me` & `POST /api/v1/auth/login`)
```json
{
  "success": true,
  "message": "Operation completed",
  "status": 200,
  "data": {
    "user": {
      "_id": "6733b0a1e4b0a1a2b3c4d5e1",
      "name": "Ahmed Cairo",
      "firstName": "Ahmed",
      "lastName": "Cairo",
      "userName": "Ahmed Cairo",
      "email": "cairo@troziana.com",
      "roleNumber": 3,
      "roleName": "BRANCH_MANAGER",
      "isActive": true,
      "accountStatus": "ACTIVE",
      "branchId": "6733b0a1e4b0a1a2b3c4d5b1",
      "primaryBranchId": "6733b0a1e4b0a1a2b3c4d5b1",
      "assignedBranchIds": [
        "6733b0a1e4b0a1a2b3c4d5b1"
      ],
      "canAccessAllBranches": false,
      "employeeCode": "EMP-CAI-01"
    },
    "roleNumber": 3,
    "roleName": "BRANCH_MANAGER",
    "branchContext": {
      "isCentralAdmin": false,
      "allowedBranchIds": [
        "6733b0a1e4b0a1a2b3c4d5b1"
      ],
      "activeBranchId": "6733b0a1e4b0a1a2b3c4d5b1"
    }
  },
  "meta": {}
}
```

---

## 5. Branch Context & Multi-Branch Isolation Policy

1. **Never Trust Unverified Client `branchId`**:
   - On every authenticated request, `authentication()` calls `resolveBranchContext(user, requestedBranchId)` to compute `req.branchContext`:
     - `isCentralAdmin`: `true` if `user.roleNumber` is in `COMPANY_WIDE_ROLES` (`1: SUPER_ADMIN`, `2: ADMIN`, `4: ACCOUNTANT`, `6: PROCUREMENT`, `7: OPERATIONS`) or `user.canAccessAllBranches === true`.
     - `allowedBranchIds`: Array of branch ObjectIds assigned to the user (`branchId`, `primaryBranchId`, `assignedBranchIds`).
     - `activeBranchId`: Defaults to `branchId` / `primaryBranchId`, or can be switched by passing header `x-branch-id: <branchId>` or query `?branchId=<branchId>` **only if** that `branchId` is in `allowedBranchIds` (or `isCentralAdmin` is `true`).
2. **Cross-Branch Protection Behavior**:
   - **List / Filter Queries (`GET /passengers?branchId=X`, `GET /bookings?branchId=X`, `GET /users?branchId=X`)**: If a branch user (`BRANCH_MANAGER=3`, `SALES=5`, `EMPLOYEE=8`) passes a `branchId` outside their `allowedBranchIds`, `resolveScopedBranchFilter` immediately throws **`403 FORBIDDEN`**. If no `branchId` is passed, results are automatically filtered to `{ branchId: { $in: allowedBranchIds } }`.
   - **Single Resource Queries (`GET /passengers/:id`, `GET /bookings/:id`)**: Scoped by `{ _id: id, branchId: { $in: allowedBranchIds } }`. Accessing another branch's record returns **`404 NOT_FOUND`** so record existence is never leaked across branches.
   - **Mutations (`POST /bookings`, `POST /receipts`, `POST /expenses`)**: `assertBranchAccess` validates the target `branchId` against `allowedBranchIds` and throws **`403 FORBIDDEN`** on unauthorized branch targets.

---

## 6. Standard Response Envelope, Pagination & Error Handling

### Standard Success Response (`200 OK` / `201 Created`)
```json
{
  "success": true,
  "message": "Operation completed",
  "status": 200,
  "data": { ... },
  "meta": {
    "totalDocs": 42,
    "limit": 25,
    "page": 1,
    "totalPages": 2
  }
}
```
> **Note on Paginated Endpoints**: Paginated endpoints (`/users`, `/branches`, `/suppliers`, `/flights`, `/hotels/contracts`, `/pricing`, `/trips`, `/passengers`, `/bookings`, `/audit-logs`) return `{ docs: [...], totalDocs, pagination: { limit, page, totalPages } }` inside `data`, and also hoist `totalDocs`, `limit`, `page`, `totalPages` into top-level `meta`.

### Standard Error Response (`400` / `401` / `403` / `404` / `409` / `422` / `500`)
```json
{
  "success": false,
  "message": "No available seats remaining in trip shared inventory",
  "error_message": "No available seats remaining in trip shared inventory",
  "code": "INSUFFICIENT_INVENTORY",
  "status": 409,
  "errors": null
}
```

| HTTP Status | Error `code` | When It Occurs |
| :---: | :--- | :--- |
| `400` | `VALIDATION_ERROR` / `BAD_REQUEST` | Zod request validation failed (field-level issues in `errors` array) or business input invalid (e.g. discount below `minimumSellingPriceEgp`) |
| `401` | `UNAUTHORIZED` | Missing/expired JWT, revoked session, or refresh token reuse detected |
| `403` | `FORBIDDEN` | User lacks required RBAC permission or attempted cross-branch access |
| `404` | `NOT_FOUND` | Entity ID does not exist or belongs to an unauthorized branch |
| `409` | `CONFLICT` / `INSUFFICIENT_INVENTORY` / `TRANSACTION_CONFLICT` | Duplicate unique code/email, final seat race lost (`availableInventory === 0`), or transient write conflict |
| `422` | `INSUFFICIENT_BALANCE` / `ACCOUNTING_INTEGRITY_ERROR` / `INVALID_STATE_TRANSITION` | Cashbox balance insufficient for expense/refund, unbalanced journal entry (`Debits !== Credits`), or illegal booking status transition |

---

## 7. Complete Verified Endpoint Inventory (All 97 Endpoints)

### 7.1 System & Documentation
| Method | Endpoint | Auth | Permission | Branch Scoped | Description |
| :---: | :--- | :---: | :---: | :---: | :--- |
| `GET` | `/` | No | — | No | Root health check |
| `GET` | `/api/v1/openapi.json` | No | — | No | Raw OpenAPI 3.0.3 JSON specification |
| `GET` | `/api/v1/docs` | No | — | No | Interactive Swagger UI |

### 7.2 Authentication (`/api/v1/auth`)
| Method | Endpoint | Auth | Allowed Roles (`roleNumber`) | Description |
| :---: | :--- | :---: | :---: | :--- |
| `POST` | `/api/v1/auth/login` | No | Public | Authenticate user; returns tokens, `roleNumber`, `roleName`, `branchContext`, and sets HttpOnly cookies |
| `POST` | `/api/v1/auth/refresh-token` | Refresh | Any Active Role (`1..8`) | Rotate refresh token with reuse detection |
| `GET` | `/api/v1/auth/me` | Yes | Any Active Role (`1..8`) | Get current user, `roleNumber`, `roleName`, and `branchContext` |
| `PATCH` | `/api/v1/auth/change-password` | Yes | Any Active Role (`1..8`) | Change own password (when logged in) and revoke other sessions |
| `GET` | `/api/v1/auth/sessions` | Yes | Any Active Role (`1..8`) | List active device sessions |
| `DELETE` | `/api/v1/auth/sessions/:sessionId` | Yes | Any Active Role (`1..8`) | Revoke a specific session |
| `POST` | `/api/v1/auth/logout` | Yes | Any Active Role (`1..8`) | Logout current device (`action: 0`) or all devices (`action: 1`) |

### 7.3 Users (`/api/v1/users`)
| Method | Endpoint | Auth | Allowed Roles (`roleNumber`) | Branch Scoped | Description |
| :---: | :--- | :---: | :---: | :---: | :--- |
| `PATCH` | `/api/v1/users/profile` | Yes | Any Active Role (`1..8`) | No | Update own profile (`name`, `firstName`, `lastName`, `phone`, `gender`) |
| `GET` | `/api/v1/users` | Yes | `1, 2, 3` | Yes | Paginated user list (`page`, `limit`, `roleNumber`, `branchId`, `isActive`, `status`, `search`) |
| `POST` | `/api/v1/users` | Yes | `1, 2` | No | Create user with numeric `roleNumber` (`1..8`) and `branchId` |
| `GET` | `/api/v1/users/:id` | Yes | `1, 2, 3` | Yes | Get user details by ID |
| `PATCH` | `/api/v1/users/:id` | Yes | `1, 2` | No | Update user details, branch assignments (`branchId`, `assignedBranchIds`, `canAccessAllBranches`), or status (`isActive` / `accountStatus`) |
| `PATCH` | `/api/v1/users/:id/role` | Yes | `1, 2` | No | Change user numeric `roleNumber` (`1..8`) with escalation & self-change protection |
| `PATCH` | `/api/v1/users/:id/reset-password` | Yes | `1, 2` | No | Administrative password reset and session revocation |
| `DELETE` | `/api/v1/users/:id` | Yes | `1, 2` | No | Deactivate and archive user account |

### 7.4 Branches (`/api/v1/branches`)
| Method | Endpoint | Auth | Permission | Branch Scoped | Description |
| :---: | :--- | :---: | :---: | :---: | :--- |
| `GET` | `/api/v1/branches` | Yes | `branches.read` | Yes | List accessible branches (`page`, `limit`, `status`, `governorate`) |
| `GET` | `/api/v1/branches/:id` | Yes | `branches.read` | Yes | Get branch details by ID |
| `POST` | `/api/v1/branches` | Yes | `branches.manage` | No | Create new branch |
| `PATCH` | `/api/v1/branches/:id` | Yes | `branches.manage` | No | Update branch details or status |

### 7.5 Suppliers, Flights & Hotels (`/api/v1/suppliers`, `/api/v1/flights`, `/api/v1/hotels`)
| Method | Endpoint | Auth | Permission | Description |
| :---: | :--- | :---: | :---: | :--- |
| `GET` | `/api/v1/suppliers` | Yes | `suppliers.read` | List suppliers (`page`, `limit`, `type`, `status`, `currency`) |
| `POST` | `/api/v1/suppliers` | Yes | `suppliers.create` | Create supplier with optional opening balance |
| `GET` | `/api/v1/suppliers/:id/statement` | Yes | `suppliers.read` | Get chronological supplier ledger statement & verified balance |
| `POST` | `/api/v1/suppliers/:id/ledger-entries` | Yes | `suppliers.update` | Record manual ledger entry / credit note / adjustment |
| `GET` | `/api/v1/suppliers/aging-report` | Yes | `suppliers.read` | Get supplier aging buckets and overdue payment schedule |
| `GET` | `/api/v1/flights` | Yes | `flights.read` | List flight lots (`page`, `limit`, `status`, `airline`, `supplierId`, `purchaseSource`) |
| `GET` | `/api/v1/flights/:id` | Yes | `flights.read` | Get flight lot details |
| `POST` | `/api/v1/flights` | Yes | `flights.create` | Create flight lot (`DIRECT` / `BROKER`) and post supplier liability |
| `PATCH` | `/api/v1/flights/:id` | Yes | `flights.update` | Update flight lot and reconcile supplier liability delta |
| `PATCH` | `/api/v1/flights/:id/archive` | Yes | `flights.archive` | Archive unused flight lot |
| `GET` | `/api/v1/hotels` | Yes | `hotels.read` | List hotels across any domestic or international city (`?city=`) |
| `POST` | `/api/v1/hotels` | Yes | `hotels.create` | Create hotel master record (`city`, `country`, `stars`, optional `distanceToHaramMeters`) |
| `GET` | `/api/v1/hotels/contracts` | Yes | `hotels.read` | List hotel contracts (`page`, `limit`, `city`, `hotelId`, `supplierId`, `status`) |
| `POST` | `/api/v1/hotels/contracts` | Yes | `hotels.create` | Create hotel contract (`FLAT_RATE` or `TIERED_RATE`, `SINGLE`/`DOUBLE`/`TRIPLE`/`QUAD`) and post supplier liability |
| `PATCH` | `/api/v1/hotels/contracts/:id/amend` | Yes | `hotels.update` | Amend hotel contract capacities/nights/rates and post ledger delta |

### 7.6 Pricing, Trips & Quotas (`/api/v1/pricing`, `/api/v1/trips`, `/api/v1/quotas`)
| Method | Endpoint | Auth | Permission | Branch Scoped | Description |
| :---: | :--- | :---: | :---: | :---: | :--- |
| `POST` | `/api/v1/pricing/simulate` | Yes | `pricing.read` | No | Stateless pricing scenario simulation (`SINGLE`, `DOUBLE`, `TRIPLE`, `QUAD`, `CHILD`, `INFANT`) |
| `GET` | `/api/v1/pricing` | Yes | `pricing.read` | No | List saved pricing versions (`page`, `limit`, `tripId`, `status`) |
| `POST` | `/api/v1/pricing` | Yes | `pricing.create` | No | Create and persist a pricing version (supports both Umrah 2-hotel SAR inputs and general `hotelPerPersonStayCost`) |
| `PATCH` | `/api/v1/pricing/:id/approve` | Yes | `pricing.approve` | No | Approve pricing version and bind to trip |
| `GET` | `/api/v1/trips` | Yes | `trips.read` | No | List tourism programs (`page`, `limit`, `tripCategory`, `destination`, `transportType`, `season`, `status`, `quotaMode`) |
| `GET` | `/api/v1/trips/:id` | Yes | `trips.read` | No | Get trip details, `coverImage`, `galleryImages`, `itinerary`, allocations, pricing, and groups |
| `POST` | `/api/v1/trips` | Yes | `trips.create` | No | Create tourism program (`DOMESTIC`, `RELIGIOUS`, or `OUTBOUND`, with `coverImage`, `galleryImages`, and daily `itinerary`) |
| `PATCH` | `/api/v1/trips/:id` | Yes | `trips.update` | No | Update trip status or metadata |
| `POST` | `/api/v1/trips/groups` | Yes | `trips.create` | No | Create supervised operational group inside trip |
| `GET` | `/api/v1/quotas` | Yes | `quotas.read` | Yes | List branch seat quotas (`tripId`, `branchId`) |
| `GET` | `/api/v1/quotas/movements` | Yes | `quotas.read` | Yes | List seat inventory movements log |
| `POST` | `/api/v1/quotas/allocate` | Yes | `quotas.manage` | No | Allocate seats from trip shared pool to a branch |
| `POST` | `/api/v1/quotas/transfer` | Yes | `quotas.manage` | No | Transfer allocated seats between two branches |
| `POST` | `/api/v1/quotas/release` | Yes | `quotas.manage` | No | Release branch quota seats back to trip shared pool |

### 7.7 Passengers, Bookings & Wholesale (`/api/v1/passengers`, `/api/v1/bookings`, `/api/v1/wholesale`)
| Method | Endpoint | Auth | Permission | Branch Scoped | Description |
| :---: | :--- | :---: | :---: | :---: | :--- |
| `POST` | `/api/v1/passengers/parse-national-id` | Yes | `passengers.read` | No | Parse 14-digit Egyptian National ID (DOB, gender, governorate, age category) |
| `GET` | `/api/v1/passengers` | Yes | `passengers.read` | Yes | List passengers (`page`, `limit`, `branchId`, `search`, `familyGroupCode`) |
| `GET` | `/api/v1/passengers/:id` | Yes | `passengers.read` | Yes | Get passenger profile by ID |
| `POST` | `/api/v1/passengers` | Yes | `passengers.create` | Yes | Register passenger with National ID parsing (passport fields optional for `DOMESTIC` tourism, required for `RELIGIOUS` / `OUTBOUND`) |
| `PATCH` | `/api/v1/passengers/:id` | Yes | `passengers.update` | Yes | Update passenger, visa status, or document readiness |
| `GET` | `/api/v1/bookings` | Yes | `bookings.read` | Yes | List bookings (`page`, `limit`, `branchId`, `tripId`, `status`, `passengerId`, `familyGroupCode`, `bookingNumber`) |
| `GET` | `/api/v1/bookings/:id` | Yes | `bookings.read` | Yes | Get booking details with locked `pricingSnapshot` |
| `POST` | `/api/v1/bookings` | Yes | `bookings.create` | Yes | Create POS booking (`SINGLE`, `DOUBLE`, `TRIPLE`, `QUAD`), validate discount floor, reserve seat (`Idempotency-Key` supported) |
| `POST` | `/api/v1/bookings/:id/confirm` | Yes | `bookings.confirm` | Yes | Confirm booking and convert seat hold to consumed |
| `POST` | `/api/v1/bookings/:id/cancel` | Yes | `bookings.cancel` | Yes | Cancel booking and release seat back to inventory |
| `PATCH` | `/api/v1/bookings/:id` | Yes | `bookings.update` | Yes | Update booking operational `groupId`, `familyGroupCode`, `mahramPassengerId`, or `notes` |
| `GET` | `/api/v1/wholesale/partners` | Yes | `wholesale.read` | No | List B2B wholesale partner agencies |
| `POST` | `/api/v1/wholesale/partners` | Yes | `wholesale.manage` | No | Create B2B wholesale partner agency |
| `GET` | `/api/v1/wholesale/contracts` | Yes | `wholesale.read` | Yes | List B2B wholesale contracts (`branchId`, `tripId`, `partnerId`) |
| `POST` | `/api/v1/wholesale/contracts` | Yes | `wholesale.manage` | Yes | Create B2B wholesale seat-block or full-trip contract |
| `POST` | `/api/v1/wholesale/contracts/:id/release-seats` | Yes | `wholesale.manage` | Yes | Release unused seats from wholesale contract back to trip pool |

### 7.8 Cashboxes, Receipts, Expenses, Transfers & Accounting
| Method | Endpoint | Auth | Permission | Branch Scoped | Description |
| :---: | :--- | :---: | :---: | :---: | :--- |
| `GET` | `/api/v1/cashboxes` | Yes | `finance.cashboxes.read` | Yes | List branch cashboxes (`branchId`, `currency`) |
| `POST` | `/api/v1/cashboxes` | Yes | `finance.cashboxes.manage` | Yes | Create cashbox with optional opening balance & GL journal |
| `GET` | `/api/v1/cashboxes/:id/transactions` | Yes | `finance.cashboxes.read` | Yes | Get chronological cashbox transaction ledger |
| `POST` | `/api/v1/cashboxes/:id/close-daily` | Yes | `finance.cashboxes.manage` | Yes | Reconcile and close daily cashbox balance |
| `GET` | `/api/v1/receipts` | Yes | `finance.receipts.read` | Yes | List customer receipts and refunds (`branchId`, `bookingId`, `tripId`, `receiptType`) |
| `POST` | `/api/v1/receipts` | Yes | `finance.receipts.create` | Yes | Issue customer payment receipt (`Idempotency-Key` supported) |
| `POST` | `/api/v1/receipts/refund` | Yes | `finance.receipts.approve` | Yes | Issue customer refund voucher |
| `GET` | `/api/v1/expenses` | Yes | `finance.expenses.read` | Yes | List operational expenses and supplier payment vouchers |
| `POST` | `/api/v1/expenses` | Yes | `finance.expenses.create` | Yes | Record operational expense or supplier payment voucher |
| `GET` | `/api/v1/transfers` | Yes | `finance.transfers.manage` | No | List inter-cashbox transfers |
| `POST` | `/api/v1/transfers` | Yes | `finance.transfers.manage` | No | Execute atomic inter-cashbox transfer |
| `GET` | `/api/v1/accounting/accounts` | Yes | `accounting.read` | No | List Chart of Accounts with running balances |
| `GET` | `/api/v1/accounting/journal-entries` | Yes | `accounting.read` | No | List automatic double-entry journal entries (`sourceModule`, `branchId`, `tripId`, `status`) |
| `GET` | `/api/v1/accounting/financial-statements` | Yes | `accounting.read` | No | Get Profit & Loss (P&L) and Balance Sheet |

### 7.9 Documents, Reports, Notifications, Audit Logs & Settings
| Method | Endpoint | Auth | Permission | Branch Scoped | Description |
| :---: | :--- | :---: | :---: | :---: | :--- |
| `GET` | `/api/v1/documents/flyer/:tripId` | Yes | `documents.read` | Yes | Get promotional trip flyer data |
| `GET` | `/api/v1/documents/manifest/:tripId` | Yes | `documents.read` | Yes | Get official Arabic passenger manifest data |
| `GET` | `/api/v1/documents/rooming-list/:tripId` | Yes | `documents.read` | Yes | Get printable hotel rooming list (`?city=MAKKAH\|MADINAH`) grouped by `roomType` & `familyGroupCode` with blank `roomNumber` for manual handwriting after arrival |
| `GET` | `/api/v1/documents/receipts/:receiptId` | Yes | `documents.read` | Yes | Get printable customer receipt voucher data |
| `GET` | `/api/v1/reports/trip-profitability` | Yes | `reports.read` | No | Compare Forecast vs Operational Actual vs Accounting profit |
| `GET` | `/api/v1/reports/branch-performance` | Yes | `reports.read` | Yes | Branch sales, confirmed seats, collections, and receivables |
| `GET` | `/api/v1/reports/executive-summary` | Yes | `reports.read` | Yes | Executive summary (cashboxes, supplier liabilities, expenses, receivables) |
| `GET` | `/api/v1/notifications` | Yes | — | Yes | List in-app notifications (`?unreadOnly=true`) |
| `PATCH` | `/api/v1/notifications/:id/read` | Yes | — | Yes | Mark notification as read |
| `GET` | `/api/v1/audit-logs` | Yes | `audit.read` | Yes | Search immutable audit logs (`branchId`, `module`, `action`, `entityType`, `fromDate`, `toDate`) |
| `GET` | `/api/v1/settings/company` | Yes | — | No | Get company profile & branding (`nameAr`, `nameEn`, `logoUrl`, `primaryColor`, `secondaryColor`, `tourismLicenseNumber`, `supportedTourismTypes`) |
| `PATCH` | `/api/v1/settings/company` | Yes | `settings.manage` | No | Update company profile, `logoUrl`, brand colors, license numbers, and contact info |
| `GET` | `/api/v1/settings` | Yes | — | No | List system configuration settings (`?category=`) |
| `PUT` | `/api/v1/settings/:key` | Yes | `settings.manage` | No | Upsert system setting by key |
| `POST` | `/api/v1/settings/attachments` | Yes | — | Yes | Upload protected file attachment (`multipart/form-data`, field `file`) |
| `GET` | `/api/v1/settings/attachments` | Yes | — | Yes | List uploaded file attachments (`relatedEntityType`, `relatedEntityId`) |

---

## 8. Realistic Example Requests & Responses for Key Workflows

### 8.1 Create Hotel Contract (`POST /api/v1/hotels/contracts`)
**Request:**
```json
{
  "hotelId": "6733b0a1e4b0a1a2b3c4d5c3",
  "supplierId": "6733b0a1e4b0a1a2b3c4d5c1",
  "city": "MAKKAH",
  "checkIn": "2027-01-10T00:00:00.000Z",
  "checkOut": "2027-01-15T00:00:00.000Z",
  "nights": 5,
  "roomCapacities": { "doubleRooms": 0, "tripleRooms": 0, "quadRooms": 10 },
  "pricingMode": "FLAT_RATE",
  "currency": "SAR",
  "rates": { "flatRoomRatePerNight": 800 },
  "exchangeRateToEgp": 13.5
}
```
**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Operation completed",
  "status": 201,
  "data": {
    "_id": "6733b0a1e4b0a1a2b3c4d5c4",
    "contractNumber": "HC-2026-00001",
    "hotelId": "6733b0a1e4b0a1a2b3c4d5c3",
    "supplierId": "6733b0a1e4b0a1a2b3c4d5c1",
    "city": "MAKKAH",
    "nights": 5,
    "pricingMode": "FLAT_RATE",
    "currency": "SAR",
    "derivedRates": {
      "doubleRoomPerNight": 800,
      "tripleRoomPerNight": 800,
      "quadRoomPerNight": 800,
      "doublePerPersonPerNight": 400,
      "triplePerPersonPerNight": 266.67,
      "quadPerPersonPerNight": 200,
      "doublePerPersonStay": 2000,
      "triplePerPersonStay": 1333.33,
      "quadPerPersonStay": 1000
    },
    "contractValue": 40000,
    "contractValueInEgp": 540000,
    "status": "ACTIVE"
  },
  "meta": {}
}
```

### 8.2 Create POS Booking (`POST /api/v1/bookings`)
**Request:**
```json
{
  "tripId": "6733b0a1e4b0a1a2b3c4d5d1",
  "passengerId": "6733b0a1e4b0a1a2b3c4d5d2",
  "branchId": "6733b0a1e4b0a1a2b3c4d5b1",
  "roomType": "QUAD",
  "discountAmount": 1000,
  "status": "ON_HOLD",
  "familyGroupCode": "FAM-01"
}
```
**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Operation completed",
  "status": 201,
  "data": {
    "_id": "6733b0a1e4b0a1a2b3c4d5d3",
    "bookingNumber": "BK-2026-00001",
    "tripId": "6733b0a1e4b0a1a2b3c4d5d1",
    "passengerId": "6733b0a1e4b0a1a2b3c4d5d2",
    "branchId": "6733b0a1e4b0a1a2b3c4d5b1",
    "roomType": "QUAD",
    "passengerCategory": "QUAD",
    "pricingSnapshot": {
      "pricingVersionId": "6733b0a1e4b0a1a2b3c4d5c5",
      "exchangeRateSarToEgp": 13.5,
      "category": "QUAD",
      "baseCostEgp": 51877.5,
      "standardSellingPriceEgp": 59660,
      "minimumSellingPriceEgp": 56677
    },
    "discountAmount": 1000,
    "netSellingPrice": 58660,
    "amountPaid": 0,
    "remainingBalance": 58660,
    "status": "ON_HOLD",
    "seatReservationId": "6733b0a1e4b0a1a2b3c4d5e9"
  },
  "meta": {}
}
```

---

## 9. Postman Collection Usage Guide

1. Open Postman and click **Import**.
2. Select both files from `docs/`:
   - [docs/Troziana-API.postman_collection.json](file:///d:/00-%20Private/TrozianaSite/roziana-backend/docs/Troziana-API.postman_collection.json)
   - [docs/Troziana-Local.postman_environment.json](file:///d:/00-%20Private/TrozianaSite/roziana-backend/docs/Troziana-Local.postman_environment.json)
3. Select the **"Troziana ERP — Local Development"** environment in the top-right environment selector.
4. Run **Authentication -> 1. Login (Admin / Staff)**:
   - Its post-response test script automatically extracts `access_token`, `refresh_token`, `userId`, and `branchId` and stores them in your Postman variables.
5. Run requests in sequence (`Suppliers` -> `Flights` -> `Hotels` -> `Pricing` -> `Trips` -> `Passengers` -> `Bookings` -> `Cashboxes` -> `Receipts` -> `Accounting`):
   - Each creation request automatically saves its returned `_id` (`supplierId`, `flightLotId`, `hotelId`, `hotelContractId`, `pricingVersionId`, `tripId`, `passengerId`, `bookingId`, `cashboxId`, `receiptId`, `journalId`) for downstream requests.
6. **Testing Branch Isolation**:
   - Update the `branchId` environment variable or change the `x-branch-id` header, or log in as a branch-scoped user (`cairo@troziana.com`) and run `[Negative Test] Cross-Branch Isolation Check (403 FORBIDDEN)`.

---

## 9.1 Telegram Executive Bot & Real-Time Alerts (`src/common/service/telegram.service.ts`)

The backend includes a built-in, zero-dependency **Telegram Executive Assistant & Notification Bot** for the General Manager, fully manageable dynamically from the **Settings API** (with no server restart required):
- **Dynamic Settings Management (`GET /api/v1/settings?category=TELEGRAM` & `PUT /api/v1/settings/:key`)**:
  1. `PUT /api/v1/settings/TELEGRAM_BOT_TOKEN`:
     - Body: `{ "value": "123456:ABC-DEF...", "category": "TELEGRAM" }`
     - Updates the Telegram Bot Token and immediately starts polling without restarting the server.
  2. `PUT /api/v1/settings/TELEGRAM_ADMIN_CHAT_ID`:
     - **Add a new Admin Chat ID (without overwriting existing IDs)**:
       `{ "action": "ADD", "value": "987654321" }` (immediately sends a welcome message with the report keyboard to the newly added Telegram account).
     - **Remove an Admin Chat ID**:
       `{ "action": "REMOVE", "value": "987654321" }`
     - **Replace full list**:
       `{ "action": "SET", "value": ["123456789", "987654321"] }`
  3. `PUT /api/v1/settings/TELEGRAM_SUMMARY_INTERVAL_MINUTES`:
     - Body: `{ "value": 720, "category": "TELEGRAM" }`
     - Controls how often (in minutes) the bot automatically pushes a periodic Executive Summary report to the General Manager (e.g., `720` = every 12 hours, `1440` = once every 24 hours, `0` = disable automatic periodic summary and send only instant event alerts & on-demand reports).
- **Interactive Arabic Keyboard & Commands**:
  - `/start` or `/menu`: Displays the persistent Arabic executive keyboard.
  - `📊 الملخص التنفيذي` (`/summary`): Live cashboxes total, customer receivables, B2B wholesale contracts, expenses, active trips, and supplier liabilities.
  - `💰 أرصدة الخزائن` (`/cashboxes`): Detailed balances, inflows, outflows, and last daily closure date for every cashbox.
  - `✈️ حالة الرحلات والمقاعد` (`/trips`): Capacity, confirmed seats, temporary holds, and remaining available seats per trip.
  - `🏢 أداء الفروع` (`/branches`): Total bookings, confirmed seats, net sales, collected cash, collection efficiency %, and remaining receivables per branch.
  - `📈 أرباح الرحلات` (`/profit`): Forecast profit vs. actual operational revenue, cost, and net profit per trip.
  - `🔔 آخر التنبيهات` (`/alerts`): Latest 10 operational and financial notifications.
- **Automatic Real-Time & Periodic Alerts**:
  - Instant Telegram notifications on **low trip seat inventory (< 10%)**, **overdue supplier payment obligations**, **expired booking seat holds**, **daily cashbox closures (with shortage/surplus discrepancy status)**, and **customer booking refunds**, plus periodic executive summaries.

---

## 10. Honest Identification of Incomplete / Deferred Features

Per Requirement 10 ("Identify incomplete endpoints and features honestly. Do not invent APIs that are not implemented"):

1. **PDF & Excel Binary File Rendering (JSON Data Endpoints Implemented)**:
   - The backend implements full structured data generation endpoints for Trip Flyers (`GET /api/v1/documents/flyer/:tripId`), Official Arabic Passenger Manifests (`GET /api/v1/documents/manifest/:tripId`), Hotel Rooming Lists (`GET /api/v1/documents/rooming-list/:tripId`), Printable Receipts (`GET /api/v1/documents/receipts/:receiptId`), and Financial Reports (`GET /api/v1/reports/*`).
   - Binary `.pdf` and `.xlsx` rendering is designed to be performed by the Next.js frontend print/export views using these structured JSON payloads; no server-side binary PDF/Excel streaming endpoint is exposed.
2. **Automated Optical Character Recognition (OCR) Vision Extraction**:
   - The Passenger model (`ocrRawDraft`) and `POST /api/v1/passengers` accept and store OCR-extracted passport/ID draft metadata, and `POST /api/v1/passengers/parse-national-id` deterministically parses 14-digit Egyptian National IDs and computes MRZ check digits (`computeMrzCheckDigit`).
   - However, no external AI/Vision OCR API (e.g., Google Cloud Vision / AWS Textract) is called automatically when uploading a raw image to `/api/v1/settings/attachments`.
3. **External Payment Gateway Webhooks**:
   - Receipts (`POST /api/v1/receipts`) record `CASH`, `BANK_TRANSFER`, `POS_CARD`, and `CHEQUE` payments with reference codes, but live third-party payment gateway webhook callbacks (e.g., Paymob / Fawry) are not implemented.
4. **Supplier & Wholesale Detail Update/Delete Endpoints**:
   - `suppliers` supports `GET /`, `POST /`, `GET /:id/statement`, `POST /:id/ledger-entries`, and `GET /aging-report`, but does not expose a separate `PATCH /api/v1/suppliers/:id` metadata edit route.
   - `transfers` executes inter-cashbox transfers atomically in a single step (`POST /api/v1/transfers`) rather than a separate two-step pending approval endpoint.
