import http from "http";

const data = JSON.stringify({
  email: "test@example.com",
  password: "Test123456",
  firstName: "John",
  lastName: "Doe",
  organizationName: "Test Org",
  rccmNumber: "12345",
  nifNumber: "67890",
});

const options = {
  hostname: "127.0.0.1",
  port: 3001,
  path: "/api/auth/register",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": data.length,
  },
};

const req = http.request(options, (res) => {
  let responseData = "";
  res.on("data", (chunk) => {
    responseData += chunk;
  });
  res.on("end", () => {
    console.log("Status:", res.statusCode);
    console.log("Response:", responseData);
  });
});

req.on("error", (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();

