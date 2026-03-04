const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("pass");

togglePassword.addEventListener("click", function () {

    const isPassword = passwordInput.type === "password";

    passwordInput.type = isPassword ? "text" : "password";

    this.classList.toggle("active");

});