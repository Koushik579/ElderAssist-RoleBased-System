document.addEventListener("DOMContentLoaded", () => {
    const emptyState = document.getElementById("emptyState");
    const appointmentsBody = document.getElementById("appointmentsBody");
    const table = document.getElementById("appointmentsTable");
    const statusValues = ["PENDING", "APPROVED", "REJECTED", "COMPLETED", "CANCELLED"];
    const logoutBtn = document.getElementById("logoutBtn");
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsOverlay = document.getElementById("settingsOverlay");
    const closeSettings = document.getElementById("closeSettings");
    const serviceSelectSettings = document.getElementById("serviceSelectSettings");
    const saveServiceBtn = document.getElementById("saveServiceBtn");
    const settingsMessage = document.getElementById("settingsMessage");
    const currentServiceText = document.getElementById("currentServiceText");
    const firstNameSettings = document.getElementById("firstNameSettings");
    const lastNameSettings = document.getElementById("lastNameSettings");
    const phoneSettings = document.getElementById("phoneSettings");
    const experienceSettings = document.getElementById("experienceSettings");
    const qualificationSettings = document.getElementById("qualificationSettings");
    const statusSettings = document.getElementById("statusSettings");
    const profileName = document.getElementById("profileName");
    const profileEmail = document.getElementById("profileEmail");
    const profilePhone = document.getElementById("profilePhone");
    const profileService = document.getElementById("profileService");
    const profileExperience = document.getElementById("profileExperience");
    const profileQualification = document.getElementById("profileQualification");
    const profileStatus = document.getElementById("profileStatus");
    const profileRating = document.getElementById("profileRating");

    let caregiverProfile = null;

    async function handleLogout() {
        try {
            await fetch("/logout", { method: "POST" });
        } catch (err) {
            // ignore
        } finally {
            localStorage.removeItem("token");
            window.location.replace("/loginpage");
        }
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", handleLogout);
    }

    function openSettings() {
        if (!settingsOverlay) return;
        settingsOverlay.style.display = "flex";
        settingsOverlay.setAttribute("aria-hidden", "false");
    }

    function closeSettingsPanel() {
        if (!settingsOverlay) return;
        settingsOverlay.style.display = "none";
        settingsOverlay.setAttribute("aria-hidden", "true");
    }

    async function loadSettings() {
        if (!serviceSelectSettings) return;

        const res = await fetch("/api/caregiver/settings", { method: "GET" });
        if (res.status === 401 || res.status === 403) {
            window.location.replace("/loginpage");
            return;
        }
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Failed to load settings");
        }

        const services = data.services || [];
        const caregiver = data.caregiver || {};
        caregiverProfile = caregiver;

        serviceSelectSettings.innerHTML = "<option value=''>Select Service</option>";
        services.forEach((service) => {
            const option = document.createElement("option");
            option.value = String(service.id);
            option.textContent = service.service_name || `Service #${service.id}`;
            serviceSelectSettings.appendChild(option);
        });

        if (caregiver.service_id != null) {
            serviceSelectSettings.value = String(caregiver.service_id);
        }
        if (firstNameSettings) firstNameSettings.value = caregiver.first_name || "";
        if (lastNameSettings) lastNameSettings.value = caregiver.last_name || "";
        if (phoneSettings) phoneSettings.value = caregiver.phone || "";
        if (experienceSettings) experienceSettings.value = caregiver.experience_years ?? "";
        if (qualificationSettings) qualificationSettings.value = caregiver.qualification || "";
        if (statusSettings) statusSettings.value = (caregiver.status || "AVAILABLE").toUpperCase();

        const currentServiceLabel = caregiver.service_name || "Not selected";
        currentServiceText.textContent = `Current service: ${currentServiceLabel}`;
        renderCaregiverProfile(caregiver);
    }

    function renderCaregiverProfile(caregiver) {
        if (!caregiver) return;
        if (profileName) profileName.textContent = `${caregiver.first_name || ""} ${caregiver.last_name || ""}`.trim() || "NA";
        if (profileEmail) profileEmail.textContent = caregiver.email || "NA";
        if (profilePhone) profilePhone.textContent = caregiver.phone || "NA";
        if (profileService) profileService.textContent = caregiver.service_name || "NA";
        if (profileExperience) profileExperience.textContent = caregiver.experience_years != null ? `${caregiver.experience_years} years` : "NA";
        if (profileQualification) profileQualification.textContent = caregiver.qualification || "NA";
        if (profileStatus) profileStatus.textContent = caregiver.status || "NA";
        if (profileRating) profileRating.textContent = caregiver.rating || "NA";
    }

    async function saveServiceSelection() {
        if (!serviceSelectSettings || !saveServiceBtn || !settingsMessage) return;

        const selectedServiceId = Number(serviceSelectSettings.value);
        if (!Number.isInteger(selectedServiceId) || selectedServiceId <= 0) {
            settingsMessage.textContent = "Please select a valid service.";
            return;
        }
        const experienceYears = Number(experienceSettings ? experienceSettings.value : "");
        if (!Number.isInteger(experienceYears) || experienceYears < 0) {
            settingsMessage.textContent = "Experience must be a non-negative number.";
            return;
        }
        const payload = {
            serviceId: selectedServiceId,
            firstName: firstNameSettings ? firstNameSettings.value.trim() : "",
            lastName: lastNameSettings ? lastNameSettings.value.trim() : "",
            phone: phoneSettings ? phoneSettings.value.trim() : "",
            experienceYears,
            qualification: qualificationSettings ? qualificationSettings.value.trim() : "",
            status: statusSettings ? String(statusSettings.value || "").toUpperCase().trim() : "AVAILABLE"
        };

        saveServiceBtn.disabled = true;
        settingsMessage.textContent = "Saving profile...";

        try {
            const res = await fetch("/api/caregiver/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to save profile");
            }

            caregiverProfile = data.caregiver || caregiverProfile;
            settingsMessage.textContent = "Profile updated successfully.";
            await loadSettings();
            await loadAppointments();
        } catch (err) {
            settingsMessage.textContent = err.message || "Could not save profile.";
        } finally {
            saveServiceBtn.disabled = false;
        }
    }

    if (settingsBtn) {
        settingsBtn.addEventListener("click", () => {
            settingsMessage.textContent = "";
            openSettings();
            loadSettings().catch((err) => {
                settingsMessage.textContent = err.message || "Could not load settings.";
            });
        });
    }

    if (closeSettings) {
        closeSettings.addEventListener("click", closeSettingsPanel);
    }

    if (settingsOverlay) {
        settingsOverlay.addEventListener("click", (event) => {
            if (event.target === settingsOverlay) {
                closeSettingsPanel();
            }
        });
    }

    if (saveServiceBtn) {
        saveServiceBtn.addEventListener("click", saveServiceSelection);
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(value) {
        if (!value) {
            return "NA";
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return date.toLocaleDateString();
    }

    function statusTextClass(status) {
        const normalized = String(status || "").toUpperCase();
        if (normalized === "APPROVED") return "statusApproved";
        if (normalized === "COMPLETED") return "statusCompleted";
        if (normalized === "REJECTED") return "statusRejected";
        if (normalized === "CANCELLED") return "statusCancelled";
        return "statusPending";
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

    function renderAppointments(appointments) {
        appointmentsBody.innerHTML = "";

        if (!appointments || appointments.length === 0) {
            emptyState.style.display = "block";
            table.style.display = "none";
            return;
        }

        emptyState.style.display = "none";
        table.style.display = "table";

        const sortedAppointments = [...appointments].sort((a, b) => appointmentTimestamp(a) - appointmentTimestamp(b));
        sortedAppointments.forEach((appointment) => {
            const row = document.createElement("tr");
            const currentStatus = (appointment.status || "PENDING").toUpperCase();
            const isReadonlyStatus = currentStatus === "COMPLETED" || currentStatus === "REJECTED";
            row.className = isReadonlyStatus ? "readonlyRow" : "";
            const actionContent = isReadonlyStatus
                ? `<span class="readonlyBadge">Read only</span>`
                : `
                    <select class="statusSelect" data-booking-id="${escapeHtml(appointment.id)}">
                        ${statusValues
                            .map((status) => `<option value="${status}" ${status === currentStatus ? "selected" : ""}>${status}</option>`)
                            .join("")}
                    </select>
                    <button class="updateBtn" data-booking-id="${escapeHtml(appointment.id)}">Save</button>
                `;

            row.innerHTML = `
                <td>${escapeHtml(appointment.id)}</td>
                <td>${escapeHtml(appointment.user_name || appointment.user_email || appointment.user_id)}</td>
                <td>${escapeHtml(appointment.service_name || appointment.service_id || "NA")}</td>
                <td>${escapeHtml(formatDate(appointment.booking_date))}</td>
                <td>${escapeHtml(appointment.booking_time || "NA")}</td>
                <td><span class="statusText ${statusTextClass(currentStatus)}">${escapeHtml(currentStatus)}</span></td>
                <td>${actionContent}</td>
            `;
            appointmentsBody.appendChild(row);
        });
    }

    async function loadAppointments() {
        const res = await fetch("/api/caregiver/appointments", { method: "GET" });
        if (res.status === 401 || res.status === 403) {
            window.location.replace("/loginpage");
            return;
        }
        if (!res.ok) {
            throw new Error("Failed to load appointments");
        }

        const data = await res.json();
        renderAppointments(data.appointments || []);
    }

    appointmentsBody.addEventListener("click", async (event) => {
        const button = event.target.closest(".updateBtn");
        if (!button) {
            return;
        }

        const bookingId = button.dataset.bookingId;
        const select = appointmentsBody.querySelector(`.statusSelect[data-booking-id="${bookingId}"]`);
        if (!select) {
            return;
        }

        button.disabled = true;
        const previousLabel = button.textContent;
        button.textContent = "Saving...";

        try {
            const res = await fetch(`/api/bookings/${bookingId}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: select.value })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to update status");
            }

            await loadAppointments();
        } catch (err) {
            button.textContent = "Retry";
            alert(err.message || "Status update failed");
        } finally {
            button.disabled = false;
            if (button.textContent === "Saving...") {
                button.textContent = previousLabel;
            }
        }
    });

    loadAppointments().catch(() => {
        emptyState.textContent = "Unable to load bookings right now.";
        table.style.display = "none";
    });
    loadSettings().catch(() => {
        // ignore profile loading errors in initial page render
    });
});
