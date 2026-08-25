# WashFlow - Campus Laundry System

WashFlow is a full-stack campus laundry tracking module designed for college students and staff operators. It includes secure transactional token counters, real-time dashboard trackers, theme toggles, and robust session protection.

## Prerequisites
Ensure you have **Node.js** (v18.0.0 or higher) and **npm** installed on your local machine.

## Setup Instructions

### 1. Clone & Install Dependencies
Download the project files and run the following command in the project root directory:
```bash
npm install
```

### 2. Launch the backend API Server
Start the Express API backend. It handles transactional operations and writes changes to the local data store:
```bash
npm run server
```
*The server will run on port `3000` (http://localhost:3000).*

### 3. Launch the Portals
You must launch both client portals to test the full system. Open two separate terminal windows/tabs:

*   **Student Portal** (Port 5173):
    ```bash
    npm run dev:student
    ```
    *Access the Student UI at http://localhost:5173.*

*   **Operator Portal** (Port 5174):
    ```bash
    npm run dev:operator
    ```
    *Access the Operator/Staff UI at http://localhost:5174 (Access Passkey: `admin`).*

---

## Technical Features Included
*   **Dynamic Role-Locking:** The frontend automatically checks your portal listener port (5173 vs 5174) and loads the matching role dashboard.
*   **Stored XSS Defenses:** Student registration handles regex validation validation and strips HTML tags dynamically.
*   **Graceful Session Expiration:** Re-polling automatically logs frontend users out if the backend server restarts.
*   **Safe Transactions:** Server manages all quota increments, decrements, and billing calculations, preserving database integrity.
