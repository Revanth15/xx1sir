-- Create Enums
CREATE TYPE user_role AS ENUM ('APPROVER', 'ADMIN');
CREATE TYPE report_status AS ENUM ('PENDING_COY', 'PENDING_S4', 'REPORTED_IFM', 'COMPLETED', 'REJECTED');

-- Create the BarrackDamage Table
CREATE TABLE barrack_damage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_reference TEXT UNIQUE NOT NULL,
  is_urgent BOOLEAN DEFAULT false,
  company TEXT NOT NULL,
  damage_tag_placed BOOLEAN DEFAULT false,
  reported_by TEXT NOT NULL,
  type TEXT NOT NULL,
  location TEXT NOT NULL,
  unit_number TEXT NOT NULL,
  description TEXT NOT NULL,
  image_urls TEXT[] DEFAULT '{}',
  status report_status DEFAULT 'PENDING_COY',
  approved_by_coy BOOLEAN DEFAULT false,
  date_reported TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ifm_reported_date TIMESTAMP WITH TIME ZONE,
  ifm_target_date TIMESTAMP WITH TIME ZONE,
  repaired_date TIMESTAMP WITH TIME ZONE
);

-- Create Timeline Log Table
CREATE TABLE case_timeline_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  damage_id UUID REFERENCES barrack_damage(id) ON DELETE CASCADE,
  action_taken TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);