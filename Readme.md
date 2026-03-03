ElderAssist – Role-Based Elderly Care Management System
Overview

ElderAssist is a role-based elderly care management system built using Node.js, Express, and PostgreSQL.
The application provides separate dashboards and workflows for:

Admin

Caretaker

User

The system follows a structured backend architecture with database connection pooling and repository-based data access.

Features
Authentication

Login & Registration

Role-based access control

Separate dashboards for Admin, Caretaker, and Users

Admin Dashboard

Manage system users

Monitor overall activity

Caretaker Dashboard

Access assigned user data

Manage care-related information

User Dashboard

Personal profile access

Interaction with assigned caretaker

Backend Architecture

Express server

PostgreSQL database

Connection pooling using pg

Repository layer abstraction

Modular folder structure

```
Project Structure
ElderAssist/
│
├── landingpage/          # Public pages (home, login, register)
│   ├── css/
│   ├── js/
│
├── admindashboard/
├── caretakerdashboard/
├── userdashboard/
│
├── main/
│   ├── app.js            # Express entry point
│   ├── database/
│   │   └── pool.js       # PostgreSQL connection pool
│   ├── repository/
│   │   └── repo.js       # Database logic layer
│
├── img/
├── svg/
├── package.json
```

Tech Stack

Node.js

Express.js

PostgreSQL

HTML5

CSS3

JavaScript

pg (PostgreSQL driver)

Installation & Setup
1. Clone Repository
git clone <your-repo-url>
cd ElderAssist
2. Install Dependencies
npm install
3. Configure Database

Update PostgreSQL credentials inside:

main/database/pool.js

Make sure PostgreSQL is running locally.

4. Start Server
node main/app.js

Or if you add nodemon:

npx nodemon main/app.js
5. Open in Browser
http://localhost:3000

(Adjust port if changed in app.js)

Work in Progress

Full authentication validation

Session management improvements

UI refinement

Error handling middleware

Production-ready security hardening

Future Improvements

JWT-based authentication

Password hashing

RESTful API structure

Deployment configuration

Role middleware authorization

Logging & monitoring

Author

Koushik Karmakar
Java & Node.js Backend Developer
Focused on structured backend architecture and role-based systems.