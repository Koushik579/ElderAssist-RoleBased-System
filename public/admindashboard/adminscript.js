document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("adminLogoutBtn");
  const adminUsers = document.getElementById("adminUsers");
  const adminCaregivers = document.getElementById("adminCaregivers");
  const adminBookings = document.getElementById("adminBookings");

  const servicesBody = document.getElementById("servicesBody");
  const caregiversBody = document.getElementById("caregiversBody");
  const usersBody = document.getElementById("usersBody");
  const activeBody = document.getElementById("activeBody");

  const servicesSearch = document.getElementById("servicesSearch");
  const caregiversSearch = document.getElementById("caregiversSearch");
  const caregiversStatusFilter = document.getElementById("caregiversStatusFilter");
  const usersSearch = document.getElementById("usersSearch");
  const usersRoleFilter = document.getElementById("usersRoleFilter");
  const activeSearch = document.getElementById("activeSearch");
  const activeStatusFilter = document.getElementById("activeStatusFilter");

  const servicesApply = document.getElementById("servicesApply");
  const servicesReset = document.getElementById("servicesReset");
  const caregiversApply = document.getElementById("caregiversApply");
  const caregiversReset = document.getElementById("caregiversReset");
  const usersApply = document.getElementById("usersApply");
  const usersReset = document.getElementById("usersReset");
  const activeApply = document.getElementById("activeApply");
  const activeReset = document.getElementById("activeReset");

  let services = [];
  let caregivers = [];
  let users = [];
  let activeServices = [];

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await fetch("/logout", { method: "POST" });
      } catch (err) {
        // ignore
      } finally {
        localStorage.removeItem("token");
        window.location.replace("/loginpage");
      }
    });
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
    if (!value) return "NA";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  }

  function statusBadge(status) {
    const normalized = String(status || "").toUpperCase();
    if (normalized === "APPROVED") return `<span class="statusTag statusApproved">APPROVED</span>`;
    return `<span class="statusTag statusPending">PENDING</span>`;
  }

  function renderServices(rows) {
    if (!servicesBody) return;
    servicesBody.innerHTML = "";

    if (!rows.length) {
      servicesBody.innerHTML = `<tr><td colspan="3" class="emptyCell">No services found.</td></tr>`;
      return;
    }

    rows.forEach((service) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(service.id)}</td>
        <td>${escapeHtml(service.service_name || "NA")}</td>
        <td>${escapeHtml(service.price ?? "NA")}</td>
      `;
      servicesBody.appendChild(tr);
    });
  }

  function renderCaregivers(rows) {
    if (!caregiversBody) return;
    caregiversBody.innerHTML = "";

    if (!rows.length) {
      caregiversBody.innerHTML = `<tr><td colspan="7" class="emptyCell">No caregivers found.</td></tr>`;
      return;
    }

    rows.forEach((caregiver) => {
      const fullName = [caregiver.first_name, caregiver.last_name].filter(Boolean).join(" ").trim() || "NA";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(caregiver.id)}</td>
        <td>${escapeHtml(fullName)}</td>
        <td>${escapeHtml(caregiver.email || "NA")}</td>
        <td>${escapeHtml(caregiver.service_name || "NA")}</td>
        <td>${escapeHtml(caregiver.experience_years ?? "NA")}</td>
        <td>${escapeHtml(caregiver.rating ?? "NA")}</td>
        <td>${escapeHtml(caregiver.status || "NA")}</td>
      `;
      caregiversBody.appendChild(tr);
    });
  }

  function renderUsers(rows) {
    if (!usersBody) return;
    usersBody.innerHTML = "";

    if (!rows.length) {
      usersBody.innerHTML = `<tr><td colspan="5" class="emptyCell">No users found.</td></tr>`;
      return;
    }

    rows.forEach((user) => {
      const fullName = [user.fname, user.lname].filter(Boolean).join(" ").trim() || "NA";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(user.id)}</td>
        <td>${escapeHtml(fullName)}</td>
        <td>${escapeHtml(user.email || "NA")}</td>
        <td>${escapeHtml(user.phone || "NA")}</td>
        <td>${escapeHtml(user.role || "NA")}</td>
      `;
      usersBody.appendChild(tr);
    });
  }

  function renderActive(rows) {
    if (!activeBody) return;
    activeBody.innerHTML = "";

    if (!rows.length) {
      activeBody.innerHTML = `<tr><td colspan="7" class="emptyCell">No active services found.</td></tr>`;
      return;
    }

    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(row.booking_id)}</td>
        <td>${escapeHtml(row.patient_name || row.patient_email || "NA")}</td>
        <td>${escapeHtml(row.caregiver_name || "Not Assigned")}</td>
        <td>${escapeHtml(row.service_name || "NA")}</td>
        <td>${escapeHtml(formatDate(row.booking_date))}</td>
        <td>${escapeHtml(row.booking_time || "NA")}</td>
        <td>${statusBadge(row.status)}</td>
      `;
      activeBody.appendChild(tr);
    });
  }

  function applyServicesFilter() {
    const query = String(servicesSearch?.value || "").trim().toLowerCase();
    const filtered = services.filter((service) => {
      const name = String(service.service_name || "").toLowerCase();
      return !query || name.includes(query);
    });
    renderServices(filtered);
  }

  function applyCaregiversFilter() {
    const query = String(caregiversSearch?.value || "").trim().toLowerCase();
    const status = String(caregiversStatusFilter?.value || "").toUpperCase();

    const filtered = caregivers.filter((caregiver) => {
      const name = [caregiver.first_name, caregiver.last_name].filter(Boolean).join(" ").toLowerCase();
      const email = String(caregiver.email || "").toLowerCase();
      const rowStatus = String(caregiver.status || "").toUpperCase();

      const queryMatch = !query || name.includes(query) || email.includes(query);
      const statusMatch = !status || rowStatus === status;
      return queryMatch && statusMatch;
    });

    renderCaregivers(filtered);
  }

  function applyUsersFilter() {
    const query = String(usersSearch?.value || "").trim().toLowerCase();
    const role = String(usersRoleFilter?.value || "").toUpperCase();

    const filtered = users.filter((user) => {
      const name = [user.fname, user.lname].filter(Boolean).join(" ").toLowerCase();
      const email = String(user.email || "").toLowerCase();
      const rowRole = String(user.role || "").toUpperCase();

      const queryMatch = !query || name.includes(query) || email.includes(query);
      const roleMatch = !role || rowRole === role;
      return queryMatch && roleMatch;
    });

    renderUsers(filtered);
  }

  function applyActiveFilter() {
    const query = String(activeSearch?.value || "").trim().toLowerCase();
    const status = String(activeStatusFilter?.value || "").toUpperCase();

    const filtered = activeServices.filter((row) => {
      const patient = String(row.patient_name || row.patient_email || "").toLowerCase();
      const caregiver = String(row.caregiver_name || "").toLowerCase();
      const service = String(row.service_name || "").toLowerCase();
      const rowStatus = String(row.status || "").toUpperCase();

      const queryMatch = !query || patient.includes(query) || caregiver.includes(query) || service.includes(query);
      const statusMatch = !status || rowStatus === status;
      return queryMatch && statusMatch;
    });

    renderActive(filtered);
  }

  if (servicesApply) servicesApply.addEventListener("click", applyServicesFilter);
  if (caregiversApply) caregiversApply.addEventListener("click", applyCaregiversFilter);
  if (usersApply) usersApply.addEventListener("click", applyUsersFilter);
  if (activeApply) activeApply.addEventListener("click", applyActiveFilter);

  if (servicesReset) {
    servicesReset.addEventListener("click", () => {
      if (servicesSearch) servicesSearch.value = "";
      renderServices(services);
    });
  }

  if (caregiversReset) {
    caregiversReset.addEventListener("click", () => {
      if (caregiversSearch) caregiversSearch.value = "";
      if (caregiversStatusFilter) caregiversStatusFilter.value = "";
      renderCaregivers(caregivers);
    });
  }

  if (usersReset) {
    usersReset.addEventListener("click", () => {
      if (usersSearch) usersSearch.value = "";
      if (usersRoleFilter) usersRoleFilter.value = "";
      renderUsers(users);
    });
  }

  if (activeReset) {
    activeReset.addEventListener("click", () => {
      if (activeSearch) activeSearch.value = "";
      if (activeStatusFilter) activeStatusFilter.value = "";
      renderActive(activeServices);
    });
  }

  async function loadAdminData() {
    const res = await fetch("/api/admin/dashboard", { method: "GET" });
    if (res.status === 401 || res.status === 403) {
      window.location.replace("/loginpage");
      return;
    }
    if (!res.ok) {
      throw new Error("Failed to load admin dashboard");
    }

    const data = await res.json();
    services = data.services || [];
    caregivers = data.caregivers || [];
    users = data.users || [];
    activeServices = data.activeServices || [];

    if (adminUsers) adminUsers.textContent = String(data.summary?.users ?? users.length);
    if (adminCaregivers) adminCaregivers.textContent = String(data.summary?.caregivers ?? caregivers.length);
    if (adminBookings) adminBookings.textContent = String(data.summary?.activeServices ?? activeServices.length);

    renderServices(services);
    renderCaregivers(caregivers);
    renderUsers(users);
    renderActive(activeServices);
  }

  loadAdminData().catch(() => {
    if (servicesBody) servicesBody.innerHTML = `<tr><td colspan="3" class="emptyCell">Could not load data.</td></tr>`;
    if (caregiversBody) caregiversBody.innerHTML = `<tr><td colspan="7" class="emptyCell">Could not load data.</td></tr>`;
    if (usersBody) usersBody.innerHTML = `<tr><td colspan="5" class="emptyCell">Could not load data.</td></tr>`;
    if (activeBody) activeBody.innerHTML = `<tr><td colspan="7" class="emptyCell">Could not load data.</td></tr>`;
  });
});
