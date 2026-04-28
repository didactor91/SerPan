# AI Agent Development Manual
### Industry-Grade Rules & Standards for Software Development

> **STATUS**: Authoritative. All AI coding agents MUST follow this document without exception.
> **VERSION**: 1.0.0 | **LAST UPDATED**: 2025

---

## Table of Contents

1. [Core Principles](#1-core-principles)
2. [Project Structure](#2-project-structure)
3. [Git Workflow](#3-git-workflow)
4. [Branch Strategy](#4-branch-strategy)
5. [Commit Standards](#5-commit-standards)
6. [Code Quality Tools](#6-code-quality-tools)
7. [ESLint](#7-eslint)
8. [Prettier](#8-prettier)
9. [Git Hooks & Husky](#9-git-hooks--husky)
10. [TypeScript Standards](#10-typescript-standards)
11. [Testing Requirements](#11-testing-requirements)
12. [Pull Request Protocol](#12-pull-request-protocol)
13. [Dependency Management](#13-dependency-management)
14. [Security Rules](#14-security-rules)
15. [Forbidden Actions](#15-forbidden-actions)
16. [Mandatory Checklists](#16-mandatory-checklists)

---

## 1. Core Principles

These principles are non-negotiable and govern every decision in this codebase.

### 1.1 The Golden Rules

```
1. CORRECTNESS before SPEED. Working code beats fast code.
2. READABILITY before CLEVERNESS. Code is read 10x more than written.
3. EXPLICIT before IMPLICIT. No magic. No surprises.
4. SMALL and FOCUSED. One function, one purpose. One PR, one concern.
5. TESTED or it doesn't exist. Untested code is broken code you haven't found yet.
```

### 1.2 Absolute Constraints

| Constraint | Rule |
|---|---|
| **Never break main** | `main` must be deployable at all times |
| **Never skip CI** | All checks must pass before merging |
| **Never commit secrets** | Zero tolerance. No exceptions. |
| **Never force-push shared branches** | Destructive rewrite of shared history is forbidden |
| **Never merge your own PR** | A second pair of eyes is mandatory |

---

## 2. Project Structure

### 2.1 Standard Directory Layout

```
project-root/
├── .github/
│   ├── workflows/          # CI/CD pipelines
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODEOWNERS
├── .husky/                 # Git hooks
│   ├── pre-commit
│   ├── commit-msg
│   └── pre-push
├── src/
│   ├── components/         # UI components (if applicable)
│   ├── features/           # Feature modules (domain-driven)
│   ├── hooks/              # Reusable hooks (React)
│   ├── lib/                # Shared utilities & helpers
│   ├── services/           # API layer / external integrations
│   ├── store/              # State management
│   ├── types/              # Global TypeScript types/interfaces
│   └── index.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example            # Template. NEVER commit .env
├── .eslintrc.json
├── .prettierrc
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

### 2.2 Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| Files (components) | PascalCase | `UserProfile.tsx` |
| Files (utils/hooks) | camelCase | `useAuthToken.ts` |
| Files (tests) | Same as target + `.test` | `UserProfile.test.tsx` |
| Directories | kebab-case | `user-profile/` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Functions/Variables | camelCase | `getUserById()` |
| Classes/Types/Interfaces | PascalCase | `UserProfile`, `ApiResponse<T>` |
| Interfaces | NO `I` prefix | `UserProfile` NOT `IUserProfile` |
| Enum members | SCREAMING_SNAKE_CASE | `Status.NOT_FOUND` |

### 2.3 ✅ DO / ❌ DON'T — Structure

```
✅ DO: Co-locate test files next to source files (feature/__tests__/)
✅ DO: Export all public API from an index.ts barrel file
✅ DO: Keep feature modules self-contained
✅ DO: Separate business logic from UI components

❌ DON'T: Put everything in a single /utils folder
❌ DON'T: Create circular dependencies between modules
❌ DON'T: Mix concerns in a single file (UI + API + business logic)
❌ DON'T: Use abbreviations in names (usr, btn, cfg, mgr)
```

---

## 3. Git Workflow

### 3.1 The Workflow

This project follows **GitHub Flow** with trunk-based development principles.

```
main (protected, always deployable)
  │
  ├── feat/TICKET-123-user-authentication
  ├── fix/TICKET-456-login-redirect-loop
  ├── chore/update-dependencies
  └── hotfix/TICKET-789-payment-null-pointer
```

### 3.2 Branch Lifecycle

```
1. Create branch from latest main
2. Make small, focused commits
3. Push and open a Draft PR early
4. All CI checks pass
5. Request review
6. Address feedback
7. Squash and merge into main
8. Delete the branch immediately
```

### 3.3 ✅ DO / ❌ DON'T — Git Workflow

```
✅ DO: Pull --rebase before pushing (git pull --rebase origin main)
✅ DO: Keep feature branches short-lived (< 3 days ideally)
✅ DO: Open a Draft PR as soon as you push the first commit
✅ DO: Delete branches immediately after merge
✅ DO: Use git stash for work-in-progress before switching branches

❌ DON'T: Work directly on main or develop
❌ DON'T: Let branches live for more than a week without merging
❌ DON'T: Merge main into your branch (use rebase instead)
❌ DON'T: Force-push to any shared branch
❌ DON'T: Use git push --force (use --force-with-lease only if absolutely necessary)
```

---

## 4. Branch Strategy

### 4.1 Branch Naming

**Format**: `<type>/<ticket-id>-<short-description>`

```bash
# ✅ CORRECT
feat/AUTH-123-oauth-google-login
fix/BUG-456-cart-total-calculation
chore/upgrade-react-18
refactor/USER-789-extract-auth-service
docs/update-api-readme
hotfix/PAY-999-stripe-webhook-500

# ❌ WRONG
feature-login          # Missing ticket ID, wrong prefix format
my-branch              # Not descriptive, no type
AUTH-123               # No type prefix
fix-stuff              # Too vague
FEAT/auth              # Wrong case
```

### 4.2 Branch Type Prefixes

| Prefix | Purpose | Merges Into |
|---|---|---|
| `feat/` | New feature or enhancement | `main` |
| `fix/` | Bug fix | `main` |
| `hotfix/` | Critical production fix | `main` (expedited) |
| `refactor/` | Code restructuring, no behavior change | `main` |
| `chore/` | Tooling, deps, config, CI | `main` |
| `docs/` | Documentation only | `main` |
| `test/` | Adding or fixing tests | `main` |
| `perf/` | Performance improvement | `main` |

### 4.3 Protected Branches

| Branch | Protection Rules |
|---|---|
| `main` | Requires PR, 1+ approvals, all CI passing, no direct push |

---

## 5. Commit Standards

### 5.1 Conventional Commits Specification

All commits MUST follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

**Format**:
```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

**Rules**:
- Subject line max **72 characters**
- Subject in **imperative mood** ("add feature" not "added feature")
- Subject does **NOT end with a period**
- Body wraps at **100 characters**
- Reference ticket in footer: `Refs: AUTH-123`

### 5.2 Commit Types

| Type | When to Use |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `style` | Formatting, missing semicolons (no logic change) |
| `refactor` | Code change with no feature or fix |
| `perf` | Code change improving performance |
| `test` | Adding or updating tests |
| `chore` | Build process, dependencies, tooling |
| `ci` | CI/CD configuration changes |
| `revert` | Reverting a previous commit |

### 5.3 Commit Examples

```bash
# ✅ CORRECT
feat(auth): add Google OAuth2 login integration
fix(cart): correct total price rounding for multi-currency
refactor(user): extract profile validation into separate service
test(payment): add unit tests for stripe webhook handler
chore: upgrade eslint to v9 and update related config
docs(api): document rate limiting headers in README

# With body and footer
feat(checkout): add address autocomplete via Google Places API

Integrates the Google Places Autocomplete API to improve address
entry UX. Falls back gracefully when the API is unavailable.
Includes a 300ms debounce on input to reduce API calls.

Refs: CHECKOUT-234
BREAKING CHANGE: removes the legacy AddressForm component

# ❌ WRONG
fixed bug                    # No type, too vague
WIP                          # Never commit WIP to shared branches
feat: Add new stuff          # Too vague, capitalized subject
fix: Fixed the thing.        # Past tense + trailing period
update                       # Meaningless
FEAT(AUTH): add login        # Wrong case for type
```

### 5.4 Atomic Commits

```
✅ DO: Each commit represents ONE logical, complete change
✅ DO: Commit must not break the build at any point in history
✅ DO: Use "git add -p" (patch) to stage only relevant changes
✅ DO: If a commit message needs "and", split it into two commits

❌ DON'T: Commit commented-out code
❌ DON'T: Commit console.log / debugger statements
❌ DON'T: Bundle unrelated changes in a single commit
❌ DON'T: Use "WIP", "temp", "fix fix", "asdf" as commit messages
```

---

## 6. Code Quality Tools

### 6.1 Required Toolchain

Every project MUST have these tools configured from day one:

```json
{
  "devDependencies": {
    "eslint": "^9.x",
    "@typescript-eslint/eslint-plugin": "latest",
    "@typescript-eslint/parser": "latest",
    "prettier": "^3.x",
    "husky": "^9.x",
    "lint-staged": "^15.x",
    "commitlint": "^19.x",
    "@commitlint/config-conventional": "^19.x"
  }
}
```

### 6.2 Setup Order

When initializing a project, tools MUST be set up in this order:

```
1. TypeScript configuration (tsconfig.json)
2. ESLint
3. Prettier
4. lint-staged
5. Husky (hooks)
6. commitlint
7. CI pipeline (GitHub Actions)
```

---

## 7. ESLint

### 7.1 Base Configuration

Use flat config (`eslint.config.js`) for ESLint v9+:

```javascript
// eslint.config.js
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // === ERRORS (violations break the build) ===
      'no-console': 'error',
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': 'off',                          // Handled by TS
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'no-return-await': 'off',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],

      // === WARNINGS (should fix, don't block CI) ===
      'no-warning-comments': ['warn', { terms: ['TODO', 'FIXME', 'HACK'] }],
      'complexity': ['warn', { max: 10 }],
      'max-depth': ['warn', { max: 4 }],
      'max-lines-per-function': ['warn', { max: 50 }],
      'max-params': ['warn', { max: 4 }],
    },
  },
  {
    // Test files — relaxed rules
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'max-lines-per-function': 'off',
    },
  },
  {
    // Ignore patterns
    ignores: ['dist/', 'build/', 'node_modules/', '*.min.js', 'coverage/'],
  }
);
```

### 7.2 ESLint Rules — What's Forbidden

```
❌ FORBIDDEN (error-level):
  - any        → Use proper types or generics
  - !           → Non-null assertions hide bugs
  - console.*   → Use a logger service
  - debugger    → Never commit debug statements
  - var         → Use const/let only
  - Unhandled Promises → Every async call must be handled
  - Floating Promises  → Await or void explicitly

❌ NEVER disable ESLint rules inline without a comment:
  // eslint-disable-next-line @typescript-eslint/no-explicit-any  ← FORBIDDEN
  
✅ If a disable is truly necessary, document WHY:
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Third-party lib has no types, tracked in TICKET-123
```

### 7.3 ESLint in package.json Scripts

```json
{
  "scripts": {
    "lint": "eslint src --max-warnings 0",
    "lint:fix": "eslint src --fix",
    "lint:ci": "eslint src --max-warnings 0 --format github"
  }
}
```

**`--max-warnings 0` is mandatory in CI.** Warnings in CI fail the build.

---

## 8. Prettier

### 8.1 Prettier Configuration

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "bracketSameLine": false
}
```

### 8.2 Prettier Ignore

```
# .prettierignore
dist/
build/
coverage/
node_modules/
*.min.js
*.min.css
public/
*.lock
CHANGELOG.md
```

### 8.3 Prettier + ESLint Integration

Prettier handles **formatting**. ESLint handles **code quality**. They must NOT overlap.

```bash
# Required packages to prevent conflicts
npm install -D eslint-config-prettier

# Always put prettierConfig LAST in eslint.config.js
# to override any ESLint formatting rules
```

### 8.4 ✅ DO / ❌ DON'T — Prettier

```
✅ DO: Run Prettier as part of pre-commit hook (via lint-staged)
✅ DO: Configure your editor to format on save
✅ DO: Use the same .prettierrc across all projects in the org
✅ DO: Let Prettier do ALL formatting — never manually format code

❌ DON'T: Override Prettier config per-file
❌ DON'T: Mix formatting concerns between Prettier and ESLint
❌ DON'T: Commit code that hasn't been formatted by Prettier
❌ DON'T: Modify .prettierrc without team agreement (it causes massive diffs)
```

---

## 9. Git Hooks & Husky

### 9.1 Husky Setup

```bash
# Install
npm install -D husky lint-staged

# Initialize
npx husky init

# This creates .husky/ directory and adds "prepare": "husky" to package.json
```

### 9.2 Required Hooks

#### pre-commit — Code Quality Gate

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

#### commit-msg — Commit Message Validation

```bash
# .husky/commit-msg
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx --no -- commitlint --edit ${1}
```

#### pre-push — Final Safety Gate

```bash
# .husky/pre-push
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "Running tests before push..."
npm run test:ci

echo "Running type check before push..."
npm run typecheck
```

### 9.3 lint-staged Configuration

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "prettier --write",
      "eslint --fix --max-warnings 0"
    ],
    "*.{js,jsx}": [
      "prettier --write",
      "eslint --fix --max-warnings 0"
    ],
    "*.{json,md,yml,yaml,css,scss}": [
      "prettier --write"
    ]
  }
}
```

### 9.4 commitlint Configuration

```javascript
// commitlint.config.js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'chore', 'ci', 'revert'
    ]],
    'subject-max-length': [2, 'always', 72],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'body-max-line-length': [2, 'always', 100],
  },
};
```

### 9.5 Hook Rules

```
✅ DO: Keep hooks fast (< 30s for pre-commit, < 60s for pre-push)
✅ DO: Run only lint-staged in pre-commit (not full test suite)
✅ DO: Run type-check and tests in pre-push
✅ DO: Ensure hooks are executable (chmod +x .husky/*)

❌ DON'T: Skip hooks with --no-verify (this is forbidden in shared environments)
❌ DON'T: Run full test suite in pre-commit (it slows developers down)
❌ DON'T: Add hooks that run network requests (slow, flaky)
❌ DON'T: Commit the .husky/_/husky.sh file modifications
```

---

## 10. TypeScript Standards

### 10.1 tsconfig.json — Strict Mode is Non-Negotiable

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM"],
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    // === STRICT (ALL must be true) ===
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,

    // === ADDITIONAL SAFETY ===
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,

    // === PATH ALIASES ===
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### 10.2 TypeScript Rules

```typescript
// ❌ FORBIDDEN: any type
function process(data: any): any { }  // Never

// ✅ CORRECT: Use generics
function process<T>(data: T): ProcessedResult<T> { }

// ❌ FORBIDDEN: Non-null assertion
const value = maybeNull!.property;

// ✅ CORRECT: Explicit handling
if (maybeNull === null) throw new Error('Expected value but got null');
const value = maybeNull.property;

// ❌ FORBIDDEN: Type casting with as (except in tests)
const user = response as User;

// ✅ CORRECT: Type guards
function isUser(data: unknown): data is User {
  return typeof data === 'object' && data !== null && 'id' in data;
}

// ❌ FORBIDDEN: Implicit return types on public functions
export function getUser(id: string) {
  return fetch(`/api/users/${id}`);
}

// ✅ CORRECT: Explicit return types always
export async function getUser(id: string): Promise<User> {
  return fetch(`/api/users/${id}`).then(res => res.json() as Promise<User>);
}

// ❌ FORBIDDEN: Enums (use const objects instead)
enum Direction { Up, Down }

// ✅ CORRECT: Const objects + type
const Direction = { UP: 'up', DOWN: 'down' } as const;
type Direction = typeof Direction[keyof typeof Direction];

// ❌ FORBIDDEN: Optional chaining to hide errors
const name = user?.profile?.name ?? 'Unknown';  // Hides missing data

// ✅ CORRECT: Validate at boundaries, trust types inside
```

### 10.3 Error Handling

```typescript
// ❌ FORBIDDEN: Swallowing errors
try {
  await doSomething();
} catch (_e) {
  // silently ignored
}

// ❌ FORBIDDEN: Throwing raw strings
throw 'Something went wrong';

// ✅ CORRECT: Typed error handling
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ✅ CORRECT: Always handle or re-throw
try {
  await doSomething();
} catch (error) {
  logger.error('Failed to do something', { error, context });
  throw new AppError('Operation failed', 'OPERATION_FAILED', 500);
}
```

---

## 11. Testing Requirements

### 11.1 Coverage Thresholds (Non-Negotiable)

```json
// jest.config.ts or vitest.config.ts
{
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  }
}
```

**CI will fail if coverage drops below these thresholds.**

### 11.2 Test Naming

```typescript
// Format: describe > it/test with clear behavior description
describe('UserService', () => {
  describe('getUserById', () => {
    it('returns the user when a valid ID is provided', async () => { });
    it('throws NotFoundError when user does not exist', async () => { });
    it('throws ValidationError when ID format is invalid', async () => { });
  });
});
```

### 11.3 Testing Rules

```
✅ DO: Follow the AAA pattern (Arrange, Act, Assert)
✅ DO: Test behavior, not implementation details
✅ DO: Use test doubles (mocks/stubs) for external dependencies
✅ DO: Write tests BEFORE fixing bugs (regression tests)
✅ DO: Keep tests deterministic — no random data, fixed dates
✅ DO: Use factories/builders for test data, not ad-hoc objects

❌ DON'T: Write tests that test the framework/library
❌ DON'T: Use real network calls in unit/integration tests
❌ DON'T: Use .only() or .skip() in committed tests
❌ DON'T: Assert on implementation details (private methods, internal state)
❌ DON'T: Write tests to inflate coverage numbers
❌ DON'T: Commit commented-out tests
```

### 11.4 Test File Structure

```typescript
// ✅ CORRECT test structure
import { UserService } from '../UserService';
import { createMockUserRepository } from './__mocks__/userRepository';

describe('UserService', () => {
  let sut: UserService;  // System Under Test
  let mockRepository: ReturnType<typeof createMockUserRepository>;

  beforeEach(() => {
    mockRepository = createMockUserRepository();
    sut = new UserService(mockRepository);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns user when valid ID is provided', async () => {
    // Arrange
    const userId = 'user-123';
    const expectedUser = { id: userId, name: 'Alice' };
    mockRepository.findById.mockResolvedValue(expectedUser);

    // Act
    const result = await sut.getUserById(userId);

    // Assert
    expect(result).toEqual(expectedUser);
    expect(mockRepository.findById).toHaveBeenCalledWith(userId);
    expect(mockRepository.findById).toHaveBeenCalledTimes(1);
  });
});
```

---

## 12. Pull Request Protocol

### 12.1 PR Requirements (All Must Pass)

```
[ ] Branch name follows naming convention
[ ] All commits follow Conventional Commits
[ ] All CI checks pass (lint, typecheck, tests, build)
[ ] Coverage thresholds maintained
[ ] Self-reviewed (read every line of your own diff)
[ ] PR description filled out completely
[ ] No .env files, secrets, or credentials committed
[ ] No console.log / debugger statements
[ ] No TODO/FIXME comments (create tickets instead)
[ ] Documentation updated if public API changed
```

### 12.2 PR Description Template

```markdown
## What & Why
<!-- What does this PR do? Why is it needed? -->

## How
<!-- Brief explanation of the approach taken -->

## Testing
<!-- How was this tested? What cases are covered? -->

## Screenshots / Demo
<!-- For UI changes, include before/after screenshots -->

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or documented if yes)
- [ ] Linked to ticket: <!-- TICKET-123 -->
```

### 12.3 PR Size Limits

| Size | Lines Changed | Status |
|---|---|---|
| ✅ Ideal | < 200 lines | Fast review, easy to understand |
| ⚠️ Acceptable | 200–400 lines | Requires justification |
| ❌ Too Large | > 400 lines | Must be split before review |

**If a PR is too large: split it.** A PR that does "feat A + refactor B + fix C" should be 3 PRs.

### 12.4 Review Process

```
✅ DO: Review within 24 hours of being requested
✅ DO: Comment on the code, not the person ("this function..." not "you wrote...")
✅ DO: Distinguish blocking issues from suggestions (prefix: "[blocking]" or "[nit]")
✅ DO: Approve only when you would be confident deploying this to production
✅ DO: Resolve your own comment threads after the author addresses them

❌ DON'T: Approve PRs that don't pass CI
❌ DON'T: Merge your own PR
❌ DON'T: Leave PRs open without activity for more than 3 days
❌ DON'T: Request changes for purely stylistic preferences covered by Prettier/ESLint
```

---

## 13. Dependency Management

### 13.1 Rules

```
✅ DO: Audit new dependencies before adding (npm audit, check GitHub stars/maintenance)
✅ DO: Pin exact versions in production code (use "5.1.2" not "^5.1.2")
✅ DO: Keep devDependencies separate from dependencies
✅ DO: Run npm audit in CI as a required check
✅ DO: Document why a specific version is pinned if non-obvious
✅ DO: Prefer the platform's native API over a dependency when trivial

❌ DON'T: Add a dependency to solve a 5-line problem
❌ DON'T: Import from package internals (import 'lodash/internal/...')
❌ DON'T: Add dependencies with known critical vulnerabilities
❌ DON'T: Mix npm and yarn (pick one, use it everywhere)
❌ DON'T: Commit node_modules/ (it must be in .gitignore)
❌ DON'T: Use deprecated packages
```

### 13.2 Approved vs. Restricted Dependencies

```
✅ APPROVED CATEGORIES:
  - Type definitions (@types/*)
  - Testing frameworks (vitest, jest, testing-library)
  - Build tools (vite, esbuild, rollup)
  - Linting/formatting (eslint, prettier, husky)
  - Validated, maintained utility libraries

⛔ REQUIRES REVIEW BEFORE ADDING:
  - Any dependency that modifies global state
  - Any dependency that makes network requests at import time
  - Any dependency with < 100k weekly npm downloads
  - Any dependency not updated in 12+ months

❌ FORBIDDEN:
  - Dependencies with critical unpatched CVEs
  - Dependencies that patch native prototypes
  - Unmaintained forks of popular libraries
```

---

## 14. Security Rules

### 14.1 Secrets & Credentials

```
❌ ABSOLUTELY FORBIDDEN:
  - Committing API keys, tokens, passwords, private keys to git
  - Hardcoding credentials in source code
  - Logging sensitive data (passwords, tokens, PII)
  - Storing secrets in .env files that are tracked by git

✅ MANDATORY:
  - .env files MUST be in .gitignore
  - .env.example MUST exist with all keys, empty values
  - Use environment variables for all configuration
  - Use a secrets manager for production (AWS Secrets Manager, Vault, etc.)
```

### 14.2 Pre-commit Secret Scanning

Install `git-secrets` or `gitleaks` as a pre-commit hook:

```bash
# .husky/pre-commit (add to existing)
gitleaks protect --staged --redact -v
```

### 14.3 Input Validation

```
✅ DO: Validate ALL external input at the boundary (API, forms, env vars)
✅ DO: Use schema validation libraries (zod, joi, yup) at entry points
✅ DO: Sanitize data before persisting or rendering

❌ DON'T: Trust user input at any layer
❌ DON'T: Construct SQL/queries via string concatenation
❌ DON'T: Render raw HTML from user input without sanitization
```

---

## 15. Forbidden Actions

This section is a quick-reference list of things an AI agent must **NEVER** do.

### 15.1 Git Forbidden Actions

```
❌ git push --force (to any shared branch)
❌ git commit --no-verify (skipping hooks)
❌ Direct commits to main or develop
❌ Committing .env files or any file with secrets
❌ Rewriting shared branch history
❌ Using "WIP", "temp", "fix", "asdf" as commit messages
❌ Committing commented-out code
❌ Committing console.log / debugger statements
```

### 15.2 Code Forbidden Actions

```
❌ Using `any` type in TypeScript
❌ Using non-null assertions (!) without documented justification
❌ Disabling ESLint rules without an explanatory comment
❌ Suppressing TypeScript errors with @ts-ignore (use @ts-expect-error + comment)
❌ Writing functions longer than 50 lines
❌ Nesting deeper than 4 levels
❌ Mutating function arguments
❌ Using var
❌ Throwing raw strings as errors
❌ Silently swallowing exceptions in catch blocks
❌ Writing tests with .only() or .skip()
❌ Hardcoding environment-specific URLs, ports, or credentials
```

### 15.3 PR Forbidden Actions

```
❌ Merging your own PR
❌ Merging a PR with failing CI
❌ Merging without required approvals
❌ Opening a PR with > 400 lines without justification
❌ Pushing directly to a protected branch
❌ Leaving review comments unresolved when merging
```

---

## 16. Mandatory Checklists

### 16.1 New Project Setup Checklist

```
[ ] Repository created with main as default branch
[ ] Branch protection rules enabled on main
[ ] .gitignore configured (node_modules, .env, dist, coverage)
[ ] TypeScript configured with strict mode
[ ] ESLint configured and scripts added to package.json
[ ] Prettier configured and scripts added to package.json
[ ] Husky initialized (npm run prepare)
[ ] pre-commit hook: lint-staged
[ ] commit-msg hook: commitlint
[ ] pre-push hook: typecheck + tests
[ ] lint-staged configured in package.json
[ ] commitlint configured
[ ] .env.example created with all required keys
[ ] GitHub Actions CI pipeline created
[ ] README.md with setup instructions
[ ] CODEOWNERS file configured
[ ] PR template added to .github/
```

### 16.2 Before Every Commit Checklist

```
[ ] No console.log / debugger left in code
[ ] No commented-out code
[ ] No .env files staged
[ ] All new code has corresponding tests
[ ] TypeScript compiles with zero errors
[ ] ESLint passes with zero warnings
[ ] Prettier has formatted the code
[ ] Commit message follows Conventional Commits
```

### 16.3 Before Every PR Checklist

```
[ ] All CI checks pass
[ ] Coverage has not dropped below thresholds
[ ] PR description is complete
[ ] PR is linked to the corresponding ticket
[ ] No TODO/FIXME comments (create tickets for them)
[ ] Self-reviewed the diff line by line
[ ] Breaking changes are documented in PR description
[ ] API changes have updated documentation
```

### 16.4 Before Every Merge Checklist

```
[ ] All required approvals received
[ ] All CI checks green
[ ] All PR review comments resolved
[ ] Branch is up to date with main
[ ] "Squash and merge" strategy used
[ ] Merge commit message follows Conventional Commits
[ ] Branch deleted after merge
```

---

## Appendix A: Quick Reference Card

```
BRANCH:      feat/<TICKET>-<description>
COMMIT:      feat(scope): description (max 72 chars, lowercase, imperative)
PR SIZE:     < 200 lines (hard limit: 400)
COVERAGE:    >= 80% branches, functions, lines, statements
NO:          any, !, console.log, debugger, --no-verify, var, force-push to shared
ALWAYS:      types, tests, lint, format, PR description, delete branch after merge
```

---

## Appendix B: CI Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint:ci
      - run: npm run test:ci
      - name: Coverage check
        run: npm run test:coverage -- --coverage.thresholds.lines=80
      - name: Security audit
        run: npm audit --audit-level=high
```

---

*This document is the authoritative source of truth. In case of conflict between this document and any other instruction, this document takes precedence for all matters related to code quality, git workflow, and development standards.*

*Agents that do not follow these rules are producing non-compliant output and must be corrected.*
