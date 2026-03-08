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
    const appointmentDateInput = document.getElementById("appointmentDate");
    const serviceSelect = document.getElementById("serviceSelect") || document.getElementById("serviceType");
    const caregiverSelect = document.getElementById("caregiverSelect");
    const durationSelect = document.getElementById("duration");
    const servicePriceInput = document.getElementById("servicePrice");
    const totalPriceInput = document.getElementById("totalPrice");
    const caregiverList = document.getElementById("caregiverList") || document.getElementById("caregiverCards");
    const serviceFilter = document.getElementById("serviceFilter") || document.getElementById("caregiverServiceFilter");
    const experienceFilter = document.getElementById("experienceFilter");
    const formMessage = document.getElementById("formMessage");
    const unavailableDates = document.getElementById("unavailableDates");
    const logoutBtn = document.getElementById("logoutBtn");
    const logoutBtnMobile = document.getElementById("logoutBtnMobile");

    let allServices = [];
    let allCaregivers = [];
    let unavailableDateSet = new Set();

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

    function appointmentTimestamp(appointment) {
        const datePart = appointment.booking_date ? String(appointment.booking_date).slice(0, 10) : "";
        const timePart = appointment.booking_time ? String(appointment.booking_time).slice(0, 8) : "00:00:00";
        const iso = datePart ? `${datePart}T${timePart}` : "";
        const parsed = iso ? new Date(iso) : null;
        if (parsed && !Number.isNaN(parsed.getTime())) return parsed.getTime();

        const [y, m, d] = datePart.split("-").map(Number);
        const [hh, mm, ss] = timePart.split(":").map(Number);
        if (
            Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d) &&
            Number.isInteger(hh) && Number.isInteger(mm) && Number.isInteger(ss)
        ) {
            return new Date(y, m - 1, d, hh, mm, ss).getTime();
        }
        return 0;
    }

    function statusClass(status) {
        const normalized = String(status || "PENDING").toLowerCase();
        if (normalized === "approved") return "status-approved";
        if (normalized === "completed") return "status-completed";
        if (normalized === "rejected") return "status-rejected";
        if (normalized === "cancelled") return "status-cancelled";
        return "status-pending";
    }

    function isCompletedStatus(status) {
        return String(status || "").toUpperCase() === "COMPLETED";
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

    function formatDateIso(value) {
        if (!value) return "";
        const raw = String(value);
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) return "";
        return date.toISOString().slice(0, 10);
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

    function renderUnavailableDates() {
        if (!unavailableDates) return;
        unavailableDates.innerHTML = "";
        if (unavailableDateSet.size === 0) return;

        Array.from(unavailableDateSet)
            .sort((a, b) => a.localeCompare(b))
            .forEach((date) => {
                const chip = document.createElement("span");
                chip.className = "unavailableDateChip";
                chip.textContent = `${date} unavailable`;
                unavailableDates.appendChild(chip);
            });
    }

    function validateAppointmentDateAvailability() {
        if (!appointmentDateInput) return true;
        const selectedDate = formatDateIso(appointmentDateInput.value);
        const isUnavailable = selectedDate && unavailableDateSet.has(selectedDate);
        appointmentDateInput.classList.toggle("dateUnavailable", Boolean(isUnavailable));
        if (isUnavailable && formMessage) {
            formMessage.textContent = "Selected caregiver is not available on that date.";
        }
        return !isUnavailable;
    }

    async function loadCaregiverUnavailableDates(caregiverId) {
        unavailableDateSet = new Set();
        if (!caregiverId) {
            renderUnavailableDates();
            validateAppointmentDateAvailability();
            return;
        }

        const res = await fetch(`/api/user/caregivers/${caregiverId}/unavailable-dates`, { method: "GET" });
        if (!res.ok) {
            throw new Error("Failed to load caregiver availability");
        }

        const data = await res.json();
        const rows = data.unavailableDates || [];
        rows.forEach((row) => {
            const date = formatDateIso(row.booking_date);
            if (date) unavailableDateSet.add(date);
        });
        renderUnavailableDates();
        validateAppointmentDateAvailability();
    }

    function renderAppointments(appointments) {
        if (appointmentsList) appointmentsList.innerHTML = "";
        if (bookingHistoryList) bookingHistoryList.innerHTML = "";

        if (!appointments || appointments.length === 0) {
            if (appointmentEmpty) appointmentEmpty.style.display = "block";
            return;
        }

        const ongoingStatuses = new Set(["PENDING", "APPROVED"]);
        const ongoingAppointments = appointments.filter((appointment) =>
            ongoingStatuses.has(String(appointment.status || "PENDING").toUpperCase())
        ).sort((a, b) => appointmentTimestamp(a) - appointmentTimestamp(b));
        const historyAppointments = appointments.filter((appointment) =>
            !ongoingStatuses.has(String(appointment.status || "PENDING").toUpperCase())
        ).sort((a, b) => appointmentTimestamp(b) - appointmentTimestamp(a));

        if (appointmentEmpty) {
            appointmentEmpty.style.display = ongoingAppointments.length === 0 ? "block" : "none";
        }

        ongoingAppointments.forEach((appointment) => {
            const normalizedStatus = String(appointment.status || "PENDING").toUpperCase();
            const canDelete = normalizedStatus === "PENDING";
            const cardHtml = `
                <h3>${escapeHtml(appointment.service_name || "Care Appointment")}</h3>
                <p><strong>Caregiver:</strong> ${escapeHtml(appointment.caregiver_name || "Not assigned")}</p>
                <p><strong>Date:</strong> ${escapeHtml(formatDate(appointment.booking_date))}</p>
                <p><strong>Time:</strong> ${escapeHtml(appointment.booking_time || "NA")}</p>
                <p><strong>Duration:</strong> ${escapeHtml(appointment.duration_hours || "NA")} hour(s)</p>
                <p><strong>Status:</strong> <span class="statusPill ${statusClass(appointment.status)}">${escapeHtml(appointment.status || "PENDING")}</span></p>
                <p><strong>Total:</strong> ${escapeHtml(appointment.total_price || "0")}</p>
                <p><strong>Notes:</strong> ${escapeHtml(appointment.notes || "No notes")}</p>
                ${canDelete ? `<button class="cancelPendingBtn" data-booking-id="${escapeHtml(appointment.id)}">Delete Pending</button>` : ""}
            `;

            if (appointmentsList) {
                const card = document.createElement("article");
                card.className = "infoCard";
                card.innerHTML = cardHtml;
                appointmentsList.appendChild(card);
            }
        });

        historyAppointments.forEach((appointment) => {
            const isCompleted = isCompletedStatus(appointment.status);
            const bookingId = Number(appointment.id);
            const existingRating = Number(appointment.rating);
            const safeRating = Number.isFinite(existingRating) && existingRating > 0
                ? Math.max(1, Math.min(5, Number(existingRating.toFixed(1))))
                : 0;
            const activeStars = safeRating > 0 ? Math.round(safeRating) : 0;
            const canRate = isCompleted && Number.isInteger(bookingId) && bookingId > 0 && Number(appointment.caregiver_id) > 0;
            const hasSavedRating = safeRating > 0;
            const ratingWidget = canRate
                ? `
                <div class="ratingWrap" data-booking-id="${escapeHtml(bookingId)}">
                    <p class="ratingLabel">Rate this completed appointment</p>
                    <div class="ratingStars" role="group" aria-label="Star rating">
                        ${[1, 2, 3, 4, 5]
                            .map((value) => hasSavedRating
                                ? `<span class="ratingStar${activeStars >= value ? " is-active" : ""}" aria-hidden="true">&#9733;</span>`
                                : `<button type="button" class="ratingStar${activeStars >= value ? " is-active" : ""}" data-rating-value="${value}" aria-label="Rate ${value} star${value > 1 ? "s" : ""}">&#9733;</button>`)
                            .join("")}
                    </div>
                    ${hasSavedRating ? "" : `<button type="button" class="saveRatingBtn" data-booking-id="${escapeHtml(bookingId)}">Save Rating</button>`}
                    <p class="ratingStatus">${safeRating ? `Your rating: ${safeRating.toFixed(1)}/5` : "No rating submitted yet."}</p>
                </div>
                `
                : "";

            const cardHtml = `
                <h3>${escapeHtml(appointment.service_name || "Care Appointment")}</h3>
                <p><strong>Caregiver:</strong> ${escapeHtml(appointment.caregiver_name || "Not assigned")}</p>
                <p><strong>Date:</strong> ${escapeHtml(formatDate(appointment.booking_date))}</p>
                <p><strong>Time:</strong> ${escapeHtml(appointment.booking_time || "NA")}</p>
                <p><strong>Duration:</strong> ${escapeHtml(appointment.duration_hours || "NA")} hour(s)</p>
                <p><strong>Status:</strong> <span class="statusPill ${statusClass(appointment.status)}">${escapeHtml(appointment.status || "PENDING")}</span></p>
                <p><strong>Total:</strong> ${escapeHtml(appointment.total_price || "0")}</p>
                <p><strong>Notes:</strong> ${escapeHtml(appointment.notes || "No notes")}</p>
                ${ratingWidget}
            `;

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
            loadCaregiverUnavailableDates(caregiverSelect ? caregiverSelect.value : "").catch(() => {
                unavailableDateSet = new Set();
                renderUnavailableDates();
            });
        });
    }
    if (caregiverSelect) {
        caregiverSelect.addEventListener("change", () => {
            loadCaregiverUnavailableDates(caregiverSelect.value).catch(() => {
                unavailableDateSet = new Set();
                renderUnavailableDates();
            });
        });
    }
    if (durationSelect) {
        durationSelect.addEventListener("change", updatePriceFields);
    }
    if (appointmentDateInput) {
        appointmentDateInput.addEventListener("change", validateAppointmentDateAvailability);
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
            if (!validateAppointmentDateAvailability()) {
                return;
            }

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
                if (caregiverSelect && caregiverSelect.value) {
                    await loadCaregiverUnavailableDates(caregiverSelect.value);
                } else {
                    unavailableDateSet = new Set();
                    renderUnavailableDates();
                }
                await loadAppointments();
            } catch (err) {
                if (formMessage) formMessage.textContent = "Something went wrong. Try again.";
            }
        });
    }

    if (appointmentsList) {
        appointmentsList.addEventListener("click", async (event) => {
            const button = event.target.closest(".cancelPendingBtn");
            if (!button) return;

            const bookingId = Number(button.dataset.bookingId);
            if (!Number.isInteger(bookingId) || bookingId <= 0) return;

            button.disabled = true;
            button.textContent = "Removing...";

            try {
                const res = await fetch(`/api/user/appointments/${bookingId}/cancel`, { method: "PUT" });
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || "Failed to remove pending appointment");
                }
                await loadAppointments();
            } catch (err) {
                button.disabled = false;
                button.textContent = "Delete Pending";
                if (formMessage) formMessage.textContent = err.message || "Could not remove pending appointment.";
            }
        });
    }

    if (bookingHistoryList) {
        bookingHistoryList.addEventListener("click", async (event) => {
            const starButton = event.target.closest(".ratingStar");
            if (starButton) {
                const ratingWrap = starButton.closest(".ratingWrap");
                if (!ratingWrap) return;

                const selectedRating = Number(starButton.dataset.ratingValue);
                if (!Number.isInteger(selectedRating) || selectedRating < 1 || selectedRating > 5) return;

                ratingWrap.dataset.selectedRating = String(selectedRating);
                const stars = ratingWrap.querySelectorAll(".ratingStar");
                stars.forEach((star) => {
                    const starValue = Number(star.dataset.ratingValue);
                    star.classList.toggle("is-active", starValue <= selectedRating);
                });

                const status = ratingWrap.querySelector(".ratingStatus");
                if (status) status.textContent = `Selected rating: ${selectedRating}/5`;
                return;
            }

            const saveButton = event.target.closest(".saveRatingBtn");
            if (!saveButton) return;

            const ratingWrap = saveButton.closest(".ratingWrap");
            if (!ratingWrap) return;

            const bookingId = Number(saveButton.dataset.bookingId);
            const selectedRating = Number(ratingWrap.dataset.selectedRating || "");
            const status = ratingWrap.querySelector(".ratingStatus");

            if (!Number.isInteger(bookingId) || bookingId <= 0) return;
            if (!Number.isInteger(selectedRating) || selectedRating < 1 || selectedRating > 5) {
                if (status) status.textContent = "Select a rating from 1 to 5 stars.";
                return;
            }

            saveButton.disabled = true;
            saveButton.textContent = "Saving...";
            if (status) status.textContent = "Saving your rating...";

            try {
                const res = await fetch(`/api/user/appointments/${bookingId}/rating`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rating: selectedRating })
                });
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || "Failed to save rating");
                }

                if (status) status.textContent = `Saved: ${selectedRating}/5`;
                await Promise.all([loadAppointments(), loadBookingOptions()]);
            } catch (err) {
                if (status) status.textContent = err.message || "Could not save rating.";
            } finally {
                saveButton.disabled = false;
                saveButton.textContent = "Save Rating";
            }
        });
    }

    Promise.all([loadProfile(), loadBookingOptions(), loadAppointments()]).then(async () => {
        if (caregiverSelect && caregiverSelect.value) {
            await loadCaregiverUnavailableDates(caregiverSelect.value);
        }
    }).catch(() => {
        if (formMessage) formMessage.textContent = "Could not load dashboard data right now.";
    });
});
