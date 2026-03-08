# Trademarkia Spreadsheet Clone

A real-time, collaborative spreadsheet web application built for the Trademarkia Frontend Engineering Assignment.

## Live Site
[Live Preview: trademarkia-sheet-ys.web.app](https://trademarkia-sheet-ys.web.app)

## Features & Highlights

- **Real-Time Collaboration**: Work simultaneously with other users using Firebase Realtime Database. Live presence (avatars & cell selections) is seamlessly synced.
- **Formula Parsing Engine**: Fully custom mathematical engine supporting operations like `+`, `-`, `*`, `/`, and `^` (exponentiation).
- **Built-in Functions**: Easily compute values with commands like `=SUM(A1:B2)`, `=AVERAGE(A1:B5)`, `MIN`, `MAX`, and `COUNT`.
- **Keyboard Navigation**: Spreadsheet-like keyboard interactions — Arrow keys to move around, `Enter` to edit/commit, and `Escape` to cancel.
- **CSV Data Import/Export**: Instantly download your sheets to CSV or import existing CSV datasets using the intuitive command toolbar.
- **Out-of-the-Box Conditional Formatting**: The grid smartly detects positive numbers, negative numbers, and calculation errors, instantly color-coding them for better financial and data visibility (e.g. green for profits, red for losses).
- **Beautiful Dark Interface**: A polished, premium feeling dark UI customized for a distraction-free experience.

## Getting Started

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Run the Development Server:**
   ```bash
   npm run dev
   ```

3. **Open Your Browser:**
   Navigate to [http://localhost:3000](http://localhost:3000) to see the app in action.

## Tech Stack
- Frontend: Next.js + React + Tailwind CSS
- Backend/Sync: Firebase Realtime Database + Authentication
- State Management: Zustand
