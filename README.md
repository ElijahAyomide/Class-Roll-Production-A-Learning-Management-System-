# ClassRoll — School Exam Management (Admin Dashboard)

A dashboard for secondary school administrators to manage students, upload
exam questions, sell exam licenses, and view results the moment students
submit them.

## Where this build is right now

**Phase 1 of 8 — Frontend only.** Every page you see works and is fully
clickable, but there is no real backend yet. Data lives in React state
(see `src/data/mockData.js` and the `useState` calls in `src/App.jsx`) and
resets every time you reload the page. This is intentional — it lets us
get the UI/UX right before wiring up anything real underneath it.

## The 7 admin pages

- **Dashboard** — stats, quick-add student, student search, recent activity, average score by class
- **Students** — full list, search by name/username, filter by class, edit, delete
- **Question Bank** — upload PDF/Word test or exam questions by class + subject, filter by type, delete
- **Results** — view/search/filter results, print
- **License** — buy exam credits, view payment history
- **Settings** — school profile, class/subject overview, admin password
- **Sign Out** — confirmation page

There's also a **Login** page with tabs for School Admin (functional in demo
mode — any input signs you in) and Student (placeholder, built in phase 2).

## The full roadmap

1. ✅ Frontend — Admin Dashboard (this phase)
2. Frontend — Student Portal (login + exam-taking UI)
3. Backend & Database (real data storage)
4. Authentication (real admin + student login)
5. File uploads (PDF/Word going to real storage)
6. Payments (Paystack integration for license purchases)
7. Exam engine (question rendering, timing, auto-grading)
8. Deploy & go live

## Running it locally

```
npm install
npm run dev
```

Then open the printed `localhost` link. Login with anything on the School
Admin tab to reach the dashboard.

## Project structure

```
src/
  data/mockData.js       — all placeholder data (students, questions, results, license)
  components/            — shared UI: Sidebar, Topbar, DashboardLayout, StatCard, Badge, Modal
  pages/                 — one file per page, matches the 7-page spec + Login + SignOut
  App.jsx                — routing + top-level state (the "fake database" for now)
  index.css              — every color, font, and layout rule (see the :root block at the top)
```
