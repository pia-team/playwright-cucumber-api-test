Below is a **production-quality, well-structured README.md** you can use directly in your repository.
It’s written to be **clear for newcomers**, **credible for senior engineers**, and **useful for CI / long-term maintenance**.

---

# API Test Automation Framework

**Playwright + Cucumber + TypeScript**

---

## 📌 Overview

This project is a **scalable and maintainable API test automation framework** built using:

* **Playwright** – fast, reliable HTTP client & test runner
* **Cucumber (BDD)** – business-readable tests with Gherkin
* **TypeScript** – strong typing, better refactoring, fewer runtime errors

The framework is designed with **clean architecture principles**, focusing on:

* Separation of concerns
* Reusability
* Readability
* Easy onboarding for both technical and non-technical stakeholders

---

## 🧠 Key Concepts

* **BDD-first approach**: Business scenarios are written in Gherkin
* **Service-based API abstraction**: API logic lives in service classes
* **Centralized API client**: Headers, auth, retries handled in one place
* **Typed models**: Request & response objects are strongly typed
* **Environment-driven**: Easy switching between Dev / Test / UAT

---

## 🛠 Tech Stack

| Tool                 | Purpose                             |
| -------------------- | ----------------------------------- |
| Playwright           | API request handling & assertions   |
| Cucumber             | BDD / Gherkin test definitions      |
| TypeScript           | Type safety & maintainability       |
| Node.js              | Runtime                             |
| ts-node              | TypeScript execution                |
| AJV / Zod (optional) | Schema validation                   |
| CI/CD                | Jenkins / GitHub Actions compatible |

---

## 📂 Project Structure

```
api-test-framework/
│
├── src/
│   ├── config/          # Environment & endpoint configuration
│   ├── core/            # Framework core (API client, context, hooks)
│   ├── features/        # Gherkin feature files & step definitions
│   ├── models/          # Typed request/response models
│   ├── services/        # API business logic layer
│   ├── utils/           # Reusable helpers & utilities
│   └── types/           # Custom TypeScript types
│
├── test-data/           # Static test data (JSON)
├── reports/             # Test execution reports
├── cucumber.js          # Cucumber configuration
├── tsconfig.json        # TypeScript configuration
├── package.json         # Dependencies & scripts
└── README.md
```

---

## 🏗 Architecture Overview

```
Feature (Gherkin)
   ↓
Step Definitions
   ↓
Service Layer (Business API Logic)
   ↓
API Client (Playwright)
   ↓
HTTP Request
```

### Responsibilities

* **Feature files**
  → Describe *what* is being tested

* **Step Definitions**
  → Glue code only, no API logic

* **Services**
  → Encapsulate API calls and endpoints

* **Core**
  → Authentication, request context, hooks

* **Utils**
  → Common reusable helpers (logging, validation, data handling)

---

## 🚀 Getting Started

### 1️⃣ Prerequisites

* Node.js **v18+**
* npm or yarn
* Access to target API environments

---

### 2️⃣ Install Dependencies

```bash
npm install
```

---

### 3️⃣ Environment Configuration

Set environment variables:

```bash
export BASE_URL=https://api.dev.example.com
export API_TOKEN=your-token
```

Or use `.env` file if supported.

---

### 4️⃣ Run Tests

Run all API tests:

```bash
npm test
```

Run a specific feature:

```bash
npx cucumber-js src/features/user/user.feature
```

---

## ✍ Writing Tests

### Feature File Example

```gherkin
Feature: User API

  Scenario: Create a new user
    Given I have a valid user payload
    When I send a create user request
    Then the response status should be 201
```

---

### Step Definition Guidelines

✅ Keep steps **thin**
❌ Do not call Playwright directly in steps
✅ Always delegate to services

---

## 🧩 Service Layer Example

```ts
export class UserService {
  constructor(private api: ApiClient) {}

  createUser(payload: User) {
    return this.api.post('/users', payload);
  }
}
```

---

## 🧪 Assertions & Validation

* HTTP status checks
* Response body validation
* Optional schema validation (AJV / Zod)
* Custom reusable validators

---

## 🔐 Authentication Strategy

* Token-based authentication supported
* Centralized in `authHelper`
* Easy to extend for:

  * OAuth2
  * JWT refresh
  * API keys

---

## 📊 Reporting

* **Cucumber HTML reports**
* Easily extendable to:

  * Allure
  * JSON reports
  * CI dashboards

Reports are generated under:

```
reports/
```

---

## ⚙ CI/CD Ready

The framework is designed to run seamlessly in:

* Jenkins
* GitHub Actions
* GitLab CI

Supports:

* Headless execution
* Parallel runs
* Environment-based configuration

---

## ✅ Best Practices Followed

✔ Clean architecture
✔ DRY principles
✔ Typed API contracts
✔ Centralized configuration
✔ Easy scalability
✔ CI-friendly execution

---

## 🛣 Roadmap

Planned improvements:

* 🔹 OAuth token refresh support
* 🔹 API schema contract testing
* 🔹 Allure reporting
* 🔹 Performance assertions
* 🔹 Test data generation
* 🔹 AI-assisted test creation

---

## 👥 Contribution Guidelines

1. Follow existing folder structure
2. Add services for new APIs
3. Keep step definitions minimal
4. Write meaningful Gherkin scenarios
5. Ensure tests are environment-agnostic

---

## 📄 License

This project is intended for **internal / enterprise use**.
License can be defined based on organizational needs.

---

## 📞 Support

For questions or improvements:

* Contact the QA / Automation team
* Raise an issue or pull request

---

