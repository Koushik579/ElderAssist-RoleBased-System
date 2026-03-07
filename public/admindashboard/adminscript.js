document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("adminLogoutBtn");

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
});
