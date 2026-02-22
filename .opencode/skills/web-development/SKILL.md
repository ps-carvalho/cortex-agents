---
name: web-development
description: Full-stack web development patterns, best practices, and architectural guidance for modern web applications
license: Apache-2.0
compatibility: opencode
---

# Web Development Skill

This skill provides comprehensive guidance for building modern web applications.

## When to Use

Use this skill when:
- Starting a new web project
- Adding features to existing web apps
- Refactoring frontend or backend code
- Designing APIs
- Choosing technology stack

## Frontend Architecture

### Component Design
- Single Responsibility Principle
- Composition over inheritance
- Controlled vs uncontrolled components
- Container/Presentational pattern
- Custom hooks for reusable logic

### State Management
- Local state (useState, useReducer)
- Global state (Redux, Zustand, Context)
- Server state (React Query, SWR)
- Form state (React Hook Form)
- URL state (React Router)

### Performance Optimization
- Memoization (useMemo, useCallback, React.memo)
- Code splitting and lazy loading
- Virtualization for long lists
- Image optimization
- Bundle size monitoring

### Styling Approaches
- CSS-in-JS (styled-components, emotion)
- Utility-first CSS (Tailwind)
- CSS Modules
- SCSS/Sass
- CSS Variables for theming

## Backend Architecture

### API Design
- RESTful principles
- GraphQL schema design
- Versioning strategies
- Pagination patterns
- Filtering and sorting

### Database Patterns
- Repository pattern
- Unit of Work
- CQRS (Command Query Responsibility Segregation)
- Event sourcing
- Database migrations

### Authentication & Authorization
- JWT implementation
- Session-based auth
- OAuth 2.0 / OpenID Connect
- Role-based access control
- API key management

### Error Handling
- Consistent error responses
- HTTP status codes
- Error logging and monitoring
- User-friendly error messages
- Retry strategies

## Fullstack Patterns

### Data Flow
- Unidirectional data flow
- State normalization
- Optimistic updates
- Real-time updates (WebSockets, SSE)
- Offline-first architecture

### Security
- Input validation and sanitization
- Output encoding
- CSRF protection
- Content Security Policy
- Secure headers

### Testing Strategy
- Unit tests for business logic
- Integration tests for APIs
- Component tests for UI
- E2E tests for critical paths
- Visual regression testing

## Technology Recommendations

### Frontend Stacks
- React + TypeScript + Vite + Tailwind
- Vue 3 + TypeScript + Vite + Pinia
- Next.js (fullstack React)
- SvelteKit

### Backend Stacks
- Node.js + Express/Fastify/NestJS
- Python + FastAPI/Django
- Go + Gin/Echo
- Rust + Actix/Axum

### Databases
- PostgreSQL (relational)
- MongoDB (document)
- Redis (cache/sessions)
- Elasticsearch (search)