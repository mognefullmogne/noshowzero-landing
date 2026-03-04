/**
 * Seed script: populates the database with fictional hair salon data.
 * Creates patients, appointment slots, and appointments across 4 weeks.
 *
 * Usage: node scripts/seed-hairdresser.mjs
 */

const SUPABASE_URL = "https://hwxebnmrgrdzpfappyvk.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3eGVibm1yZ3JkenBmYXBweXZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ4NDQ1MSwiZXhwIjoyMDg4MDYwNDUxfQ.DhQuhV4hYpDoC9KddCceJTamXKGkyJp1maq14KT37LM";
const TENANT_ID = "e1d14300-10cb-42d0-9e9d-eb8fee866570";

const HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// --- Fictional clients ---
// All phones point to the test number so WhatsApp messages arrive on the tester's device.
const TEST_PHONE = "+393516761840";
const CLIENTS = [
  { first_name: "Marco", last_name: "Rossi", phone: TEST_PHONE, email: "marco.rossi@test.it" },
  { first_name: "Giulia", last_name: "Bianchi", phone: TEST_PHONE, email: "giulia.bianchi@test.it" },
  { first_name: "Luca", last_name: "Ferrari", phone: TEST_PHONE, email: "luca.ferrari@test.it" },
  { first_name: "Sofia", last_name: "Russo", phone: TEST_PHONE, email: "sofia.russo@test.it" },
  { first_name: "Alessandro", last_name: "Romano", phone: TEST_PHONE, email: "alessandro.romano@test.it" },
  { first_name: "Francesca", last_name: "Gallo", phone: TEST_PHONE, email: "francesca.gallo@test.it" },
  { first_name: "Davide", last_name: "Conti", phone: TEST_PHONE, email: "davide.conti@test.it" },
  { first_name: "Elena", last_name: "Marino", phone: TEST_PHONE, email: "elena.marino@test.it" },
  { first_name: "Matteo", last_name: "Greco", phone: TEST_PHONE, email: "matteo.greco@test.it" },
  { first_name: "Chiara", last_name: "Bruno", phone: TEST_PHONE, email: "chiara.bruno@test.it" },
  { first_name: "Andrea", last_name: "De Luca", phone: TEST_PHONE, email: "andrea.deluca@test.it" },
  { first_name: "Valentina", last_name: "Ricci", phone: TEST_PHONE, email: "valentina.ricci@test.it" },
  { first_name: "Giovanni", last_name: "Moretti", phone: TEST_PHONE, email: "giovanni.moretti@test.it" },
  { first_name: "Anna", last_name: "Colombo", phone: TEST_PHONE, email: "anna.colombo@test.it" },
  { first_name: "Roberto", last_name: "Mancini", phone: TEST_PHONE, email: "roberto.mancini@test.it" },
];

// --- Hair salon services ---
const SERVICES = [
  { code: "TAGLIO_U", name: "Taglio Uomo", duration: 30 },
  { code: "TAGLIO_D", name: "Taglio Donna", duration: 45 },
  { code: "PIEGA", name: "Piega", duration: 30 },
  { code: "COLORE", name: "Colore", duration: 60 },
  { code: "MECHE", name: "Meches / Colpi di sole", duration: 90 },
  { code: "BARBA", name: "Barba e rasatura", duration: 20 },
  { code: "TRATTAMENTO", name: "Trattamento ristrutturante", duration: 45 },
  { code: "SHAMPOO_PIEGA", name: "Shampoo e piega", duration: 30 },
];

const PROVIDERS = ["Marco Stylist", "Sara Colorista"];

// --- Appointment statuses to distribute ---
const STATUS_DISTRIBUTION = [
  "scheduled", "scheduled", "scheduled",
  "confirmed", "confirmed", "confirmed", "confirmed",
  "reminder_sent", "reminder_sent",
  "declined",
  "no_show",
  "completed", "completed", "completed", "completed",
  "cancelled",
];

async function supabasePost(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to insert into ${table}: ${res.status} ${err}`);
  }
  return res.json();
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("🪒 Seeding hair salon data...\n");

  // 1. Create patients
  console.log("👥 Creating 15 clients...");
  const patientRows = CLIENTS.map((c) => ({
    tenant_id: TENANT_ID,
    first_name: c.first_name,
    last_name: c.last_name,
    phone: c.phone,
    email: c.email,
    preferred_channel: "whatsapp",
    is_active: true,
  }));
  const patients = await supabasePost("patients", patientRows);
  console.log(`   ✓ ${patients.length} clients created`);

  // 2. Generate slots and appointments for 4 weeks (this week + 3 more)
  const today = new Date();
  const thisMonday = getMonday(today);

  const allSlots = [];
  const allAppointments = [];
  let appointmentIndex = 0;

  for (let week = 0; week < 4; week++) {
    const weekStart = new Date(thisMonday);
    weekStart.setDate(weekStart.getDate() + week * 7);

    for (let day = 0; day < 5; day++) {
      const currentDay = new Date(weekStart);
      currentDay.setDate(currentDay.getDate() + day);

      // Slots from 8:00 to 18:00 (every 30 min) for each provider
      for (const provider of PROVIDERS) {
        for (let hour = 8; hour < 18; hour++) {
          for (const halfHour of [0, 30]) {
            const startAt = new Date(currentDay);
            startAt.setHours(hour, halfHour, 0, 0);
            const endAt = new Date(startAt);
            endAt.setMinutes(endAt.getMinutes() + 30);

            allSlots.push({
              tenant_id: TENANT_ID,
              provider_name: provider,
              start_at: startAt.toISOString(),
              end_at: endAt.toISOString(),
              status: "available",
            });
          }
        }
      }

      // Create 3-5 appointments per day spread across hours
      const apptsPerDay = 3 + Math.floor(Math.random() * 3);
      const usedHours = new Set();

      for (let a = 0; a < apptsPerDay; a++) {
        let hour;
        do {
          hour = 8 + Math.floor(Math.random() * 10); // 8-17
        } while (usedHours.has(hour));
        usedHours.add(hour);

        const service = randomPick(SERVICES);
        const patient = patients[appointmentIndex % patients.length];
        const provider = randomPick(PROVIDERS);
        const status = STATUS_DISTRIBUTION[appointmentIndex % STATUS_DISTRIBUTION.length];

        const scheduledAt = new Date(currentDay);
        scheduledAt.setHours(hour, Math.random() > 0.5 ? 0 : 30, 0, 0);

        // Determine if this is in the past
        const isPast = scheduledAt < today;
        // Past appointments should be completed/no_show/cancelled, not scheduled
        const finalStatus = isPast
          ? ["completed", "completed", "completed", "no_show", "cancelled"][Math.floor(Math.random() * 5)]
          : status;

        allAppointments.push({
          tenant_id: TENANT_ID,
          patient_id: patient.id,
          service_code: service.code,
          service_name: service.name,
          provider_name: provider,
          scheduled_at: scheduledAt.toISOString(),
          duration_min: service.duration,
          status: finalStatus,
        });

        appointmentIndex++;
      }
    }
  }

  // 3. Insert slots in batches
  console.log(`📅 Creating ${allSlots.length} slots across 4 weeks...`);
  const BATCH = 500;
  for (let i = 0; i < allSlots.length; i += BATCH) {
    await supabasePost("appointment_slots", allSlots.slice(i, i + BATCH));
    process.stdout.write(`   ✓ ${Math.min(i + BATCH, allSlots.length)}/${allSlots.length}\r`);
  }
  console.log();

  // 4. Insert appointments
  console.log(`📋 Creating ${allAppointments.length} appointments...`);
  const insertedAppts = await supabasePost("appointments", allAppointments);
  console.log(`   ✓ ${insertedAppts.length} appointments created`);

  // Summary
  const statusCounts = {};
  for (const a of allAppointments) {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
  }
  console.log("\n📊 Status distribution:");
  for (const [s, c] of Object.entries(statusCounts).sort()) {
    console.log(`   ${s}: ${c}`);
  }

  console.log("\n✅ Done! Refresh your dashboard to see the data.");
}

main().catch(console.error);
