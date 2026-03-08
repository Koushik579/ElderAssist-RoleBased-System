const express = require ("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "elderassist_super_secret";
const ADMIN_LOGIN_PASSWORD = "adminpass@1234";
const {
    ensureCaregiverSchema,
    ensureBookingRatingSchema,
    insertusers,
    checkuser,
    checkAdminByEmail,
    getUserProfileById,
    createCaregiverProfileForUser,
    services,
    caregivers,
    getServiceById,
    getCaregiverBookingCountForDate,
    getCaregiverUnavailableDates,
    getCaregiverSettings,
    updateCaregiverProfile,
    bookAppointment,
    getUserAppointments,
    getStaffAppointments,
    updateAppointmentStatus,
    cancelUserPendingAppointment,
    rateCompletedAppointment,
    getAllUsersForAdmin,
    getActivePatientServices
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
        if (role === "CAREGIVER") {
            await createCaregiverProfileForUser({
                userId: insertUsers.id,
                firstName: fname,
                lastName: lname,
                email,
                phone: phn
            });
        }
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
        const email = String(req.body.email || "").trim();
        const pass = req.body.pass;
        const admin = await checkAdminByEmail(email);

        if (admin) {
            if (pass !== ADMIN_LOGIN_PASSWORD) {
                return res.status(401).json({ error: "Wrong Credentials" });
            }

            const token = jwt.sign(
                {
                    id: admin.id,
                    email: admin.email,
                    role: "ADMIN"
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
            return res.json({ token, role: "ADMIN" });
        }

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

app.get("/api/user/caregivers/:caregiverId/unavailable-dates", authenticateToken, authorizeRole(["USER"]), async (req, res) => {
    try {
        const caregiverId = Number(req.params.caregiverId);
        if (!Number.isInteger(caregiverId) || caregiverId <= 0) {
            return res.status(400).json({ error: "Invalid caregiver id" });
        }

        const unavailableDates = await getCaregiverUnavailableDates(caregiverId);
        return res.json({ unavailableDates: unavailableDates || [] });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to load caregiver availability" });
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
        if (!caregiverId) {
            return res.status(400).json({ error: "Caregiver selection is required" });
        }
        const bookingCount = await getCaregiverBookingCountForDate(Number(caregiverId), appointmentDate);
        if (bookingCount >= 10) {
            return res.status(409).json({ error: "Selected date is not available for this caregiver" });
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

app.put("/api/user/appointments/:bookingId/cancel", authenticateToken, authorizeRole(["USER"]), async (req, res) => {
    try {
        const bookingId = Number(req.params.bookingId);
        if (!Number.isInteger(bookingId) || bookingId <= 0) {
            return res.status(400).json({ error: "Invalid booking id" });
        }

        const updated = await cancelUserPendingAppointment(bookingId, req.user.id);
        if (!updated) {
            return res.status(404).json({ error: "Pending appointment not found" });
        }

        return res.json({ message: "Appointment removed from ongoing list", appointment: updated });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to cancel appointment" });
    }
});

app.put("/api/user/appointments/:bookingId/rating", authenticateToken, authorizeRole(["USER"]), async (req, res) => {
    try {
        const bookingId = Number(req.params.bookingId);
        const rating = Number(req.body.rating);

        if (!Number.isInteger(bookingId) || bookingId <= 0) {
            return res.status(400).json({ error: "Invalid booking id" });
        }
        if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ error: "Rating must be between 1 and 5" });
        }

        const saved = await rateCompletedAppointment({
            bookingId,
            userId: req.user.id,
            rating: Number(rating.toFixed(1))
        });

        if (!saved) {
            return res.status(404).json({ error: "Completed appointment not found for rating" });
        }

        return res.json({
            message: "Rating saved successfully",
            booking: saved.booking,
            caregiver: saved.caregiverRating
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to save rating" });
    }
});

app.get("/api/caregiver/appointments", authenticateToken, authorizeRole(["CAREGIVER", "ADMIN"]), async (req, res) => {
    try {
        const appointments = await getStaffAppointments({
            requesterRole: req.user.role,
            requesterId: req.user.id,
            requesterEmail: req.user.email
        });
        return res.json({ appointments });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to load caregiver appointments" });
    }
});

app.get("/api/caregiver/settings", authenticateToken, authorizeRole(["CAREGIVER", "ADMIN"]), async (req, res) => {
    try {
        let data = await getCaregiverSettings({
            userId: req.user.id,
            email: req.user.email
        });

        if (!data.caregiver) {
            const user = await getUserProfileById(req.user.id);
            if (!user || user.role !== "CAREGIVER") {
                return res.status(404).json({ error: "Caregiver profile not found" });
            }

            await createCaregiverProfileForUser({
                userId: user.id,
                firstName: user.fname,
                lastName: user.lname,
                email: user.email,
                phone: user.phone
            });

            data = await getCaregiverSettings({
                userId: req.user.id,
                email: req.user.email
            });
        }

        return res.json(data);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to load caregiver settings" });
    }
});

app.put("/api/caregiver/settings/service", authenticateToken, authorizeRole(["CAREGIVER", "ADMIN"]), async (req, res) => {
    try {
        const serviceId = Number(req.body.serviceId);
        if (!Number.isInteger(serviceId) || serviceId <= 0) {
            return res.status(400).json({ error: "Invalid service id" });
        }

        const service = await getServiceById(serviceId);
        if (!service) {
            return res.status(400).json({ error: "Selected service does not exist" });
        }

        const existing = await getCaregiverSettings({
            userId: req.user.id,
            email: req.user.email
        });
        if (!existing.caregiver) {
            return res.status(404).json({ error: "Caregiver profile not found" });
        }

        const updated = await updateCaregiverProfile({
            userId: req.user.id,
            email: req.user.email,
            serviceId,
            firstName: String(existing.caregiver.first_name || ""),
            lastName: String(existing.caregiver.last_name || ""),
            phone: String(existing.caregiver.phone || ""),
            experienceYears: Number(existing.caregiver.experience_years || 0),
            qualification: String(existing.caregiver.qualification || ""),
            status: String(existing.caregiver.status || "AVAILABLE").toUpperCase()
        });

        if (!updated) {
            return res.status(404).json({ error: "Caregiver profile not found" });
        }

        return res.json({ message: "Service updated", caregiver: updated });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to update caregiver service" });
    }
});

app.put("/api/caregiver/settings", authenticateToken, authorizeRole(["CAREGIVER", "ADMIN"]), async (req, res) => {
    try {
        const serviceId = Number(req.body.serviceId);
        const experienceYears = Number(req.body.experienceYears);
        const status = String(req.body.status || "").toUpperCase().trim();
        const allowedStatus = new Set(["AVAILABLE", "BUSY", "INACTIVE"]);

        if (!Number.isInteger(serviceId) || serviceId <= 0) {
            return res.status(400).json({ error: "Invalid service id" });
        }
        if (!Number.isInteger(experienceYears) || experienceYears < 0) {
            return res.status(400).json({ error: "Invalid experience value" });
        }
        if (!allowedStatus.has(status)) {
            return res.status(400).json({ error: "Invalid caregiver status" });
        }

        const firstName = String(req.body.firstName || "").trim();
        const lastName = String(req.body.lastName || "").trim();
        const phone = String(req.body.phone || "").trim();
        const qualification = String(req.body.qualification || "").trim();

        if (!firstName || !lastName) {
            return res.status(400).json({ error: "First name and last name are required" });
        }

        const service = await getServiceById(serviceId);
        if (!service) {
            return res.status(400).json({ error: "Selected service does not exist" });
        }

        const updated = await updateCaregiverProfile({
            userId: req.user.id,
            email: req.user.email,
            serviceId,
            firstName,
            lastName,
            phone,
            experienceYears,
            qualification,
            status
        });

        if (!updated) {
            return res.status(404).json({ error: "Caregiver profile not found" });
        }

        return res.json({ message: "Caregiver profile updated", caregiver: updated });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to update caregiver settings" });
    }
});

app.put("/api/bookings/:bookingId/status", authenticateToken, authorizeRole(["CAREGIVER", "ADMIN"]), async (req, res) => {
    try {
        const bookingId = Number(req.params.bookingId);
        const nextStatus = String(req.body.status || "").toUpperCase().trim();
        const allowed = new Set(["PENDING", "APPROVED", "REJECTED", "COMPLETED", "CANCELLED"]);

        if (!Number.isInteger(bookingId) || bookingId <= 0) {
            return res.status(400).json({ error: "Invalid booking id" });
        }

        if (!allowed.has(nextStatus)) {
            return res.status(400).json({ error: "Invalid status value" });
        }

        const updated = await updateAppointmentStatus(bookingId, nextStatus, {
            requesterRole: req.user.role,
            requesterId: req.user.id,
            requesterEmail: req.user.email
        });
        if (!updated) {
            return res.status(404).json({ error: "Booking not found" });
        }

        return res.json({ message: "Status updated", booking: updated });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to update status" });
    }
});

app.get("/api/admin/dashboard", authenticateToken, authorizeRole(["ADMIN"]), async (req, res) => {
    try {
        const [serviceRows, caregiverRows, userRows, activeRows] = await Promise.all([
            services(),
            caregivers(),
            getAllUsersForAdmin(),
            getActivePatientServices()
        ]);
        const usersOnlyCount = userRows.filter((row) => String(row.role || "").toUpperCase() === "USER").length;

        return res.json({
            summary: {
                users: usersOnlyCount,
                caregivers: caregiverRows.length,
                activeServices: activeRows.length
            },
            services: serviceRows,
            caregivers: caregiverRows,
            users: userRows,
            activeServices: activeRows
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to load admin dashboard data" });
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

async function startServer() {
    try {
        await ensureCaregiverSchema();
        await ensureBookingRatingSchema();
        app.listen(3000,()=>{
            console.log("Server Running.......");
        });
    } catch (err) {
        console.error("Failed to initialize caregiver schema", err);
        process.exit(1);
    }
}

startServer();
