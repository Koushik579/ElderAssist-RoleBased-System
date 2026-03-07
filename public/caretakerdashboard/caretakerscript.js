document.addEventListener("DOMContentLoaded", () => {
    const emptyState = document.getElementById("emptyState");
    const appointmentsBody = document.getElementById("appointmentsBody");
    const table = document.getElementById("appointmentsTable");
    const statusValues = ["PENDING", "APPROVED", "REJECTED", "COMPLETED", "CANCELLED"];
    const logoutBtn = document.getElementById("logoutBtn");

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

    function renderAppointments(appointments) {
        appointmentsBody.innerHTML = "";

        if (!appointments || appointments.length === 0) {
            emptyState.style.display = "block";
            table.style.display = "none";
            return;
        }

        emptyState.style.display = "none";
        table.style.display = "table";

        appointments.forEach((appointment) => {
            const row = document.createElement("tr");
            const currentStatus = (appointment.status || "PENDING").toUpperCase();

            row.innerHTML = `
                <td>${escapeHtml(appointment.id)}</td>
                <td>${escapeHtml(appointment.user_name || appointment.user_email || appointment.user_id)}</td>
                <td>${escapeHtml(appointment.service_name || appointment.service_id || "NA")}</td>
                <td>${escapeHtml(formatDate(appointment.booking_date))}</td>
                <td>${escapeHtml(appointment.booking_time || "NA")}</td>
                <td>${escapeHtml(currentStatus)}</td>
                <td>
                    <select class="statusSelect" data-booking-id="${escapeHtml(appointment.id)}">
                        ${statusValues
                            .map((status) => `<option value="${status}" ${status === currentStatus ? "selected" : ""}>${status}</option>`)
                            .join("")}
                    </select>
                    <button class="updateBtn" data-booking-id="${escapeHtml(appointment.id)}">Save</button>
                </td>
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
});
