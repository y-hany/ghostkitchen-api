# 🍳 GhostKitchen — Cairo Pop-up Dining & Ghost Kitchen Marketplace

A full-stack marketplace web application connecting commercial ghost kitchens during off-peak hours with guest chefs and dining event attendees in Cairo.

## 🚀 Live Demo
- **Production URL**: [https://ghostkitchen-api.vercel.app](https://ghostkitchen-api.vercel.app)
- **Database**: PostgreSQL on Supabase (Cloud)
- **Deployment**: Vercel (Production Serverless Node.js + Express)

## 🛠 Tech Stack
- **Frontend**: Responsive HTML5, CSS3 (warm terracotta & cream design system), Vanilla JS
- **Backend**: Node.js, Express.js (REST API)
- **Database**: PostgreSQL (Supabase pooler) with custom DDL, triggers, and relational constraints
- **Authentication**: Custom JWT tokens with bcrypt password hashing (cost factor 12)
- **Deployment**: Vercel Serverless Functions

## 👥 Demo Roles (Clickable in UI)
- **🏪 Host**: `host@demo.eg` / `password123` — Manage kitchens, publish availability slots, approve/decline booking requests.
- **🧑‍🍳 Chef**: `chef@demo.eg` / `password123` — Browse verified kitchens, request slots, publish pop-up dining events.
- **🎟️ Attendee**: `attendee@demo.eg` / `password123` — Browse pop-ups, reserve seats, view authentic dining ticket stubs.
- **🛡️ Admin**: `admin@demo.eg` / `password123` — Real-time platform stats, verify or reject kitchen licenses.
