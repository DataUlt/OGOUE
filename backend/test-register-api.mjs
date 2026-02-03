#!/usr/bin/env node

import http from "http";

const testData = {
  email: "benoit@test.com",
  password: "Test123456!",
  firstName: "Benoit",
  lastName: "NZIENGUI",
  organizationName: "TestOgoue",
  rccmNumber: "RC001",
  nifNumber: "NF001",
};

const jsonData = JSON.stringify(testData);

console.log("🧪 Testing /api/auth/register endpoint...");
console.log("📤 Sending:", JSON.stringify(testData, null, 2));

const options = {
  hostname: "127.0.0.1",
  port: 3001,
  path: "/api/auth/register",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": jsonData.length,
  },
};

const req = http.request(options, (res) => {
  let responseData = "";
  
  res.on("data", (chunk) => {
    responseData += chunk;
  });

  res.on("end", () => {
    console.log("\n✅ Response received:");
    console.log("Status Code:", res.statusCode);
    try {
      const parsed = JSON.parse(responseData);
      console.log("Response Body:", JSON.stringify(parsed, null, 2));
    } catch {
      console.log("Response Body:", responseData);
    }
    process.exit(0);
  });
});

req.on("error", (error) => {
  console.error("\n❌ Error:", error.message);
  process.exit(1);
});

req.write(jsonData);
req.end();

setTimeout(() => {
  console.error("\n❌ Timeout: No response after 5 seconds");
  process.exit(1);
}, 5000);
