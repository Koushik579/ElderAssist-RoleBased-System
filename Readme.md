# ElderAssist – Role-Based Elderly Care Management Platform
# Overview

ElderAssist is a full-stack elderly care management platform that connects patients with caregivers through a role-based system.
The platform allows patients to request care services, caregivers to manage service requests, and administrators to monitor and control the entire system.

The application is built using Node.js, Express, PostgreSQL, and bcrypt-based authentication, following a modular backend architecture.

# Key Features
Secure Authentication

User registration and login

Password hashing using bcrypt

Role-based authentication middleware

Role-Based Dashboards
Patient (User)

Create an account

Book caregiving services

Track service requests

Caregiver

View assigned service requests

Accept or manage care bookings

Admin

Monitor all users and caregivers

Update or delete system records

Oversee platform activity

# Tech Stack

Backend

Node.js

Express.js

PostgreSQL

bcrypt

Frontend

HTML5

CSS3

JavaScript

Architecture

Repository pattern

Middleware-based authentication

Connection pooling for database

# Project Structure
```
ElderAssist
│
├── public
│   ├── admindashboard
│   ├── caretakerdashboard
│   ├── userdashboard
│   ├── landingpage
│   └── assets
│
├── src
│   ├── database
│   │   └── pool.js
│   │
│   ├── middleware
│   │   └── auth.js
│   │
│   ├── repository
│   │   └── repo.js
│   │
│   └── app.js
│
├── package.json
├── package-lock.json
└── README.md
```
System Architecture

# The application follows a layered structure:

Client (HTML/CSS/JS)
        ↓
Express Server (app.js)
        ↓
Middleware (Authentication / Authorization)
        ↓
Repository Layer (Database Queries)
        ↓
PostgreSQL Database

This design separates routing, authentication, and database logic, making the system more scalable and maintainable.

# Installation
1 Clone the repository
git clone <your-repo-url>
cd ElderAssist
2 Install dependencies
npm install
3 Configure database

# Update PostgreSQL credentials inside:

src/database/pool.js
4 Start the server
node src/app.js
5 Open the application
http://localhost:3000

# Security Features

Password hashing with bcrypt

Role-based access control

Middleware authentication checks

Server-side validation

Future Improvements

JWT authentication

Email verification

Appointment scheduling

Real-time notifications

REST API separation

Deployment configuration

# Author

Koushik Karmakar
Backend Developer – Java & Node.js
Focused on building scalable backend architectures and role-based systems.