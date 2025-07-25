const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = { supabase };
