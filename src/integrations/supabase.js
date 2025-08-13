const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

const supabase = createClient(config.supabaseUrl, config.supabaseKey, { db: { schema: 'accounts' } });

module.exports = { supabase };
