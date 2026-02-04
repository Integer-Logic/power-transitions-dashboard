# Power Pipeline Dashboard

A React-based dashboard for managing and visualizing power transition projects and opportunities.

## Features

- Interactive project pipeline with filtering and sorting
- Real-time data visualization (charts, KPIs)
- Project detail views with expert analysis
- Excel import/export functionality
- Activity logging
- Role-based authentication
- Responsive design for desktop and mobile

## Tech Stack

- **Frontend:** React 19, Vite, Recharts
- **Backend:** Node.js/Express
- **Styling:** CSS with custom dark theme

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server (frontend only)
npm run dev

# Start backend server
npm run backend

# Start both frontend and backend
npm run dev:full
```

### Build

```bash
npm run build
```

## Project Structure

```
├── src/
│   ├── components/     # React components
│   ├── contexts/       # React context providers
│   ├── assets/         # Images and static assets
│   ├── Dashboard.css   # Main stylesheet
│   └── App.jsx         # Root component
├── backend/            # Express API server
└── public/             # Static files
```

## License

Proprietary - Power Transitions Platform
