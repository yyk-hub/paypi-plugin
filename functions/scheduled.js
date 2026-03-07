// functions/scheduled.js
/**
 * Scheduled Maintenance Tasks
 * Runs daily at midnight UTC
 * 
 * Tasks:
 * - Cleanup expired idempotency keys (older than 24 hours)
 */

export async function onSchedule(event, env, ctx) {
  console.log('🕐 Running scheduled maintenance...');

  try {
    // Cleanup expired idempotency keys
    const result = await env.DB.prepare(`
      DELETE FROM idempotency_keys 
      WHERE expires_at < unixepoch()
    `).run();

    const cleaned = result.meta?.changes || 0;
    console.log(`✅ Cleaned up ${cleaned} expired idempotency keys`);

    return new Response(JSON.stringify({
      success: true,
      cleaned_keys: cleaned,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Scheduled maintenance error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}