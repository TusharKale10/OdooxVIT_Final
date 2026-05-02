// Real-time slot availability calculator
// Builds candidate slots from weekly_schedules OR availability_slots,
// then subtracts capacity already taken by confirmed/reserved bookings.

const pool = require('../config/db');

const pad = (n) => String(n).padStart(2, '0');

const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// Compose a `YYYY-MM-DD HH:MM:SS` string in local time
const toMysqlLocal = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

const parseTime = (t) => {
  // 'HH:MM:SS' -> {h,m,s}
  const [h, m, s] = t.split(':').map(Number);
  return { h, m, s: s || 0 };
};

const buildWeeklySlots = (date, schedules, durationMinutes) => {
  const dow = date.getDay(); // 0..6
  const todays = schedules.filter((s) => Number(s.day_of_week) === dow);
  const slots = [];
  for (const win of todays) {
    const a = parseTime(win.start_time);
    const b = parseTime(win.end_time);
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), a.h, a.m, a.s);
    const end   = new Date(date.getFullYear(), date.getMonth(), date.getDate(), b.h, b.m, b.s);
    let cur = new Date(start.getTime());
    while (cur.getTime() + durationMinutes * 60000 <= end.getTime()) {
      const slotStart = new Date(cur.getTime());
      const slotEnd   = new Date(cur.getTime() + durationMinutes * 60000);
      slots.push({ start: slotStart, end: slotEnd });
      cur = slotEnd;
    }
  }
  return slots;
};

const buildFlexibleSlots = (date, flexSlots, durationMinutes) => {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd   = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const slots = [];
  for (const win of flexSlots) {
    const start = new Date(win.start_datetime.replace(' ', 'T'));
    const end   = new Date(win.end_datetime.replace(' ', 'T'));
    if (end <= dayStart || start >= dayEnd) continue;
    const winStart = start < dayStart ? dayStart : start;
    const winEnd   = end   > dayEnd   ? dayEnd   : end;
    let cur = new Date(winStart.getTime());
    while (cur.getTime() + durationMinutes * 60000 <= winEnd.getTime()) {
      const slotStart = new Date(cur.getTime());
      const slotEnd   = new Date(cur.getTime() + durationMinutes * 60000);
      slots.push({ start: slotStart, end: slotEnd });
      cur = slotEnd;
    }
  }
  return slots;
};

/**
 * Computes available slots for a service on a specific date.
 * If resource_id is provided, returns availability for that single resource.
 * Otherwise returns aggregated availability across ALL resources of the service.
 */
async function getAvailableSlots({ serviceId, date, resourceId = null, conn = null }) {
  const c = conn || pool;
  const [serviceRows] = await c.query('SELECT * FROM services WHERE id=?', [serviceId]);
  if (!serviceRows.length) throw new Error('Service not found');
  const service = serviceRows[0];

  const [resources] = await c.query(
    'SELECT id, name FROM resources WHERE service_id=? AND is_active=1' +
    (resourceId ? ' AND id=?' : ''),
    resourceId ? [serviceId, resourceId] : [serviceId]
  );
  if (!resources.length) return [];

  let baseSlots = [];
  if (service.schedule_type === 'weekly') {
    const [ws] = await c.query('SELECT * FROM weekly_schedules WHERE service_id=?', [serviceId]);
    baseSlots = buildWeeklySlots(date, ws, service.duration_minutes);
  } else {
    const [fs] = await c.query('SELECT * FROM availability_slots WHERE service_id=?', [serviceId]);
    baseSlots = buildFlexibleSlots(date, fs, service.duration_minutes);
  }
  if (!baseSlots.length) return [];

  // Pull bookings on that date for these resources
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd   = new Date(dayStart.getTime() + 24 * 3600 * 1000);

  const resourceIds = resources.map((r) => r.id);
  const [bookings] = await c.query(
    `SELECT resource_id, start_datetime, end_datetime, capacity_taken, status
       FROM bookings
      WHERE resource_id IN (?)
        AND status IN ('reserved','pending','confirmed')
        AND start_datetime >= ? AND start_datetime < ?`,
    [resourceIds, toMysqlLocal(dayStart), toMysqlLocal(dayEnd)]
  );

  // Build per-resource map of taken capacity per slot start key
  const takenByResource = {};
  for (const r of resources) takenByResource[r.id] = {};
  for (const b of bookings) {
    const key = b.start_datetime;
    takenByResource[b.resource_id][key] =
      (takenByResource[b.resource_id][key] || 0) + Number(b.capacity_taken);
  }

  const cap = service.manage_capacity ? Number(service.max_per_slot) : 1;

  // For each base slot, compute remaining capacity & a candidate resource
  const result = baseSlots.map((slot) => {
    const key = toMysqlLocal(slot.start);
    let remainingTotal = 0;
    let pickedResource = null;
    let pickedResourceRemaining = 0;
    for (const r of resources) {
      const used = takenByResource[r.id][key] || 0;
      const rem  = Math.max(0, cap - used);
      remainingTotal += rem;
      if (rem > pickedResourceRemaining) {
        pickedResourceRemaining = rem;
        pickedResource = r;
      }
    }
    return {
      start: toMysqlLocal(slot.start),
      end:   toMysqlLocal(slot.end),
      capacity_total: cap * resources.length,
      capacity_remaining: remainingTotal,
      suggested_resource_id: pickedResource ? pickedResource.id : null,
      suggested_resource_name: pickedResource ? pickedResource.name : null,
      available: remainingTotal > 0,
    };
  });

  return result;
}

module.exports = { getAvailableSlots, toMysqlLocal };
