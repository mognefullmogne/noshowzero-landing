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
// Only Luca Ferrari uses the real test phone. Others get fake numbers
// so they don't trigger real WhatsApp messages to the owner.
const CLIENTS = [
  { first_name: "Marco", last_name: "Rossi", phone: "+390000000001", email: "marco.rossi@test.it" },
  { first_name: "Giulia", last_name: "Bianchi", phone: "+390000000002", email: "giulia.bianchi@test.it" },
  { first_name: "Luca", last_name: "Ferrari", phone: "+390000000003", email: "luca.ferrari@test.it" },
  { first_name: "Sofia", last_name: "Russo", phone: "+390000000004", email: "sofia.russo@test.it" },
  { first_name: "Alessandro", last_name: "Romano", phone: "+390000000005", email: "alessandro.romano@test.it" },
  { first_name: "Francesca", last_name: "Gallo", phone: "+390000000006", email: "francesca.gallo@test.it" },
  { first_name: "Davide", last_name: "Conti", phone: "+390000000007", email: "davide.conti@test.it" },
  { first_name: "Elena", last_name: "Marino", phone: "+390000000008", email: "elena.marino@test.it" },
  { first_name: "Matteo", last_name: "Greco", phone: "+390000000009", email: "matteo.greco@test.it" },
  { first_name: "Chiara", last_name: "Bruno", phone: "+390000000010", email: "chiara.bruno@test.it" },
  { first_name: "Andrea", last_name: "De Luca", phone: "+390000000011", email: "andrea.deluca@test.it" },
  { first_name: "Valentina", last_name: "Ricci", phone: "+390000000012", email: "valentina.ricci@test.it" },
  { first_name: "Giovanni", last_name: "Moretti", phone: "+390000000013", email: "giovanni.moretti@test.it" },
  { first_name: "Anna", last_name: "Colombo", phone: "+390000000014", email: "anna.colombo@test.it" },
  { first_name: "Roberto", last_name: "Mancini", phone: "+390000000015", email: "roberto.mancini@test.it" },
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

  // 5. Create historical recovery data (accepted offers with new appointments)
  // This populates the "Slot recuperati" and "Ricavi salvati" dashboard stats.
  console.log("\n🔄 Creating historical recovery data...");

  // Find past cancelled appointments to use as original_appointment_id
  const pastCancelled = insertedAppts.filter(
    (a) => a.status === "cancelled" && new Date(a.scheduled_at) < today
  );
  // Find past completed appointments to use as new_appointment_id (recovery results)
  const pastCompleted = insertedAppts.filter(
    (a) => a.status === "completed" && new Date(a.scheduled_at) < today
  );

  const recoveryCount = Math.min(pastCancelled.length, pastCompleted.length, 5);
  let offersCreated = 0;

  for (let i = 0; i < recoveryCount; i++) {
    const cancelled = pastCancelled[i];
    const completed = pastCompleted[i];
    // Pick a different patient than the one who cancelled
    const candidatePatient = patients[(i + 3) % patients.length];

    const offeredAt = new Date(cancelled.scheduled_at);
    offeredAt.setHours(offeredAt.getHours() - 4); // offered 4 hours before slot
    const respondedAt = new Date(offeredAt);
    respondedAt.setMinutes(respondedAt.getMinutes() + (5 + Math.floor(Math.random() * 25))); // responded in 5-30 min

    // Use a deterministic token hash (not real HMAC, just for seeding)
    const tokenHash = `seed_token_hash_${i}_${Date.now()}`;

    try {
      await supabasePost("waitlist_offers", [{
        tenant_id: TENANT_ID,
        original_appointment_id: cancelled.id,
        waitlist_entry_id: null,
        patient_id: candidatePatient.id,
        new_appointment_id: completed.id,
        status: "accepted",
        smart_score: 70 + Math.floor(Math.random() * 25),
        token_hash: tokenHash,
        offered_at: offeredAt.toISOString(),
        expires_at: new Date(offeredAt.getTime() + 60 * 60 * 1000).toISOString(),
        responded_at: respondedAt.toISOString(),
      }]);
      offersCreated++;
    } catch (err) {
      console.warn(`   ⚠ Failed to create offer ${i}: ${err.message}`);
    }
  }

  // Also create a couple of pending offers (active offers stat)
  const futureCancelled = insertedAppts.filter(
    (a) => a.status === "cancelled" && new Date(a.scheduled_at) > today
  );
  for (let i = 0; i < Math.min(futureCancelled.length, 2); i++) {
    const cancelled = futureCancelled[i];
    const candidatePatient = patients[(i + 7) % patients.length];
    const tokenHash = `seed_pending_token_${i}_${Date.now()}`;
    const offeredAt = new Date();
    offeredAt.setMinutes(offeredAt.getMinutes() - 10);

    try {
      await supabasePost("waitlist_offers", [{
        tenant_id: TENANT_ID,
        original_appointment_id: cancelled.id,
        waitlist_entry_id: null,
        patient_id: candidatePatient.id,
        new_appointment_id: null,
        status: "pending",
        smart_score: 65 + Math.floor(Math.random() * 30),
        token_hash: tokenHash,
        offered_at: offeredAt.toISOString(),
        expires_at: new Date(offeredAt.getTime() + 60 * 60 * 1000).toISOString(),
        responded_at: null,
      }]);
      offersCreated++;
    } catch (err) {
      console.warn(`   ⚠ Failed to create pending offer ${i}: ${err.message}`);
    }
  }

  console.log(`   ✓ ${offersCreated} waitlist offers created (${recoveryCount} accepted, ${offersCreated - recoveryCount} pending)`);

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
