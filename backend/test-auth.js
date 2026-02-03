// Test script pour l'authentification
import axios from "axios";

const BASE_URL = "http://localhost:3001/api";

async function test() {
  try {
    console.log("🧪 TEST 1: Inscription");
    const registerRes = await axios.post(`${BASE_URL}/auth/register`, {
      firstName: "Jean",
      lastName: "Dupont",
      email: "jean@example.com",
      password: "password123",
      organizationName: "Ma Startup",
      rccmNumber: "GA-001",
      nifNumber: "NIF-001",
      activity: "Tech",
      activityDescription: "Services informatiques",
      role: "manager",
    });

    console.log("✅ Inscription réussie:");
    console.log(JSON.stringify(registerRes.data, null, 2));
    const token = registerRes.data.token;
    const organizationId = registerRes.data.user.organizationId;

    console.log("\n🧪 TEST 2: Connexion");
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: "jean@example.com",
      password: "password123",
    });

    console.log("✅ Connexion réussie:");
    console.log(JSON.stringify(loginRes.data, null, 2));

    console.log("\n🧪 TEST 3: Créer une vente");
    const saleRes = await axios.post(
      `${BASE_URL}/sales`,
      {
        saleDate: "2025-12-22",
        description: "Vente test",
        saleType: "En ligne",
        paymentMethod: "Virement",
        quantity: 1,
        amount: 50000,
        receiptName: "recu_001.pdf",
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log("✅ Vente créée:");
    console.log(JSON.stringify(saleRes.data, null, 2));

    console.log("\n🧪 TEST 4: Lister les ventes");
    const listRes = await axios.get(`${BASE_URL}/sales?month=12&year=2025`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("✅ Ventes récupérées:");
    console.log(JSON.stringify(listRes.data, null, 2));

    console.log("\n🧪 TEST 5: Créer une dépense");
    const expenseRes = await axios.post(
      `${BASE_URL}/expenses`,
      {
        expenseDate: "2025-12-22",
        category: "Fournitures",
        paymentMethod: "Espèces",
        amount: 10000,
        receiptName: "facture_001.pdf",
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log("✅ Dépense créée:");
    console.log(JSON.stringify(expenseRes.data, null, 2));

    console.log("\n🧪 TEST 6: Résumé mensuel");
    const summaryRes = await axios.get(`${BASE_URL}/summary?month=12&year=2025`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("✅ Résumé:");
    console.log(JSON.stringify(summaryRes.data, null, 2));

    console.log("\n✅ TOUS LES TESTS ONT PASSÉ!");
  } catch (error) {
    console.error("❌ ERREUR:", error.response?.data || error.message);
  }
}

test();
