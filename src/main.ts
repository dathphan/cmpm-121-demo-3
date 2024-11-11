const app = document.querySelector<HTMLDivElement>("#app")!;

const APP_NAME = "Geocoin Carrier";
document.title = APP_NAME;
app.innerHTML = APP_NAME;

const alertButton = document.createElement("button");
alertButton.textContent = "Alert Button";
app.append(alertButton);

alertButton.addEventListener("click", () => {
  alert("you clicked the button!");
});
