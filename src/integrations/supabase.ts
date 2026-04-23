import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseKey } from '../config';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'accounts' },
});
