const supabase = require('../config/supabase');

// Catat aksi admin ke admin_audit_log. Kegagalan pencatatan hanya di-log.
async function logAdmin(adminId, action, targetId, details = {}, targetUserId = null) {
  const { error } = await supabase.from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    target_user_id: targetUserId,
    target_id: targetId ? String(targetId) : null,
    details,
  });
  if (error) console.error('[AUDIT] gagal mencatat:', error.message);
}

module.exports = { logAdmin };
