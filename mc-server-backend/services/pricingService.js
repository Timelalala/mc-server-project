const db = require('../models/db');

/**
 * ตรวจสอบความถูกต้องของโครงสร้างราคาระหว่าง Slot และ Daily/Block package
 * กฎ: ราคาเฉลี่ยต่อชั่วโมงของแพ็กเกจเหมา (Daily >= 8 ชม.) ต้องไม่แพงกว่าราคาเฉลี่ยต่อชั่วโมงของ Slot-based
 * 
 * @param {Object} slotConfig - { durationHours: number, price: number }
 * @param {Object} dailyConfig - { durationHours: number, price: number }
 * @returns {boolean} true if valid, throws Error if invalid
 */
function validatePricingConsistency(slotConfig, dailyConfig) {
  if (!slotConfig || !dailyConfig) {
    throw new Error('Both slotConfig and dailyConfig are required for pricing validation.');
  }

  const slotHours = Number(slotConfig.durationHours);
  const slotPrice = Number(slotConfig.price);
  const dailyHours = Number(dailyConfig.durationHours);
  const dailyPrice = Number(dailyConfig.price);

  if (isNaN(slotHours) || isNaN(slotPrice) || isNaN(dailyHours) || isNaN(dailyPrice)) {
    throw new Error('Invalid numeric values in pricing configuration.');
  }

  if (slotHours <= 0 || slotPrice < 0) {
    throw new Error('Slot duration must be positive and price cannot be negative.');
  }

  if (dailyHours < 8) {
    throw new Error(`Daily/Block booking duration must be at least 8 hours (provided: ${dailyHours} hrs).`);
  }

  if (dailyPrice < 0) {
    throw new Error('Daily price cannot be negative.');
  }

  const slotHourlyRate = slotPrice / slotHours;
  const dailyHourlyRate = dailyPrice / dailyHours;

  // Requirement: ราคาเฉลี่ยต่อชั่วโมงของ Daily ต้อง <= Slot
  if (dailyHourlyRate > slotHourlyRate) {
    throw new Error(
      `Pricing Inconsistency: Daily average hourly rate (${dailyHourlyRate.toFixed(2)} THB/hr) cannot exceed slot hourly rate (${slotHourlyRate.toFixed(2)} THB/hr).`
    );
  }

  return true;
}

/**
 * ดึงรายการกฎราคาที่ใช้งานอยู่
 * @param {number|string} [serverId] 
 */
async function getPricingRules(serverId = null) {
  try {
    const [rules] = await db.query(
      `SELECT * FROM pricing_rules 
       WHERE is_active = TRUE AND (server_id = ? OR server_id IS NULL)
       ORDER BY server_id DESC, duration_hours ASC`,
      [serverId]
    );
    return rules;
  } catch (err) {
    console.error('getPricingRules error:', err);
    // Fallback default rules if table not yet populated
    return [
      { booking_type: 'timeslot', duration_hours: 2, price: 50.00 },
      { booking_type: 'fullday', duration_hours: 24, price: 200.00 },
      { booking_type: 'multiday', duration_hours: 24, price: 180.00 },
      { booking_type: 'daily', duration_hours: 8, price: 90.00 }
    ];
  }
}

/**
 * คำนวณราคาตามประเภทการจองและจำนวนชั่วโมง/วัน
 * @param {string} bookingType - 'timeslot' | 'fullday' | 'multiday' | 'daily' | 'slot'
 * @param {Object} options - { slotCount, days, durationHours, serverId }
 */
async function calculateBookingPrice(bookingType, options = {}) {
  const { slotCount = 1, days = 1, durationHours = 0, serverId = null } = options;
  const rules = await getPricingRules(serverId);

  const normalizedType = bookingType.toLowerCase();

  // 1. timeslot / slot
  if (normalizedType === 'timeslot' || normalizedType === 'slot') {
    const slotRule = rules.find(r => r.booking_type === 'timeslot' || r.booking_type === 'slot');
    const pricePerSlot = slotRule ? Number(slotRule.price) : 50.00;
    return slotCount * pricePerSlot;
  }

  // 2. fullday (24 hrs)
  if (normalizedType === 'fullday') {
    const fullDayRule = rules.find(r => r.booking_type === 'fullday');
    return fullDayRule ? Number(fullDayRule.price) : 200.00;
  }

  // 3. multiday
  if (normalizedType === 'multiday') {
    const multiDayRule = rules.find(r => r.booking_type === 'multiday');
    const pricePerDay = multiDayRule ? Number(multiDayRule.price) : 180.00;
    return days * pricePerDay;
  }

  // 4. daily / block (e.g. 8 hrs)
  if (normalizedType === 'daily') {
    const dailyRule = rules.find(r => r.booking_type === 'daily' && (durationHours <= 0 || r.duration_hours === durationHours))
      || rules.find(r => r.booking_type === 'daily');
    if (dailyRule) return Number(dailyRule.price);
    return 90.00;
  }

  // Default fallback
  return 50.00;
}

module.exports = {
  validatePricingConsistency,
  getPricingRules,
  calculateBookingPrice
};
