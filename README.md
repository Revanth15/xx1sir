# Project Name
BDDash
A full-stack web application built with [Next.js](https://nextjs.org) and [Supabase](https://supabase.com), bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app). Supabase handles the database (PostgreSQL) and authentication out of the box.

---

## Prerequisites

Before getting started, make sure you have the following installed on your machine:

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/), [yarn](https://yarnpkg.com/), [pnpm](https://pnpm.io/), or [bun](https://bun.sh/)
- [Git](https://git-scm.com/)

---

## Getting the Project

Clone the repository to your local machine:

```bash
git clone https://github.com/Revanth15/xx1sir.git
cd xx1sir
```

---

## Environment Variables

This project requires a `.env.local` file to connect to Supabase. This file contains sensitive API keys and is **not** committed to the repository.

**Contact the project admin to get your `.env.local` file.** Once you have it, place it in the root of the project directory (the same level as `package.json`).

The file will contain variables along these lines:

```env
ENCRYPTION_KEY=your_encryption_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

> ⚠️ **Never commit `.env.local` to version control.** It is already listed in `.gitignore` by default.

---

## Installing Dependencies

Once you have the `.env.local` file in place, install the project dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

---

## Running the Development Server

Start the local development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app running. The page will auto-update as you make changes to the source files.

---

## Project Structure

```
xx1sirbd
├─ README.md
├─ app
│  ├─ actions.ts
│  ├─ admin
│  │  └─ user-management
│  │     ├─ UserActions.tsx
│  │     ├─ actions.ts
│  │     └─ page.tsx
│  ├─ api
│  │  └─ test
│  │     └─ route.ts
│  ├─ favicon.ico
│  ├─ globals.css
│  ├─ layout.tsx
│  ├─ login
│  │  ├─ actions.ts
│  │  └─ page.tsx
│  ├─ page.tsx
│  └─ submit-report
│     └─ page.tsx
├─ components
│  ├─ nav.tsx
│  └─ ui
│     ├─ alert-dialog.tsx
│     ├─ alert.tsx
│     ├─ avatar.tsx
│     ├─ badge.tsx
│     ├─ button.tsx
│     ├─ card.tsx
│     ├─ dialog.tsx
│     ├─ dropdown-menu.tsx
│     ├─ input.tsx
│     ├─ label.tsx
│     ├─ select.tsx
│     ├─ separator.tsx
│     ├─ sheet.tsx
│     ├─ sidebar.tsx
│     ├─ skeleton.tsx
│     ├─ sonner.tsx
│     ├─ textarea.tsx
│     └─ tooltip.tsx
├─ components.json
├─ eslint.config.mjs
├─ hooks
│  └─ use-mobile.ts
├─ lib
│  └─ utils.ts
├─ middleware.ts
├─ next.config.ts
├─ package-lock.json
├─ package.json
├─ postcss.config.mjs
├─ public
│  ├─ file.svg
│  ├─ globe.svg
│  ├─ next.svg
│  ├─ vercel.svg
│  └─ window.svg
├─ tsconfig.json
└─ utils
   ├─ AuthProvider.tsx
   ├─ api.ts
   ├─ cn.ts
   ├─ database
   │  ├─ init.sql
   │  └─ user-role.sql
   ├─ encryption.ts
   ├─ env.ts
   ├─ supabase
   │  ├─ admin.ts
   │  └─ server.ts
   └─ toast.ts
```

---

## Supabase Setup

This project uses [Supabase](https://supabase.com) for:

- **Database** — PostgreSQL database with real-time capabilities
- **Authentication** — Built-in auth with support for email/password, OAuth providers, magic links, and more

The Supabase client is configured using the environment variables in `.env.local`. As long as those variables are set correctly, no additional Supabase configuration is needed locally. The database schema and any seed data are managed by the project admin on the Supabase dashboard.

If you need access to the Supabase project dashboard, contact the project admin.

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the development server at `localhost:3000` |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server (requires a build first) |
| `npm run lint` | Run ESLint to check for code issues |

---

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) — Features and API reference
- [Learn Next.js](https://nextjs.org/learn) — Interactive tutorial
- [Supabase Documentation](https://supabase.com/docs) — Database, auth, and more
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction) — Client library reference

---

## Deployment

The recommended way to deploy this app is via [Vercel](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme). When deploying, make sure to add all the required environment variables from `.env.local` to your Vercel project settings under **Settings → Environment Variables**.

For more details, see the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).
