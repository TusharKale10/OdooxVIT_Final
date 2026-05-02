-- Seed data for testing
USE appointment_app;

-- Default password for all seed users: "password123"
-- bcrypt hash of 'password123'
SET @pw := '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lq';

INSERT INTO users (full_name, email, password_hash, role, is_active, is_verified) VALUES
 ('System Admin','admin@app.com',         @pw, 'admin',    1, 1),
 ('Dr. Smith',   'organiser@app.com',     @pw, 'organiser',1, 1),
 ('Jane Doe',    'customer@app.com',      @pw, 'customer', 1, 1),
 ('Dr. Watson',  'watson@app.com',        @pw, 'organiser',1, 1);

-- Service: Dental Care (weekly schedule)
INSERT INTO services
 (organiser_id,name,description,duration_minutes,venue,price,tax_percent,
  manage_capacity,max_per_slot,advance_payment,manual_confirmation,
  assignment_mode,schedule_type,resource_kind,is_published,share_token)
VALUES
 (2,'Dental Care','Professional dental cleaning and consultation.',30,
  'Doctor''s Office, 64 Doctor Street, Springfield 380005, Ahmedabad',
  1000,10,0,1,1,0,'auto','weekly','user',1,'tok_dental_001');

-- Service: Group Yoga Class (manage capacity)
INSERT INTO services
 (organiser_id,name,description,duration_minutes,venue,price,tax_percent,
  manage_capacity,max_per_slot,advance_payment,manual_confirmation,
  assignment_mode,schedule_type,resource_kind,is_published,share_token)
VALUES
 (2,'Group Yoga Class','Morning yoga session for groups.',60,
  'Yoga Studio, MG Road',500,5,1,10,0,1,'auto','weekly','resource',1,'tok_yoga_002');

-- Resources for service 1 (Dental Care)
INSERT INTO resources (service_id,name,user_id) VALUES
 (1,'Dr. Smith',2),
 (1,'Dr. Watson',4);

-- Resources for service 2 (Yoga)
INSERT INTO resources (service_id,name) VALUES
 (2,'Studio Room A'),
 (2,'Studio Room B');

-- Weekly schedule for service 1: Mon-Fri 9-17
INSERT INTO weekly_schedules (service_id,day_of_week,start_time,end_time) VALUES
 (1,1,'09:00:00','17:00:00'),
 (1,2,'09:00:00','17:00:00'),
 (1,3,'09:00:00','17:00:00'),
 (1,4,'09:00:00','17:00:00'),
 (1,5,'09:00:00','17:00:00');

-- Weekly schedule for service 2: Mon-Sat 06:00-09:00
INSERT INTO weekly_schedules (service_id,day_of_week,start_time,end_time) VALUES
 (2,1,'06:00:00','09:00:00'),
 (2,2,'06:00:00','09:00:00'),
 (2,3,'06:00:00','09:00:00'),
 (2,4,'06:00:00','09:00:00'),
 (2,5,'06:00:00','09:00:00'),
 (2,6,'06:00:00','09:00:00');

-- Booking questions
INSERT INTO booking_questions (service_id,question,field_type,is_required,sort_order) VALUES
 (1,'Name','text',1,1),
 (1,'Email','email',1,2),
 (1,'Phone number','phone',1,3),
 (1,'Symptoms','textarea',0,4),
 (2,'Name','text',1,1),
 (2,'Email','email',1,2),
 (2,'Phone number','phone',1,3);
