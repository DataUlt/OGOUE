const body = JSON.stringify({
  email: "test@example.com",
  password: "Test123456",
  firstName: "John",
  lastName: "Doe",
  organizationName: "Test Org",
  rccmNumber: "12345",
  nifNumber: "67890",
});

try {
  const response = await fetch("http://127.0.0.1:3001/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: body,
  });

  const text = await response.text();
  console.log("Status:", response.status);
  console.log("Response:", text);
} catch (err) {
  console.error("Error:", err.message);
}
