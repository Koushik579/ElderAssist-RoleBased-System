const express = require ("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "elderassist_super_secret";
const {
    insertusers,
    checkuser,
    getUserProfileById,
    services,
    caregivers,
    getServiceById,
    bookAppointment,
    getUserAppointments,
    getStaffAppointments,
    updateAppointmentStatus
} = require("./repository/repo");
const authenticateToken = require("./middleware/auth");

app.use(express.json());
app.use("/landingpage", express.static(path.join(__dirname, "../public/landingpage")));
app.use("/assets", express.static(path.join(__dirname, "../public/assets")));
app.use("/userdashboard", authenticateToken, authorizeRole(["USER"]), express.static(path.join(__dirname, "../public/userdashboard")));
app.use("/caretakerdashboard", authenticateToken, authorizeRole(["CAREGIVER", "ADMIN"]), express.static(path.join(__dirname, "../public/caretakerdashboard")));
app.use("/admindashboard", authenticateToken, authorizeRole(["ADMIN"]), express.static(path.join(__dirname, "../public/admindashboard")));

function getTokenFromCookie(req) {
    const cookieHeader = req.headers.cookie || "";
    const tokenCookie = cookieHeader
        .split(";")
        .map(part => part.trim())
        .find(part => part.startsWith("token="));

    if (!tokenCookie) {
        return null;
    }

    return decodeURIComponent(tokenCookie.substring("token=".length));
}

function getDashboardRouteByRole(role) {
    if (role === "USER") return "/userdashboard";
    if (role === "CAREGIVER") return "/caretakerdashboard";
    return "/admindashboard";
}

function redirectIfAuthenticated(req, res, next) {
    const token = getTokenFromCookie(req);
    if (!token) {
        return next();
    }

    try {
        const user = jwt.verify(token, JWT_SECRET);
        return res.redirect(getDashboardRouteByRole(user.role));
    } catch (err) {
        return next();
    }
}

app.get("/", (req,res)=>{
    res.sendFile(path.join(__dirname, "../public/landingpage/index.html"));
})
app.get("/loginpage", redirectIfAuthenticated, (req,res)=>{
    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(__dirname,"../public/landingpage/loginpage.html"));
});
app.get("/registerpage", redirectIfAuthenticated, (req,res)=>{
    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(__dirname,"../public/landingpage/registerpage.html"));
});

function authorizeRole(allowedRoles) {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: "Access denied" });
        }
        next();
    };
}

app.post("/register",async (req,res)=>{
    try {

        const fname = req.body.firstname;
        const lname = req.body.lastname;
        const gender = req.body.gender;
        const email = req.body.email;
        const phn = req.body.phn;
        const pass = req.body.pass;
        const role = req.body.role;
        const hashedpass = await bcrypt.hash(pass, 10);

        const insertUsers = await insertusers(fname,lname,gender,email,phn,hashedpass,role);
        res.json({
            id: insertUsers.id,
            email: insertUsers.email,
            role: insertUsers.role
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({error : "Database Error"});
    }

});

app.post("/login",async (req,res)=>{
    try {
        const email = req.body.email;
        const pass = req.body.pass;

        const user = await checkuser(email);
        if (!user || !user.password) {
            return res.status(401).json({ error: "Wrong Credentials" });
        }

        const isMatch = await bcrypt.compare(pass, user.password);
        if (isMatch) {
            const token = jwt.sign(
                {
                    id: user.id,
                    email: user.email,
                    role: user.role
                },
                JWT_SECRET,
                { expiresIn: "1d" }
            );
            res.cookie("token", token, {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                maxAge: 24 * 60 * 60 * 1000
            });
            return res.json({ token, role: user.role });
        }
        res.status(401).json({ error: "Wrong Credentials" });

    } catch (err) {
        console.error(err);
        res.status(500).json({error : "No Such User Found"});
    }
})

app.get("/auth/verify", authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

app.get("/api/user/profile", authenticateToken, authorizeRole(["USER"]), async (req, res) => {
    try {
        const user = await getUserProfileById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.json({ user });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to load profile" });
    }
});

app.get("/api/user/booking-options", authenticateToken, authorizeRole(["USER"]), async (req, res) => {
    try {
        const [serviceRows, caregiverRows] = await Promise.all([services(), caregivers()]);
        return res.json({
            services: serviceRows || [],
            caregivers: caregiverRows || []
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to load booking options" });
    }
});

app.get("/api/user/appointments", authenticateToken, authorizeRole(["USER"]), async (req, res) => {
    try {
        const appointments = await getUserAppointments(req.user.id);
        return res.json({ appointments });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to load appointments" });
    }
});

app.post("/api/user/appointments", authenticateToken, authorizeRole(["USER"]), async (req, res) => {
    try {
        const {
            caregiverId,
            serviceId,
            appointmentDate,
            appointmentTime,
            duration,
            patientAge,
            notes
        } = req.body;

        if (!serviceId || !appointmentDate || !appointmentTime || !duration) {
            return res.status(400).json({ error: "Service, date, time and duration are required" });
        }

        const service = await getServiceById(Number(serviceId));
        if (!service) {
            return res.status(400).json({ error: "Invalid service selected" });
        }

        const hourlyRateRaw =
            service.hourly_rate ??
            service.rate_per_hour ??
            service.price_per_hour ??
            service.price ??
            0;
        const hourlyRate = Number(hourlyRateRaw) || 0;
        const durationHours = Number(duration);
        const totalPrice = hourlyRate * durationHours;

        const appointment = await bookAppointment({
            userId: req.user.id,
            caregiverId: caregiverId ? Number(caregiverId) : null,
            serviceId: Number(serviceId),
            bookingDate: appointmentDate,
            bookingTime: appointmentTime,
            durationHours,
            patientAge: patientAge ? Number(patientAge) : null,
            notes: String(notes || "").trim(),
            hourlyRate,
            totalPrice
        });

        return res.status(201).json({
            message: "Appointment booked successfully",
            appointment
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to create appointment" });
    }
});

app.get("/api/caregiver/appointments", authenticateToken, authorizeRole(["CAREGIVER", "ADMIN"]), async (req, res) => {
    try {
        const appointments = await getStaffAppointments();
        return res.json({ appointments });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to load caregiver appointments" });
    }
});

app.put("/api/bookings/:bookingId/status", authenticateToken, authorizeRole(["CAREGIVER", "ADMIN"]), async (req, res) => {
    try {
        const { bookingId } = req.params;
        const nextStatus = String(req.body.status || "").toUpperCase().trim();
        const allowed = new Set(["PENDING", "APPROVED", "REJECTED", "COMPLETED", "CANCELLED"]);

        if (!allowed.has(nextStatus)) {
            return res.status(400).json({ error: "Invalid status value" });
        }

        const updated = await updateAppointmentStatus(Number(bookingId), nextStatus);
        if (!updated) {
            return res.status(404).json({ error: "Booking not found" });
        }

        return res.json({ message: "Status updated", booking: updated });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to update status" });
    }
});

app.post("/logout", (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
    });
    res.json({ message: "Logged out" });
});

app.get("/userdashboard", authenticateToken, authorizeRole(["USER"]), (req, res) => {
    res.sendFile(path.join(__dirname, "../public/userdashboard/userdash.html"));
});

app.get("/caretakerdashboard", authenticateToken, authorizeRole(["CAREGIVER", "ADMIN"]), (req, res) => {
    res.sendFile(path.join(__dirname, "../public/caretakerdashboard/caretakerdash.html"));
});

app.get("/admindashboard", authenticateToken, authorizeRole(["ADMIN"]), (req, res) => {
    res.sendFile(path.join(__dirname, "../public/admindashboard/admindash.html"));
});

app.listen(3000,()=>{
    console.log("Server Running.......");
});
