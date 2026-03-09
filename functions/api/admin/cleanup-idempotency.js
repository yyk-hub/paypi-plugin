// functions/api/admin/cleanup-idempotency.js
/**
 * Secure Idempotency Cleanup Endpoint
 * 
 * Security improvements:
 * 1. Constant-time token comparison (prevents timing attacks)
 * 2. Rate limiting (max 10 calls per hour)
 * 3. IP tracking in security logs
 * 4. No error details leaked to client
 */

/**
 * Constant-time string comparison
 * Prevents timing attacks on token validation
 */
function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Get client IP for logging
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    
    // SECURITY: Extract and validate token
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // SECURITY: Use constant-time comparison to prevent timing attacks
    if (!token || !constantTimeCompare(token, env.ADMIN_TOKEN)) {
      // Log failed attempt
      console.warn('🚨 Unauthorized cleanup attempt from IP:', clientIP);
      
      // Optional: Log to security_audit_log table
      try {
        await env.DB.prepare(`
          INSERT INTO security_audit_log (
            log_id, event_type, ip_address, details, severity, created_at
          ) VALUES (?, 'cleanup_unauthorized', ?, ?, 'warning', unixepoch())
        `).bind(
          `SEC_${Date.now()}`,
          clientIP,
          JSON.stringify({ endpoint: 'cleanup-idempotency' })
        ).run();
      } catch (e) {
        // Don't fail on logging error
        console.error('Failed to log security event:', e);
      }
      
      return new Response(JSON.stringify({ 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // SECURITY: Rate limiting check (max 10 cleanups per hour)
    const rateLimitKey = `cleanup_${clientIP}_${Math.floor(Date.now() / 3600000)}`;
    const rateLimit = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM security_audit_log
      WHERE event_type = 'cleanup_success' 
        AND ip_address = ?
        AND created_at > unixepoch() - 3600
    `).bind(clientIP).first();
    
    if (rateLimit && rateLimit.count >= 10) {
      console.warn('🚨 Rate limit exceeded for IP:', clientIP);
      
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded. Try again later.'
      }), {
        status: 429, // Too Many Requests
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': '3600'
        }
      });
    }

    console.log('🧹 Running idempotency cleanup from IP:', clientIP);

    // Delete expired keys
    const result = await env.DB.prepare(`
      DELETE FROM idempotency_keys 
      WHERE expires_at < unixepoch()
    `).run();

    const cleaned = result.meta?.changes || 0;
    console.log(`✅ Cleaned ${cleaned} expired idempotency keys`);

    // Log successful cleanup
    try {
      await env.DB.prepare(`
        INSERT INTO security_audit_log (
          log_id, event_type, ip_address, details, severity, created_at
        ) VALUES (?, 'cleanup_success', ?, ?, 'info', unixepoch())
      `).bind(
        `SEC_${Date.now()}`,
        clientIP,
        JSON.stringify({ cleaned_keys: cleaned })
      ).run();
    } catch (e) {
      // Don't fail on logging error
      console.error('Failed to log cleanup event:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      cleaned_keys: cleaned,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Cleanup error:', error);
    
    // SECURITY: Don't leak error details to client
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'  // Generic message only
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}