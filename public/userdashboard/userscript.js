document.addEventListener("DOMContentLoaded", () => {
    const sidebarToggle = document.getElementById("sidebarToggle");
    const mobileLinks = document.querySelectorAll(".sideBar-links a");
    const heroGreeting = document.getElementById("heroGreeting");
    const userName = document.getElementById("userName");
    const userEmail = document.getElementById("userEmail");
    const userGender = document.getElementById("userGender");
    const appointmentsList = document.getElementById("appointmentsList");
    const bookingHistoryList = document.getElementById("bookingHistoryList");
    const appointmentEmpty = document.getElementById("appointmentEmpty");
    const appointmentForm = document.getElementById("appointmentForm");
    const serviceSelect = document.getElementById("serviceSelect") || document.getElementById("serviceType");
    const caregiverSelect = document.getElementById("caregiverSelect");
    const durationSelect = document.getElementById("duration");
    const servicePriceInput = document.getElementById("servicePrice");
    const totalPriceInput = document.getElementById("totalPrice");
    const caregiverList = document.getElementById("caregiverList") || document.getElementById("caregiverCards");
    const serviceFilter = document.getElementById("serviceFilter") || document.getElementById("caregiverServiceFilter");
    const experienceFilter = document.getElementById("experienceFilter");
    const formMessage = document.getElementById("formMessage");
    const logoutBtn = document.getElementById("logoutBtn");
    const logoutBtnMobile = document.getElementById("logoutBtnMobile");

    let allServices = [];
    let allCaregivers = [];

    mobileLinks.forEach((link) => {
        link.addEventListener("click", () => {
            if (sidebarToggle) sidebarToggle.checked = false;
        });
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 940 && sidebarToggle) {
            sidebarToggle.checked = false;
        }
    });

    async function handleLogout(event) {
        event.preventDefault();
        try {
            await fetch("/logout", { method: "POST" });
        } catch (err) {
            // Ignore network errors and force redirect.
        } finally {
            localStorage.removeItem("token");
            window.location.replace("/loginpage");
        }
    }

    if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
    if (logoutBtnMobile) logoutBtnMobile.addEventListener("click", handleLogout);

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(value) {
        if (!value) return "NA";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleDateString();
    }

    function statusClass(status) {
        const normalized = String(status || "PENDING").toLowerCase();
        if (normalized === "approved") return "status-approved";
        if (normalized === "completed") return "status-completed";
        if (normalized === "rejected") return "status-rejected";
        if (normalized === "cancelled") return "status-cancelled";
        return "status-pending";
    }

    function serviceName(service) {
        return service.service_name || service.name || `Service #${service.id}`;
    }

    function serviceRate(service) {
        return Number(service.price ?? service.hourly_rate ?? 0);
    }

    function caregiverName(caregiver) {
        const fullName = [caregiver.first_name, caregiver.last_name].filter(Boolean).join(" ").trim();
        return fullName || caregiver.email || `Caregiver #${caregiver.id}`;
    }

    function findServiceById(serviceId) {
        return allServices.find((service) => String(service.id) === String(serviceId));
    }

    function updatePriceFields() {
        if (!serviceSelect || !durationSelect || !servicePriceInput || !totalPriceInput) return;
        const selectedService = findServiceById(serviceSelect.value);
        const rate = selectedService ? serviceRate(selectedService) : 0;
        const hours = Number(durationSelect.value || 0);

        servicePriceInput.value = rate ? String(rate) : "";
        totalPriceInput.value = rate && hours ? String(rate * hours) : "";
    }

    function renderAppointments(appointments) {
        if (appointmentsList) appointmentsList.innerHTML = "";
        if (bookingHistoryList) bookingHistoryList.innerHTML = "";

        if (!appointments || appointments.length === 0) {
            if (appointmentEmpty) appointmentEmpty.style.display = "block";
            return;
        }

        if (appointmentEmpty) appointmentEmpty.style.display = "none";

        appointments.forEach((appointment) => {
            const cardHtml = `
                <h3>${escapeHtml(appointment.service_name || "Care Appointment")}</h3>
                <p><strong>Caregiver:</strong> ${escapeHtml(appointment.caregiver_name || "Not assigned")}</p>
                <p><strong>Date:</strong> ${escapeHtml(formatDate(appointment.booking_date))}</p>
                <p><strong>Time:</strong> ${escapeHtml(appointment.booking_time || "NA")}</p>
                <p><strong>Duration:</strong> ${escapeHtml(appointment.duration_hours || "NA")} hour(s)</p>
                <p><strong>Status:</strong> <span class="statusPill ${statusClass(appointment.status)}">${escapeHtml(appointment.status || "PENDING")}</span></p>
                <p><strong>Total:</strong> ${escapeHtml(appointment.total_price || "0")}</p>
                <p><strong>Notes:</strong> ${escapeHtml(appointment.notes || "No notes")}</p>
            `;

            if (appointmentsList) {
                const card = document.createElement("article");
                card.className = "infoCard";
                card.innerHTML = cardHtml;
                appointmentsList.appendChild(card);
            }

            if (bookingHistoryList) {
                const card = document.createElement("article");
                card.className = "infoCard";
                card.innerHTML = cardHtml;
                bookingHistoryList.appendChild(card);
            }
        });
    }

    function populateServiceOptions() {
        if (!serviceSelect) return;

        serviceSelect.innerHTML = "<option value=''>Select Service</option>";
        allServices.forEach((service) => {
            const option = document.createElement("option");
            option.value = String(service.id);
            option.textContent = `${serviceName(service)} - ${serviceRate(service)}/hr`;
            serviceSelect.appendChild(option);
        });

        if (serviceFilter) {
            serviceFilter.innerHTML = "<option value=''>All Services</option>";
            allServices.forEach((service) => {
                const option = document.createElement("option");
                option.value = String(service.id);
                option.textContent = serviceName(service);
                serviceFilter.appendChild(option);
            });
        }

        updatePriceFields();
    }

    function populateCaregiverOptions(serviceId) {
        if (!caregiverSelect) return;

        caregiverSelect.innerHTML = "<option value=''>Select Caregiver</option>";
        const filtered = allCaregivers.filter((caregiver) => {
            if (!serviceId) return true;
            return String(caregiver.service_id) === String(serviceId);
        });

        filtered.forEach((caregiver) => {
            const option = document.createElement("option");
            option.value = String(caregiver.id);
            option.textContent = `${caregiverName(caregiver)} - ${caregiver.service_name || "General Care"}`;
            caregiverSelect.appendChild(option);
        });
    }

    function renderCaregiverCards() {
        if (!caregiverList) return;
        caregiverList.innerHTML = "";

        const selectedServiceId = serviceFilter ? serviceFilter.value : "";
        const selectedExperience = experienceFilter ? Number(experienceFilter.value || 0) : 0;

        const filtered = allCaregivers.filter((caregiver) => {
            const serviceMatch = !selectedServiceId || String(caregiver.service_id) === String(selectedServiceId);
            const experienceMatch = !selectedExperience || Number(caregiver.experience_years || 0) >= selectedExperience;
            return serviceMatch && experienceMatch;
        });

        if (filtered.length === 0) {
            const empty = document.createElement("p");
            empty.className = "emptyState";
            empty.textContent = "No caregivers found for selected filters.";
            caregiverList.appendChild(empty);
            return;
        }

        filtered.forEach((caregiver) => {
            const card = document.createElement("article");
            card.className = "infoCard";
            card.innerHTML = `
                <h3>${escapeHtml(caregiverName(caregiver))}</h3>
                <p><strong>Service:</strong> ${escapeHtml(caregiver.service_name || "General Care")}</p>
                <p><strong>Rate:</strong> ${escapeHtml(caregiver.price || "NA")}/hr</p>
                <p><strong>Experience:</strong> ${escapeHtml(caregiver.experience_years || "NA")} years</p>
                <p><strong>Qualification:</strong> ${escapeHtml(caregiver.qualification || "NA")}</p>
                <p><strong>Rating:</strong> ${escapeHtml(caregiver.rating || "NA")}</p>
            `;
            caregiverList.appendChild(card);
        });
    }

    async function loadProfile() {
        const res = await fetch("/api/user/profile", { method: "GET" });
        if (res.status === 401 || res.status === 403) {
            window.location.replace("/loginpage");
            return;
        }
        if (!res.ok) throw new Error("Failed to load profile");

        const data = await res.json();
        const user = data.user || {};
        const fullName = `${user.fname || ""} ${user.lname || ""}`.trim();

        if (heroGreeting) heroGreeting.textContent = fullName ? `Welcome, ${fullName}` : "Welcome Back to ElderAssist";
        if (userName) userName.textContent = fullName || "Not available";
        if (userEmail) userEmail.textContent = user.email || "Not available";
        if (userGender) userGender.textContent = user.gender || "Not available";
    }

    async function loadBookingOptions() {
        const res = await fetch("/api/user/booking-options", { method: "GET" });
        if (!res.ok) throw new Error("Failed to load booking options");

        const data = await res.json();
        allServices = data.services || [];
        allCaregivers = data.caregivers || [];

        populateServiceOptions();
        populateCaregiverOptions(serviceSelect ? serviceSelect.value : "");
        renderCaregiverCards();
    }

    async function loadAppointments() {
        const res = await fetch("/api/user/appointments", { method: "GET" });
        if (res.status === 401 || res.status === 403) {
            window.location.replace("/loginpage");
            return;
        }
        if (!res.ok) throw new Error("Failed to load appointments");
        const data = await res.json();
        renderAppointments(data.appointments || []);
    }

    if (serviceSelect) {
        serviceSelect.addEventListener("change", () => {
            populateCaregiverOptions(serviceSelect.value);
            updatePriceFields();
        });
    }
    if (durationSelect) {
        durationSelect.addEventListener("change", updatePriceFields);
    }
    if (serviceFilter) {
        serviceFilter.addEventListener("change", renderCaregiverCards);
    }
    if (experienceFilter) {
        experienceFilter.addEventListener("change", renderCaregiverCards);
    }

    if (appointmentForm) {
        appointmentForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (formMessage) formMessage.textContent = "";

            const payload = {
                caregiverId: caregiverSelect ? caregiverSelect.value || null : null,
                serviceId: serviceSelect ? serviceSelect.value : "",
                appointmentDate: appointmentForm.appointmentDate.value,
                appointmentTime: appointmentForm.appointmentTime.value,
                duration: appointmentForm.duration.value,
                patientAge: appointmentForm.patientAge.value,
                notes: appointmentForm.notes.value.trim()
            };

            try {
                const res = await fetch("/api/user/appointments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (!res.ok) {
                    if (formMessage) formMessage.textContent = data.error || "Failed to book appointment";
                    return;
                }

                if (formMessage) formMessage.textContent = data.message || "Appointment booked successfully";
                appointmentForm.reset();
                updatePriceFields();
                await loadAppointments();
            } catch (err) {
                if (formMessage) formMessage.textContent = "Something went wrong. Try again.";
            }
        });
    }

    Promise.all([loadProfile(), loadBookingOptions(), loadAppointments()]).catch(() => {
        if (formMessage) formMessage.textContent = "Could not load dashboard data right now.";
    });
});
